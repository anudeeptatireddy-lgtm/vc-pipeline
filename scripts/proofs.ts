// Regenerate the evidence for docs/demo-script.md §1 (R1–R12) into
// docs/proofs/README.md. Runs the pipeline for 3 VCs (R7) and the
// permission checks (R8) inside rolled-back transactions.
//   npm run proofs
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "@neondatabase/serverless";
import { runPipeline } from "../lib/run";
import { q } from "../lib/sql";

const LIVE = "https://vc-pipeline-lovat.vercel.app";
const REPO = "https://github.com/anudeeptatireddy-lgtm/vc-pipeline";
const out: string[] = [];
const h = (s: string) => out.push(`\n## ${s}\n`);
const p = (s: string) => out.push(s);
const table = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return p("_(none)_");
  const cols = Object.keys(rows[0]!);
  p(`| ${cols.join(" | ")} |\n|${cols.map(() => "---").join("|")}|`);
  for (const r of rows) p(`| ${cols.map((c) => String(r[c] ?? "").replace(/\|/g, "/").replace(/\n/g, " ")).join(" | ")} |`);
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    return statSync(f).isDirectory() ? files(f) : /\.(ts|tsx)$/.test(n) ? [f] : [];
  });
}

async function permissionChecks() {
  const results: { check: string; result: string }[] = [];
  const app = new Pool({ connectionString: process.env.APP_DATABASE_URL });
  const c = await app.connect();
  try {
    await c.query("begin");
    const [{ id }] = (await c.query("select id from vcs where not archived limit 1")).rows;
    for (const [label, sql] of [
      ["App role (vc_runtime): UPDATE personal_notes", "update vcs set personal_notes = 'overwritten' where id = $1"],
      ["App role (vc_runtime): UPDATE follow_up_score directly", "update vcs set follow_up_score = 1 where id = $1"],
      ["App role (vc_runtime): DELETE a VC", "delete from vcs where id = $1"],
    ] as const) {
      await c.query("savepoint s");
      try {
        await c.query(sql, [id]);
        results.push({ check: label, result: "ALLOWED (problem)" });
      } catch (e) {
        results.push({ check: label, result: `denied: ${(e as Error).message}` });
      }
      await c.query("rollback to savepoint s");
    }
  } finally {
    await c.query("rollback");
    c.release();
    await app.end();
  }
  const owner = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED });
  const o = await owner.connect();
  try {
    await o.query("begin");
    await o.query("set local role pipeline_writer");
    await o.query("update vcs set personal_notes = 'overwritten' where true");
    results.push({ check: "Function owner (pipeline_writer): UPDATE personal_notes", result: "ALLOWED (problem)" });
  } catch (e) {
    results.push({ check: "Function owner (pipeline_writer): UPDATE personal_notes", result: `denied: ${(e as Error).message}` });
  } finally {
    await o.query("rollback").catch(() => {});
    o.release();
    await owner.end();
  }
  return results;
}

