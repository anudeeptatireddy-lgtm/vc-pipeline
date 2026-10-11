// Coverage diagnosis for the latest full run (or `-- <runId>`): per-source
// funnel and a per-VC "why not 60" table, from pipeline_runs.usage.
//   npm run diagnose [-- 12]
import { q } from "../lib/sql";

type Diag = {
  modelBySource: Record<string, number>;
  verifiedBySource: Record<string, number>;
  rejectedBySource: Record<string, Record<string, number>>;
  geminiFailed: boolean;
  window: { total: number; onThesis: number; latest: string | null; bestOnThesisValue: number };
};
type VcUsage = {
  vcId: string; raw: number; rawBySource: Record<string, number>; model: number; stored: number;
  rejected: Record<string, number>; score: number; action: string; diag: Diag; errors: string[];
};

const SOURCES: [string, string[]][] = [
  ["Gemini grounding (own finds)", ["gemini-grounding"]],
  ["News RSS (Bing; Google is robots-blocked)", ["news-rss"]],
  ["Web search (Tavily, Exa fallback)", ["web-search", "exa"]],
  ["LinkedIn via search index", ["linkedin-index"]],
  ["Podcast Index", ["podcast-index"]],
  ["YouTube", ["youtube"]],
  ["Firm / Substack RSS", ["firm-rss"]],
  ["Inc42 / YourStory", ["inc42", "yourstory"]],
  ["Trade press RSS", ["supply-chain-dive", "the-loadstar", "et-infra", "joc"]],
  ["Portfolio diff", ["portfolio-diff"]],
  ["SEC Form D", ["sec-form-d"]],
];

export function whyNot60(v: VcUsage): string {
  if (v.score >= 60) return "reached 60";
  const w = v.diag.window;
  if (w.onThesis > 0) return `on-thesis but weak (best signal value ${w.bestOnThesisValue})`;
  if (w.total > 0) return "items off-thesis";
  const rej = Object.entries(v.rejected).sort((a, b) => b[1] - a[1]);
  if (v.model > 0 && rej.length) {
    return rej[0]![0].startsWith("outside") ? "items too old" : `dropped by verification (${rej.map(([k, n]) => `${k} ${n}`).join(", ")})`;
  }
  if (v.diag.geminiFailed) return "source failed (Gemini timed out/errored)";
  if (v.raw === 0) return "no items";
  return "no items about this VC (Gemini found nothing relevant)";
}

async function main() {
  const arg = process.argv[2];
  const [run] = await q<{ id: number; started_at: string; usage: { vcs?: VcUsage[]; durationMs?: number; skippedForTime?: number }; errors: { source?: string; message: string }[] }>(
    arg
      ? "select id, started_at, usage, errors from pipeline_runs where id = $1"
      : "select id, started_at, usage, errors from pipeline_runs where usage ? 'vcs' and vcs_processed >= 40 order by id desc limit 1",
    arg ? [Number(arg)] : [],
  );
  if (!run?.usage.vcs) throw new Error("no run with diagnostics found");
  const vcs = run.usage.vcs;
  const meta = new Map(
    (await q<{ id: string; firm: string; priority: string | null }>("select id, firm, priority from vcs")).map((r) => [r.id, r]),
  );

  console.log(`Run ${run.id} (${run.started_at}): ${vcs.length} VCs, ${Math.round((run.usage.durationMs ?? 0) / 1000)} s, ${run.usage.skippedForTime ?? 0} skipped for time\n`);
  console.log("SOURCE FUNNEL");
  console.log("source | raw items | sent on by Gemini | verified + stored | rejected | errors | VCs with 0 raw items");
  for (const [label, keys] of SOURCES) {
    const sum = (f: (v: VcUsage) => number) => vcs.reduce((a, v) => a + f(v), 0);
    const pick = (o: Record<string, number> | undefined) => keys.reduce((a, k) => a + (o?.[k] ?? 0), 0);
    const raw = keys[0] === "gemini-grounding" ? sum((v) => pick(v.diag.modelBySource)) : sum((v) => pick(v.rawBySource));
    const model = sum((v) => pick(v.diag.modelBySource));
    const stored = sum((v) => pick(v.diag.verifiedBySource));
    const rejected = sum((v) => keys.reduce((a, k) => a + Object.values(v.diag.rejectedBySource[k] ?? {}).reduce((x, y) => x + y, 0), 0));
    const errs = vcs.reduce((a, v) => a + v.errors.filter((e) => keys.some((k) => e.startsWith(`${k}:`))).length, 0)
      + run.errors.filter((e) => keys.includes(e.source ?? "") && !("vcId" in e)).length;
    const empty = vcs.filter((v) => pick(v.rawBySource) === 0).length;
    console.log(`${label} | ${raw} | ${model} | ${stored} | ${rejected} | ${errs} | ${keys[0] === "gemini-grounding" ? "-" : empty}`);
  }
  const rejAll: Record<string, number> = {};
  for (const v of vcs) for (const [k, n] of Object.entries(v.rejected)) rejAll[k] = (rejAll[k] ?? 0) + n;
  console.log(`\nRejection reasons (all sources): ${JSON.stringify(rejAll)}`);
  console.log(`Gemini failures: ${vcs.filter((v) => v.diag.geminiFailed).length} VCs`);

  console.log("\nPER VC");
  console.log("firm | priority | items found | items verified (stored this run) | direct/thematic in 30 days (stored) | score | action | why not 60");
  const rows = vcs
    .map((v) => ({ v, m: meta.get(v.vcId) }))
    .sort((a, b) => (a.m?.priority ?? "").localeCompare(b.m?.priority ?? "") || b.v.score - a.v.score);
  for (const { v, m } of rows) {
    console.log(
      `${m?.firm ?? v.vcId} | ${m?.priority ?? "-"} | ${v.raw} | ${v.stored} | ${v.diag.window.onThesis}/${v.diag.window.total} | ${v.score} | ${v.action} | ${whyNot60(v)}`,
    );
  }
  const reasons: Record<string, number> = {};
  for (const { v } of rows) {
    const r = whyNot60(v).replace(/ \(.*\)$/, "");
    reasons[r] = (reasons[r] ?? 0) + 1;
  }
  console.log(`\nWhy-not-60 totals: ${JSON.stringify(reasons)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
