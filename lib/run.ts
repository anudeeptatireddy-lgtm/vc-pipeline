// Pipeline orchestrator: batch sources once, then each VC isolated, with a
// time budget so the run ends inside Vercel's maxDuration (CLAUDE.md rule 6).
import { finishRun, isRunActive, loadVcProfiles, loadVcs, startRun, type RunError } from "./db";
import { exaUsage } from "./exa";
import { geminiUsage } from "./gemini";
import { mapLimit } from "./http";
import { processVc, windowStart, type VcRunResult } from "./pipeline";
import { matchBatch } from "./sources/batch-feeds";
import { BATCH_SOURCES, PER_VC_SOURCES } from "./sources/index";
import type { RawItem, SignalSource, Vc } from "./types";

export interface RunOptions {
  trigger: "cron" | "manual" | "script";
  only?: string[]; // seed keys
  concurrency?: number;
  budgetMs?: number; // stop starting new VCs after this
  sources?: SignalSource[];
  batchSources?: SignalSource[];
  today?: Date;
  /** Refuse to start while another run is in flight (default true). */
  lock?: boolean;
}

export class RunLockedError extends Error {
  constructor() {
    super("A pipeline run is already in progress");
  }
}

export interface RunSummary {
  runId: number;
  processed: number;
  skipped: number;
  errors: RunError[];
  results: VcRunResult[];
  durationMs: number;
}

export async function runPipeline(opts: RunOptions): Promise<RunSummary> {
  const started = Date.now();
  // Usage counters are module-level (warm serverless instances reuse them), so log deltas.
  const exa0 = { ...exaUsage };
  const gem0 = { ...geminiUsage };
  const today = opts.today ?? new Date();
  // Stop starting VCs after 150 s: with Gemini capped at 110 s per call, the
  // last ones still finish inside Vercel's 300 s limit.
  const budget = opts.budgetMs ?? 150_000;
  if (opts.lock !== false && (await isRunActive())) throw new RunLockedError();
  const runId = await startRun(opts.trigger);
  const errors: RunError[] = [];
  const results: VcRunResult[] = [];
  let skipped = 0;

  try {
    let vcs = await loadVcs();
    if (opts.only) vcs = vcs.filter((v) => opts.only!.includes(v.seed_key ?? ""));
    // Highest priority first, so a time-boxed run covers the VCs that matter most.
    vcs.sort((a, b) => (a.priority ?? "P9").localeCompare(b.priority ?? "P9"));
    const profiles = new Map((await loadVcProfiles()).map((p) => [p.vc_id, p]));

    const batchItems: RawItem[] = [];
    for (const src of opts.batchSources ?? BATCH_SOURCES) {
      if (!src.fetchBatch) continue;
      try {
        batchItems.push(...(await src.fetchBatch(windowStart(today))));
      } catch (e) {
        errors.push({ source: src.name, message: (e as Error).message.slice(0, 300) });
      }
    }

    await mapLimit(vcs, opts.concurrency ?? 25, async (vc: Vc) => {
      if (Date.now() - started > budget) {
        skipped++;
        return;
      }
      try {
        const r = await processVc({
          vc,
          profile: profiles.get(vc.id) ?? null,
          sources: opts.sources ?? PER_VC_SOURCES,
          batchItems: matchBatch(batchItems, vc),
          runId,
          today,
        });
        results.push(r);
        errors.push(...r.errors);
      } catch (e) {
        errors.push({ vcId: vc.id, message: `vc failed: ${(e as Error).message.slice(0, 300)}` });
      }
    });
  } catch (e) {
    errors.push({ message: `run failed: ${(e as Error).message.slice(0, 300)}` });
  }

  const perSource: Record<string, number> = {};
  for (const r of results) for (const [k, n] of Object.entries(r.perSource)) perSource[k] = (perSource[k] ?? 0) + n;
  const durationMs = Date.now() - started;
  await finishRun(runId, {
    vcsProcessed: results.length,
    errors,
    usage: {
      durationMs,
      skippedForTime: skipped,
      perSource,
      newSignals: results.reduce((a, r) => a + r.newSignals, 0),
      // Per-VC diagnostics (compact) for debugging coverage.
      vcs: results.map((r) => ({
        vcId: r.vcId, raw: r.rawItems, rawBySource: r.perSource, model: r.modelSignals, stored: r.newSignals,
        rejected: r.rejected, score: r.score, action: r.action, diag: r.diag,
        errors: r.errors.map((e) => `${e.source ?? ""}: ${e.message.slice(0, 120)}`),
      })),
      exa: { calls: exaUsage.calls - exa0.calls, dollars: Number((exaUsage.dollars - exa0.dollars).toFixed(4)) },
      gemini: {
        calls: geminiUsage.calls - gem0.calls,
        inputTokens: geminiUsage.inputTokens - gem0.inputTokens,
        outputTokens: geminiUsage.outputTokens - gem0.outputTokens,
      },
    },
  }).catch((e) => errors.push({ message: `finishRun: ${(e as Error).message}` }));

  return { runId, processed: results.length, skipped, errors, results, durationMs };
}