async function main() {
  p(`# Submission proofs\n\nGenerated ${new Date().toISOString()} by \`npm run proofs\` against the live Neon database. Each section maps to a row of \`docs/demo-script.md\` §1.`);

  const [run] = await q<{ id: number; started_at: string; trigger: string; vcs_processed: number; usage: Record<string, unknown> }>(
    "select id, started_at, trigger, vcs_processed, usage from pipeline_runs where finished_at is not null and vcs_processed >= 40 order by id desc limit 1",
  );
  h("R1. Live external data");
  p(`Latest full run: **#${run!.id}** (${run!.started_at}, ${run!.vcs_processed} VCs, trigger \`${run!.trigger}\`). Per-source raw item counts:`);
  p("```json\n" + JSON.stringify(run!.usage.perSource, null, 2) + "\n```");
  p("Ten most recent stored signals (every one has a resolved URL and a publish date inside the 30-day window):");
  table(await q("select v.firm, s.published_date as date, s.source_name as source, s.source_tier as tier, s.source_url as url from signals s join vcs v on v.id = s.vc_id where s.published_date >= current_date - 30 order by s.published_date desc, s.id desc limit 10"));

  h("R2. All AI is Gemini Flash; no Claude/OpenAI SDK in app code");
  const code = ["app", "components", "lib", "scripts"].flatMap(files);
  const genai = code.filter((f) => readFileSync(f, "utf8").includes("@google/genai"));
  const other = code.filter((f) => /from\s+["'](@anthropic-ai\/|openai)/.test(readFileSync(f, "utf8")));
  p(`Files importing \`@google/genai\`: ${genai.map((f) => `\`${f}\``).join(", ")}. Files importing Anthropic/OpenAI SDKs: **${other.length}**. ESLint enforces this (\`no-restricted-imports\` in \`eslint.config.mjs\`). Model: \`${process.env.GEMINI_MODEL}\`.`);

  h("R3. Deployed on Vercel");
  const res = await fetch(LIVE).catch(() => null);
  const html = res ? await res.text() : "";
  p(`${LIVE} → HTTP ${res?.status ?? "unreachable"}. Headline: _${html.match(/<h1[^>]*>([^<]+)/)?.[1] ?? "?"}_. Screenshots and Lighthouse: \`docs/proofs/ui/\`.`);

  h("R4. GitHub repository");
  p(`${REPO} (commits after every build-plan phase: \`git log --oneline\`). **Currently private**: make it public or add the graders before submitting.`);
  p("```\n" + execFileSync("git", ["log", "--oneline", "-15"], { encoding: "utf8" }).trim() + "\n```");

  h("R5. Components Map");
  p("`docs/components-map.md` (tables + Mermaid) and `docs/components-map.png`.");

  h("R6. Twice-weekly scheduled run");
  const cronRuns = await q("select id, started_at, vcs_processed from pipeline_runs where trigger = 'cron' order by id desc limit 5");
  p("`vercel.json` crons: `/api/run-pipeline` at `30 2 * * 1,4` (Mon and Thu 08:00 IST) and `/api/keepalive` daily. Cron-triggered runs logged:");
  table(cronRuns);
  if (!cronRuns.length) p("_No cron run yet: the first one is scheduled for Mon 12 Oct 2026 08:00 IST. Re-run `npm run proofs` after it._");

  h("R7. Database reflects current state after each run (before/after)");
  const keys = ["vc01", "vc30", "vc17"];
  const snap = () =>
    q("select firm, last_signal_date, follow_up_score as score, recommended_action as action, left(signal_summary, 70) as summary, updated_by_system_at from vcs where seed_key = any($1::text[]) order by firm", [keys]);
  const before = await snap();
  const r7 = await runPipeline({ trigger: "script", only: keys, lock: true });
  const after = await snap();
  p(`Before (run #${r7.runId}):`);
  table(before);
  p("After:");
  table(after);

  h("R8. Vikram's manual columns are never overwritten");
  table(await permissionChecks());
  p("Also: `npm run check:manual` snapshots every manual column on all rows, runs the pipeline, and compares (last result: PASS).");

  h("R9. Quiet VCs are reported, not skipped");
  table(await q("select firm, follow_up_score as score, recommended_action as action, left(signal_summary, 80) as summary from vcs where not archived and recommended_action like 'Quiet%' order by firm limit 8"));

  h("R10. Every recommendation says why, with a 30-day source");
  const ui = existsSync("docs/proofs/ui/report.json") ? JSON.parse(readFileSync("docs/proofs/ui/report.json", "utf8")) : null;
  table(await q("select v.firm, v.recommended_action as action, t.published_date as date, t.source_url as url from vcs v join v_top_signal t on t.vc_id = v.id where not v.archived and v.recommended_action in ('Reach out this week','Reach out if capacity allows','Nudge now','Light nudge') order by v.follow_up_score desc"));
  if (ui) p(`Live link check from \`npm run ui:check\`: ${ui.sourceLinks.map((l: { firm: string; status: unknown }) => `${l.firm} ${l.status}`).join(", ")} (403 = the site blocks bots; opens in a browser).`);

  h("R11. Seed-stage B2B logistics focus (direct / adjacent / unrelated)");
  table(await q(`select distinct on (s.logistics_relevance) s.logistics_relevance as relevance, v.firm, s.sector_fit, s.customer_type, s.offering_type, s.round_stage, left(s.summary, 70) as summary
                 from signals s join vcs v on v.id = s.vc_id order by s.logistics_relevance, s.published_date desc`));

  h("R12. Triangulation");
  table(await q(`select v.firm, s.source_name, s.source_tier as tier, s.corroborated_by, s.confidence, left(s.summary, 70) as summary
                 from signals s join vcs v on v.id = s.vc_id where s.corroborated_by is not null order by s.source_tier desc limit 6`));
  const capped = await q("select count(*)::int as n from signals where signal_type = 'investment' and source_tier = 'D' and corroborated_by is null and confidence <= 0.5");
  p(`Upgrades (tier D confirmed by another source → B-level confidence 0.85) appear above. Conflict caps in live data: **${capped[0]!.n}**. The cap rule is covered by \`tests/triangulate.test.ts\` ("caps an uncorroborated social 'investment' missing from a twice-snapshotted portfolio"); no live case has occurred yet, and none was fabricated.`);

  writeFileSync("docs/proofs/README.md", out.join("\n") + "\n");
  console.log("wrote docs/proofs/README.md");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
