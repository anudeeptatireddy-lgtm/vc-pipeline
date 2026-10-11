// One VC through the pipeline: sources → Gemini → verify → score → RPC.
// Every source call is isolated (CLAUDE.md rule 6): a failure is recorded and
// the VC still gets scored from whatever else is available.
import {
  insertSignals, loadClassifications, loadRecentSignals, recordScoreHistory, updateClassification, updateCorroboration, writeVcSignals,
  type RunError, type SignalRow, type VcProfile,
} from "./db";
import { firmFit, followUpScore, logisticsRelevance, recommendedAction, signalSummary, signalValue } from "./score";
import { parseVerdict, verdictKey, vote } from "./classify";
import { mapLimit } from "./http";
import type { Entry } from "./portfolio";
import { extractSignals, type ModelSignal } from "./sources/gemini-grounding";
import { detectPortfolioAdditions } from "./sources/portfolio-diff";
import { TIER_CONFIDENCE, tierForUrl } from "./sources/tiers";
import type { RawItem, RecommendedAction, SignalSource, Vc, VerifiedSignal } from "./types";
import { triangulate } from "./triangulate";
import { canonicalUrl, dedupe, toDay, verifyCandidate, WINDOW_DAYS } from "./verify";

export interface VcRunResult {
  vcId: string;
  firm: string;
  rawItems: number;
  modelSignals: number;
  newSignals: number;
  rejected: Record<string, number>;
  score: number;
  action: RecommendedAction;
  summary: string;
  errors: RunError[];
  perSource: Record<string, number>;
  timings: Record<string, number>;
  diag: VcDiagnostics;
}

/** Step-0 diagnostics: where items came from and where they were lost. Changes no behaviour. */
export interface VcDiagnostics {
  modelBySource: Record<string, number>; // Gemini signals, attributed to the source whose URL they matched
  verifiedBySource: Record<string, number>; // stored this run, after verification + dedupe
  rejectedBySource: Record<string, Record<string, number>>;
  rejectedSamples: { url: string; reason: string; title: string }[];
  geminiFailed: boolean;
  window: { total: number; onThesis: number; latest: string | null; bestOnThesisValue: number };
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** dashboard-design.md §7: drop copy lines over 40 words or on off-thesis signals. */
function copyLine(line: string | undefined, onThesis: boolean): string | null {
  if (!onThesis || !line?.trim()) return null;
  return words(line) <= 40 ? line.trim() : null;
}

export function windowStart(today: Date): Date {
  return new Date(today.getTime() - WINDOW_DAYS * 86_400_000);
}

export async function processVc(opts: {
  vc: Vc;
  profile: VcProfile | null;
  sources: SignalSource[];
  batchItems?: RawItem[]; // from fetchBatch sources, already matched to this VC
  runId: number;
  today?: Date;
  portfolioDiff?: boolean; // default true
}): Promise<VcRunResult> {
  const { vc, profile, sources, runId } = opts;
  const today = opts.today ?? new Date();
  const since = windowStart(today);
  const errors: RunError[] = [];
  const perSource: Record<string, number> = {};
  const rejected: Record<string, number> = {};
  const diag: VcDiagnostics = {
    modelBySource: {}, verifiedBySource: {}, rejectedBySource: {}, rejectedSamples: [], geminiFailed: false,
    window: { total: 0, onThesis: 0, latest: null, bestOnThesisValue: 0 },
  };
  const bump = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);

  const timings: Record<string, number> = {};
  const t0 = Date.now();

  // 3b (started early). Portfolio page diff runs alongside everything else.
  const portfolioTask =
    opts.portfolioDiff !== false && vc.portfolio_url
      ? detectPortfolioAdditions(vc, today).then(
          (p) => ({ ok: true as const, ...p, ms: Date.now() - t0 }),
          (e: Error) => ({ ok: false as const, error: e.message, ms: Date.now() - t0 }),
        )
      : null;

