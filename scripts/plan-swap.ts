// Decide the swap by the rubric (no approval gate, per the owner's rules):
//   OUT: rows that can't produce reach-out rows by design: Series A+ only,
//        venture debt, no verified website, no logistics activity in 12 months.
//   IN:  qualifying candidates (data/candidates.json), highest rubric score first.
//   n = min(#out, #qualifying, 15). 4–6 quiet-but-real funds are protected.
// Writes data/swap-plan.json. Changes nothing.
//   npx tsx --env-file=.env.local scripts/plan-swap.ts
import { readFileSync, writeFileSync } from "node:fs";
import { loadVcProfiles, loadVcs } from "../lib/db";
import { q } from "../lib/sql";
import { parseCsv, toSeedRows } from "../lib/seed/csv";

const CAP = 15;

async function main() {
  const vcs = await loadVcs();
  const profiles = new Map((await loadVcProfiles()).map((p) => [p.vc_id, p]));
  const csv = new Map(toSeedRows(parseCsv(readFileSync("data/vc-seed-list.csv", "utf8"))).map((r) => [r.id, r]));
  const activity = JSON.parse(readFileSync("data/swap-out-check.json", "utf8")) as Record<string, { status: "found" | "none" | "unknown"; logisticsDeals: { company: string; date: string; url: string; role: string }[] }>;
  const candidates = (JSON.parse(readFileSync("data/candidates.json", "utf8")) as { qualifies: boolean; score: number; name: string }[]).filter((c) => c.qualifies);
  const onThesis30 = new Map(
    (await q<{ vc_id: string; n: number }>(
      "select vc_id, count(*)::int n from signals where published_date >= current_date - 30 and logistics_relevance in ('direct','thematic') group by vc_id",
    )).map((r) => [r.vc_id, r.n]),
  );

  // Why each VC can't produce reach-out rows by design (first matching reason wins).
  const outs: { key: string; firm: string; reason: string; rank: number }[] = [];
  for (const v of vcs) {
    const p = profiles.get(v.id);
    const row = csv.get(v.seed_key ?? "");
    const deals = activity[v.id]?.logisticsDeals ?? [];
    let reason: string | null = null;
    let rank = 9;
    if (row?.investor_type === "venture_debt_likely" || /venture debt/i.test(row?.inclusion_evidence ?? "")) [reason, rank] = ["venture debt", 0];
    else if (p?.does_seed === "series_a_plus_only") [reason, rank] = ["Series A+ only (profile)", 1];
    else if (!v.website) [reason, rank] = ["no verified website", 2];
    // Only a completed check with nothing found counts; "unknown" (check failed) never archives a fund.
    else if (activity[v.id]?.status === "none" && deals.length === 0) [reason, rank] = ["no logistics activity found in 12 months", 3];
    if (reason) outs.push({ key: v.seed_key!, firm: v.firm, reason, rank: rank * 10 + (v.priority === "P3" ? 0 : v.priority === "P2" ? 1 : 2) });
  }
  outs.sort((a, b) => a.rank - b.rank);

  // Quiet-but-real keepers: verified site, logistics activity in 12 months, nothing on-thesis in 30 days.
  const quiet = vcs
    .filter((v) => v.website && (activity[v.id]?.logisticsDeals.length ?? 0) > 0 && !onThesis30.get(v.id) && !outs.some((o) => o.key === v.seed_key))
    .sort((a, b) => (a.priority ?? "P9").localeCompare(b.priority ?? "P9") || (activity[b.id]!.logisticsDeals.length - activity[a.id]!.logisticsDeals.length))
    .slice(0, 6)
    .map((v) => ({
      key: v.seed_key!, firm: v.firm,
      why: `Real logistics investor (latest: ${activity[v.id]!.logisticsDeals.map((d) => `${d.company} ${d.date}`).slice(0, 2).join("; ")}) but no B2B-logistics signal in the last 30 days`,
    }));

  const n = Math.min(outs.length, candidates.length, CAP);
  const plan = {
    createdAt: new Date().toISOString(),
    rule: "n = min(rows that can't produce reach-out rows by design, qualifying candidates, 15)",
    out: outs.slice(0, n),
    notSwappedOutButFlagged: outs.slice(n),
    in: candidates.slice(0, n),
    quietKept: quiet,
  };
  writeFileSync("data/swap-plan.json", JSON.stringify(plan, null, 2) + "\n");
  console.log(`OUT (${plan.out.length}):`);
  for (const o of plan.out) console.log(`  ${o.key} ${o.firm}: ${o.reason}`);
  console.log(`IN (${plan.in.length}):`);
  for (const c of plan.in) console.log(`  ${c.score.toFixed(1)} ${c.name}`);
  console.log(`Flagged but kept (no qualifying replacement): ${plan.notSwappedOutButFlagged.map((o) => `${o.firm} (${o.reason})`).join("; ") || "none"}`);
  console.log(`Quiet kept on purpose: ${quiet.map((q) => q.firm).join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
