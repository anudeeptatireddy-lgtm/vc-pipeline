// Discovered investors that didn't make the list -> suggested_vcs ("Not on your list yet").
// Each row keeps its deal evidence and why it isn't on the list.
//   npx tsx --env-file=.env.local scripts/suggest-from-lookup.ts
import { readFileSync } from "node:fs";
import { q } from "../lib/sql";

type Cand = { name: string; score: number; qualifies: boolean; reasons: string[]; deals: { company: string; stage: string; date: string; urls: string[]; role: string; sells: string }[] };

const cands = (JSON.parse(readFileSync("data/candidates.json", "utf8")) as Cand[])
  .filter((c) => !c.qualifies && !c.reasons.some((r) => /duplicate|corporate|venture debt|lookup failed/.test(r)))
  .sort((a, b) => b.score - a.score)
  .slice(0, 15);

const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** One thing the founder should know before reaching out, from why the firm isn't on the list. */
function caveatFor(reasons: string[]): string {
  const r = reasons.join(" ");
  if (/india/i.test(r)) return "No India deals or India mandate found, so expect to explain why an Indian company fits.";
  if (/website/i.test(r)) return "We couldn't verify the firm's website. Check who they are before reaching out.";
  if (/stage|series/i.test(r)) return "Mostly invests later than seed. Worth a look once you have more traction.";
  return "Not checked as closely as the investors on your list. Read the evidence first.";
}

let n = 0;
for (const c of cands) {
  const d = c.deals[0]!;
  const why = c.reasons.join("; ").replace("not India-accessible (no India deal or verifiable India mandate)", "no India deal or India mandate found");
  const reason = `${d.role === "led" ? "Led" : "Co-led"} the ${d.stage} round in ${d.company} (${d.sells}) on ${d.date}${c.deals.length > 1 ? ` and ${c.deals.length - 1} more` : ""}. Not added: ${why}.`;
  // Lower-case the first letter unless it starts an acronym ("AI digital workers").
  const sells = /^[A-Z][a-z]/.test(d.sells) ? d.sells.charAt(0).toLowerCase() + d.sells.slice(1) : d.sells;
  const summary = `${d.role === "led" ? "Led" : "Co-led"} the ${d.stage} round in ${d.company}, ${sells}, on ${fmtDate(d.date)}.${c.deals.length > 1 ? ` Plus ${c.deals.length - 1} more logistics deal${c.deals.length > 2 ? "s" : ""} this year.` : ""}`;
  const rows = await q(
    `insert into suggested_vcs (firm, partner_name, reason, evidence_urls, rubric_score, deal_count, summary, caveat)
     select $1, null, $2, $3, $4, $5, $6, $7 where not exists (select 1 from suggested_vcs where firm = $1) returning id`,
    [c.name, reason, c.deals.flatMap((x) => x.urls).slice(0, 3), c.score, c.deals.length, summary, caveatFor(c.reasons)],
  );
  // Rows from earlier runs: fill in the score and founder copy.
  await q(
    "update suggested_vcs set rubric_score = $2, deal_count = $3, summary = $4, caveat = $5 where firm = $1",
    [c.name, c.score, c.deals.length, summary, caveatFor(c.reasons)],
  );
  n += rows.length;
}
console.log(`inserted ${n} suggested VCs, scored ${cands.length}`);
