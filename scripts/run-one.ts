// Run the pipeline locally.
//   npm run run-one -- vc01 vc12     # named VCs
//   npm run run-one -- --all         # everyone (same as the cron run)
import { runPipeline } from "../lib/run";

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const only = args.filter((a) => !a.startsWith("--"));
  if (!all && only.length === 0) throw new Error("usage: npm run run-one -- vc01 [vc02 ...] | --all");

  const s = await runPipeline({ trigger: "script", only: all ? undefined : only });
  for (const r of s.results.sort((a, b) => b.score - a.score)) {
    const rej = Object.entries(r.rejected).map(([k, n]) => `${k}:${n}`).join(", ");
    console.log(
      `${String(r.score).padStart(3)}  ${r.action.padEnd(30)} ${r.firm}\n` +
        `     ${r.summary}\n     raw=${r.rawItems} model=${r.modelSignals} new=${r.newSignals}` +
        ` sources=${JSON.stringify(r.perSource)}${rej ? ` rejected={${rej}}` : ""}`,
    );
  }
  console.log(`\nrun ${s.runId}: ${s.processed} processed, ${s.skipped} skipped for time, ${(s.durationMs / 1000).toFixed(0)}s`);
  for (const e of s.errors) console.log(`  error ${e.source ?? ""} ${e.message}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
