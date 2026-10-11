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

let n = 0;
for (const c of cands) {
  const d = c.deals[0]!;
  const why = c.reasons.join("; ").replace("not India-accessible (no India deal or verifiable India mandate)", "no India deal or India mandate found");
  const reason = `${d.role === "led" ? "Led" : "Co-led"} the ${d.stage} round in ${d.company} (${d.sells}) on ${d.date}${c.deals.length > 1 ? ` and ${c.deals.length - 1} more` : ""}. Not added: ${why}.`;
  const rows = await q(
    `insert into suggested_vcs (firm, partner_name, reason, evidence_urls)
     select $1, null, $2, $3 where not exists (select 1 from suggested_vcs where firm = $1) returning id`,
    [c.name, reason, c.deals.flatMap((x) => x.urls).slice(0, 3)],
  );
  n += rows.length;
}
console.log(`inserted ${n} suggested VCs (of ${cands.length} considered)`);