  // 1. Collect raw items: all sources in parallel, each isolated; fallbacks only if nothing came back.
  const raw: RawItem[] = [...(opts.batchItems ?? [])];
  for (const b of opts.batchItems ?? []) perSource[b.source] = (perSource[b.source] ?? 0) + 1;
  const runSources = async (list: SignalSource[]) => {
    const active = list.filter((src) => src.fetchForVc && src.enabled(vc));
    const settled = await Promise.allSettled(active.map((src) => src.fetchForVc!(vc, since)));
    settled.forEach((r, i) => {
      const name = active[i]!.name;
      if (r.status === "fulfilled") {
        perSource[name] = (perSource[name] ?? 0) + r.value.length;
        raw.push(...r.value);
      } else {
        errors.push({ vcId: vc.id, source: name, message: String(r.reason?.message ?? r.reason).slice(0, 300) });
      }
    });
  };
  await runSources(sources.filter((src) => !src.fallbackOnly));
  if (raw.length === 0) await runSources(sources.filter((src) => src.fallbackOnly));
  timings.sources = Date.now() - t0;

  const byUrl = new Map<string, RawItem>();
  for (const r of raw) {
    try {
      byUrl.set(canonicalUrl(r.url), r);
    } catch {}
  }

  // 2. Gemini: classify collected items + search for more.
  let modelSignals: ModelSignal[] = [];
  try {
    const out = await extractSignals(vc, profile, raw, today);
    modelSignals = out.is_same_person_or_firm || out.signals.length === 0 ? out.signals : [];
    if (!out.is_same_person_or_firm && out.signals.length) rejected["namesake"] = out.signals.length;
  } catch (e) {
    errors.push({ vcId: vc.id, source: "gemini-grounding", message: (e as Error).message.slice(0, 300) });
    diag.geminiFailed = true;
  }
  perSource["gemini-grounding"] = modelSignals.length;
  timings.gemini = Date.now() - t0 - timings.sources;

  // 3. Verify each in code, a few at a time.
  const verified: VerifiedSignal[] = [];
  const tv = Date.now();
  await mapLimit(modelSignals, 5, async (m) => {
    let rawItem: RawItem | undefined;
    try {
      rawItem = byUrl.get(canonicalUrl(m.source_url));
    } catch {}
    const v = await verifyCandidate(
      {
        url: m.source_url,
        title: m.title ?? rawItem?.title,
        publisherUrl: rawItem?.publisher,
        rssDate: rawItem?.publishedAt,
        modelDate: m.published_date || undefined,
        evidence: m.evidence_quote,
      },
      { firm: vc.firm, partnerName: vc.partner_name },
      today,
    ).catch((e): { reject: string } => ({ reject: `verify error: ${(e as Error).message.slice(0, 80)}` }));
    const srcName = rawItem?.source ?? "gemini-grounding";
    bump(diag.modelBySource, srcName);
    if ("reject" in v) {
      const key = v.reject.replace(/\s*\(.*\)$/, "");
      rejected[key] = (rejected[key] ?? 0) + 1;
      bump((diag.rejectedBySource[srcName] ??= {}), key);
      if (diag.rejectedSamples.length < 6) diag.rejectedSamples.push({ url: m.source_url, reason: v.reject, title: (m.title ?? m.summary_one_line).slice(0, 120) });
      return;
    }
    const relevance = logisticsRelevance(m.sector_fit, m.customer_type, m.offering_type);
    const tier = rawItem && canonicalUrl(rawItem.url) === canonicalUrl(v.url) ? rawItem.sourceTier : tierForUrl(v.url, vc);
    const onThesis = relevance === "direct" || relevance === "thematic";
    verified.push({
      vc_id: vc.id,
      signal_type: m.signal_type,
      summary: m.summary_one_line.trim(),
      source_url: v.url,
      source_name: rawItem?.source ?? "gemini-grounding",
      source_tier: tier,
      published_date: v.publishedDate,
      evidence_quote: m.evidence_quote?.trim() || null,
      company_name: m.company_name?.trim() || null,
      round_stage: m.round_stage,
      sector_fit: m.sector_fit,
      customer_type: m.customer_type,
      offering_type: m.offering_type,
      logistics_relevance: relevance,
      // Tier sets the ceiling; the model's own confidence scales within it.
      confidence: Number((TIER_CONFIDENCE[tier] * (0.5 + 0.5 * m.confidence)).toFixed(3)),
      opening_line: copyLine(m.opening_line, onThesis),
      nudge_line: copyLine(m.nudge_line, onThesis),
      corroborated_by: null,
    });
  });
  timings.verify = Date.now() - tv;

