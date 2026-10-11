// Apply (or undo) a swap plan. Each round has its own plan file and undo.
//   npm run swap:apply -- --plan=data/swap-plan-2.json
//   npm run swap:undo  -- --plan=data/swap-plan-2.json
// (no --plan = data/swap-plan.json, round 1)
// Apply: archive OUT rows (kept, excluded from runs/dashboard), append IN rows to
// data/vc-seed-list.csv. Undo: un-archive OUT rows and archive IN rows, in the
// database and the CSV, without touching other rounds.
// Then: npm run seed && npm run profile (new rows get [DEMO] manual columns once).
import { readFileSync, writeFileSync } from "node:fs";
import { loadAllVcs, writeVcIdentifiers } from "../lib/db";
import { parseCsv } from "../lib/seed/csv";

type Plan = {
  round?: number;
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
const CSV = "data/vc-seed-list.csv";
const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const readCsv = () => parseCsv(readFileSync(CSV, "utf8"));
const writeCsv = (rows: Record<string, string>[]) =>
  writeFileSync(CSV, [HEADER.join(","), ...rows.map((r) => HEADER.map((h) => esc(r[h] ?? "")).join(","))].join("\n") + "\n");
const site = (w: string | null) => (w ? new URL(w).hostname.replace(/^www\./, "") : "");

async function apply(plan: Plan) {
  const rows = readCsv();
  const outKeys = new Map(plan.out.map((o) => [o.key, o.reason]));
  for (const k of outKeys.keys()) {
    const r = rows.find((x) => x.id === k);
    if (!r) throw new Error(`plan OUT row ${k} not in the CSV`);
    if (r.archived === "yes") throw new Error(`plan OUT row ${k} is already archived; was this plan applied already?`);
  }
  for (const c of plan.in) {
    if (rows.some((r) => (r.firm ?? "").toLowerCase() === c.name.toLowerCase() || (c.website && r.website && r.website === site(c.website)))) {
      throw new Error(`plan IN ${c.name} is already in the CSV; was this plan applied already?`);
    }
  }
  for (const r of rows) if (outKeys.has(r.id!)) Object.assign(r, { archived: "yes", archived_reason: `round ${plan.round ?? 1}: ${outKeys.get(r.id!)!}` });

  let next = Math.max(...rows.map((r) => Number(r.id!.replace(/\D/g, "")))) + 1;
  for (const c of plan.in) {
    const india = c.deals.some((d) => /india/i.test(d.country));
    rows.push({
      id: `vc${String(next++).padStart(2, "0")}`,
      firm: c.name,
      partner_name: c.partner ?? "",
      region: india ? "India" : `Global (${c.hq ?? "HQ unknown"})`,
      investor_type: c.investorType ?? "seed_fund",
      stage_focus: "pre-seed, seed",
      priority: c.deals.length >= 2 || c.score >= 60 ? "P1" : "P2",
      seed_fit: "leads",
      b2b_logistics_fit: "portfolio_only",
      inclusion_evidence: `Rubric swap-in round ${plan.round ?? 1} (score ${c.score}): ${c.deals.map((d) => `${d.role} ${d.stage} in ${d.company} (${d.sells}; ${d.date})`).join("; ")}`,
      evidence_source: c.deals.map((d) => d.urls[0]).join("; "),
      website: site(c.website),
      website_verified: c.website ? "yes" : "no",
      resolve_in_seed_script: "partner_name; portfolio_url; rss_url; linkedin_url",
    });
  }
  writeCsv(rows);

  const vcs = new Map((await loadAllVcs()).map((v) => [v.seed_key, v]));
  for (const [key, reason] of outKeys) {
    const vc = vcs.get(key);
    if (vc) await writeVcIdentifiers(vc.id, { archived: true, archived_reason: `round ${plan.round ?? 1}: ${reason}` });
  }
  console.log(`round ${plan.round ?? 1}: archived ${outKeys.size} rows; appended ${plan.in.length} rows. Next: npm run seed && npm run profile`);
}

async function undo(plan: Plan) {
  const rows = readCsv();
  const outKeys = new Set(plan.out.map((o) => o.key));
  const inRows = rows.filter((r) => plan.in.some((c) => (r.firm ?? "").toLowerCase() === c.name.toLowerCase()));
  for (const r of rows) if (outKeys.has(r.id!)) Object.assign(r, { archived: "", archived_reason: "" });
  for (const r of inRows) Object.assign(r, { archived: "yes", archived_reason: `round ${plan.round ?? 1} swap undone` });
  writeCsv(rows);

  const vcs = new Map((await loadAllVcs()).map((v) => [v.seed_key, v]));
  for (const k of outKeys) {
    const vc = vcs.get(k);
    if (vc) await writeVcIdentifiers(vc.id, { archived: false });
  }
  for (const r of inRows) {
    const vc = vcs.get(r.id!);
    if (vc) await writeVcIdentifiers(vc.id, { archived: true, archived_reason: `round ${plan.round ?? 1} swap undone` });
  }
  console.log(`round ${plan.round ?? 1} undone: un-archived ${outKeys.size}, archived ${inRows.length} swapped-in rows (CSV and database)`);
}

const planPath = process.argv.find((a) => a.startsWith("--plan="))?.slice(7) ?? "data/swap-plan.json";
const plan = JSON.parse(readFileSync(planPath, "utf8")) as Plan;
(process.argv.includes("--undo") ? undo(plan) : apply(plan)).catch((e) => {
  console.error(e);
  process.exit(1);
});
