// Apply (or undo) data/swap-plan.json.
//   npm run swap:apply     archive OUT rows (kept, excluded from runs/dashboard),
//                          append IN rows to data/vc-seed-list.csv
//   npm run swap:undo      un-archive OUT rows, archive IN rows,
//                          restore the CSV from the pre-swap git tag
// Then: npm run seed && npm run profile (new rows get [DEMO] manual columns once).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { loadAllVcs, writeVcIdentifiers } from "../lib/db";
import { parseCsv } from "../lib/seed/csv";

type Plan = {
  out: { key: string; firm: string; reason: string }[];
  in: {
    name: string; score: number; website: string | null; hq: string | null; investorType: string | null; partner: string | null;
    deals: { company: string; sells: string; to: string; country: string; stage: string; date: string; urls: string[]; role: string }[];
  }[];
};

const HEADER = [
  "id", "firm", "partner_name", "region", "investor_type", "stage_focus", "priority", "seed_fit", "b2b_logistics_fit",
  "inclusion_evidence", "evidence_source", "website", "website_verified", "resolve_in_seed_script", "archived", "archived_reason",
];

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const writeCsv = (rows: Record<string, string>[]) =>
  writeFileSync("data/vc-seed-list.csv", [HEADER.join(","), ...rows.map((r) => HEADER.map((h) => esc(r[h] ?? "")).join(","))].join("\n") + "\n");

async function apply(plan: Plan) {
  const rows = parseCsv(readFileSync("data/vc-seed-list.csv", "utf8"));
  if (rows.some((r) => r.archived === "yes")) throw new Error("CSV already has archived rows; run swap:undo first or edit by hand");
  const outKeys = new Map(plan.out.map((o) => [o.key, o.reason]));
  for (const r of rows) if (outKeys.has(r.id!)) Object.assign(r, { archived: "yes", archived_reason: outKeys.get(r.id!)! });

  let next = Math.max(...rows.map((r) => Number(r.id!.replace(/\D/g, "")))) + 1;
  for (const c of plan.in) {
    const india = c.deals.some((d) => /india/i.test(d.country));
    const ledCount = c.deals.length;
    rows.push({
      id: `vc${String(next++).padStart(2, "0")}`,
      firm: c.name,
      partner_name: c.partner ?? "",
      region: india ? "India" : `Global (${c.hq ?? "HQ unknown"})`,
      investor_type: c.investorType ?? "seed_fund",
      stage_focus: "pre-seed, seed",
      priority: ledCount >= 2 || c.score >= 60 ? "P1" : "P2",
      seed_fit: "leads",
      b2b_logistics_fit: "portfolio_only",
      inclusion_evidence: `Rubric swap-in (score ${c.score}): ${c.deals.map((d) => `${d.role} ${d.stage} in ${d.company} (${d.sells}; ${d.date})`).join("; ")}`,
      evidence_source: c.deals.map((d) => d.urls[0]).join("; "),
      website: c.website ? new URL(c.website).hostname.replace(/^www\./, "") : "",
      website_verified: c.website ? "yes" : "no",
      resolve_in_seed_script: "partner_name; portfolio_url; rss_url; linkedin_url",
    });
  }
  writeCsv(rows);

  const vcs = new Map((await loadAllVcs()).map((v) => [v.seed_key, v]));
  for (const [key, reason] of outKeys) {
    const vc = vcs.get(key);
    if (vc) await writeVcIdentifiers(vc.id, { archived: true, archived_reason: reason });
  }
  console.log(`archived ${outKeys.size} rows; appended ${plan.in.length} rows to the CSV. Next: npm run seed && npm run profile`);
}

async function undo(plan: Plan) {
  const vcs = await loadAllVcs();
  const bySeed = new Map(vcs.map((v) => [v.seed_key, v]));
  for (const o of plan.out) {
    const vc = bySeed.get(o.key);
    if (vc) await writeVcIdentifiers(vc.id, { archived: false });
  }
  const original = new Set(parseCsv(execFileSync("git", ["show", "pre-swap:data/vc-seed-list.csv"], { encoding: "utf8" })).map((r) => r.id));
  let n = 0;
  for (const vc of vcs) {
    if (vc.seed_key && !original.has(vc.seed_key) && !vc.archived) {
      await writeVcIdentifiers(vc.id, { archived: true, archived_reason: "swap undone" });
      n++;
    }
  }
  execFileSync("git", ["checkout", "pre-swap", "--", "data/vc-seed-list.csv"]);
  console.log(`un-archived ${plan.out.length} rows, archived ${n} swapped-in rows, restored the CSV from tag pre-swap`);
}

const plan = JSON.parse(readFileSync("data/swap-plan.json", "utf8")) as Plan;
(process.argv.includes("--undo") ? undo(plan) : apply(plan)).catch((e) => {
  console.error(e);
  process.exit(1);
});