  // 3b. Collect the portfolio diff started at the top.
  let portfolio: { runs: number; entries: Entry[] } | null = null;
  if (portfolioTask) {
    const p = await portfolioTask;
    timings.portfolio = p.ms;
    if (p.ok) {
      perSource["portfolio-diff"] = p.signals.length;
      verified.push(...p.signals);
      if (!p.skipped) portfolio = { runs: p.runs, entries: p.current };
    } else {
      errors.push({ vcId: vc.id, source: "portfolio-diff", message: p.error.slice(0, 300) });
    }
  }

  // 4. Dedupe and store. Pages already stored get a classification vote
  //    (majority wins, lib/classify.ts); new pages are inserted with their first vote.
  const fresh: SignalRow[] = dedupe(verified).map((s) => ({
    ...s,
    signal_value: Number(signalValue(s, today).toFixed(3)),
    classification_votes: { [verdictKey(s)]: 1 },
  }));
  try {
    const stored = new Map((await loadClassifications(vc.id, fresh.map((f) => f.source_url))).map((c) => [c.source_url, c]));
    await insertSignals(fresh.filter((f) => !stored.has(f.source_url)));
    for (const f of fresh) {
      const prev = stored.get(f.source_url);
      if (!prev) continue;
      const { votes, winner } = vote(prev, prev.classification_votes ?? {}, f);
      const changed = winner !== verdictKey(prev);
      const w = parseVerdict(winner);
      const relevance = logisticsRelevance(w.sector_fit as never, w.customer_type as never, w.offering_type as never);
      const value = signalValue({ ...f, ...w, round_stage: w.round_stage as never, logistics_relevance: relevance }, today);
      await updateClassification(vc.id, f.source_url, { ...w, logistics_relevance: relevance, signal_value: Number(value.toFixed(3)) }, votes, changed);
      if (changed) bump(diag.verifiedBySource, "reclassified");
    }
  } catch (e) {
    errors.push({ vcId: vc.id, source: "db", message: (e as Error).message.slice(0, 300) });
  }

  // 5. Score over everything stored in the window (earlier runs included),
  //    so a quiet run doesn't erase last week's evidence.
  let window: SignalRow[] = fresh;
  try {
    window = dedupe(await loadRecentSignals(vc.id, toDay(since)));
  } catch (e) {
    errors.push({ vcId: vc.id, source: "db", message: (e as Error).message.slice(0, 300) });
  }
  // §8.2 corroboration; persist what changed so the dashboard shows it.
  const changed = triangulate(window, portfolio);
  if (changed.length) {
    await updateCorroboration(
      changed.map((s) => ({
        vc_id: s.vc_id, source_url: s.source_url, corroborated_by: s.corroborated_by, confidence: s.confidence,
        signal_value: Number(signalValue(s, today).toFixed(3)),
      })),
    ).catch((e) =>
      errors.push({ vcId: vc.id, source: "db", message: (e as Error).message.slice(0, 300) }),
    );
  }
  for (const f of fresh) bump(diag.verifiedBySource, f.source_name);
  const onThesis = window.filter((s) => s.logistics_relevance === "direct" || s.logistics_relevance === "thematic");
  diag.window = {
    total: window.length,
    onThesis: onThesis.length,
    latest: window.length ? window.map((s) => s.published_date).sort().at(-1)! : null,
    bestOnThesisValue: Number(Math.max(0, ...onThesis.map((s) => signalValue(s, today))).toFixed(1)),
  };
  const score = followUpScore(window, firmFit(profile), today);
  const action = recommendedAction(score, vc.status, vc.last_contact_date, today);
  const summary = signalSummary(window, today);
  const lastSignalDate = window.length ? window.map((s) => s.published_date).sort().at(-1)! : null;

  await writeVcSignals(vc.id, { lastSignalDate, signalSummary: summary, followUpScore: score, recommendedAction: action });
  await recordScoreHistory(vc.id, runId, score, action).catch((e) =>
    errors.push({ vcId: vc.id, source: "db", message: (e as Error).message.slice(0, 300) }),
  );

  timings.total = Date.now() - t0;
  return {
    vcId: vc.id, firm: vc.firm, rawItems: raw.length, modelSignals: modelSignals.length, newSignals: fresh.length,
    rejected, score, action, summary, errors, perSource, timings, diag,
  };
}
