// Vertical slice (build-plan Phase 3): run the pipeline for named VCs.
//   npm run run-one -- vc01 vc12
import { finishRun, loadVcProfiles, loadVcs, startRun } from "../lib/db";
import { exaUsage } from "../lib/exa";
import { geminiUsage } from "../lib/gemini";
import { processVc } from "../lib/pipeline";
import { exaSource } from "../lib/sources/exa";

async function main() {
  const keys = process.argv.slice(2);
  if (keys.length === 0) throw new Error("usage: npm run run-one -- vc01 [vc02 ...]");
  const vcs = (await loadVcs()).filter((v) => keys.includes(v.seed_key ?? ""));
  const profiles = new Map((await loadVcProfiles()).map((p) => [p.vc_id, p]));
  const runId = await startRun("script");
  const errors = [];
  for (const vc of vcs) {
    const r = await processVc({ vc, profile: profiles.get(vc.id) ?? null, sources: [exaSource], runId });
    console.log(JSON.stringify(r, null, 2));
    errors.push(...r.errors);
  }
  await finishRun(runId, { vcsProcessed: vcs.length, errors, usage: { exa: exaUsage, gemini: geminiUsage } });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
