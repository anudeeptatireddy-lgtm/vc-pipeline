// "Manual columns untouched" check (docs/signal-sources.md §DB, CLAUDE.md).
// Snapshots Vikram's columns on every row, runs the pipeline, compares.
//   npm run check:manual               # runs vc02
//   npm run check:manual -- vc01 vc12
import { q } from "../lib/sql";
import { runPipeline } from "../lib/run";

const MANUAL = ["name", "firm", "thesis", "status", "last_contact_date", "contact_history", "personal_notes"] as const;

async function snapshot() {
  const rows = await q(`select id, ${MANUAL.join(", ")} from vcs order by id`);
  return new Map(rows.map((r) => [r.id as string, JSON.stringify(MANUAL.map((c) => r[c]))]));
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const before = await snapshot();
  const s = await runPipeline({ trigger: "script", only: only.length ? only : ["vc02"] });
  const after = await snapshot();
  const changed = [...before].filter(([id, v]) => after.get(id) !== v).map(([id]) => id);
  console.log(`run ${s.runId}: ${s.processed} VC(s) processed; ${before.size} rows compared`);
  if (s.processed === 0) {
    console.error(`FAIL: no VC was processed, so the check proves nothing. Errors: ${s.errors.map((e) => e.message).join(" | ")}`);
    process.exit(1);
  }
  if (changed.length || after.size !== before.size) {
    console.error(`FAIL: manual columns changed on ${changed.join(", ") || "row count"}`);
    process.exit(1);
  }
  console.log("PASS: every manual column is identical after the run");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
