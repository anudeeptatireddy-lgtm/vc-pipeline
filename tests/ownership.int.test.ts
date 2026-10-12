// Data ownership, end to end, against the Neon test branch (never production).
//   npm run test:ownership
// Needs TEST_OWNER_DATABASE_URL, TEST_APP_DATABASE_URL, TEST_WEB_DATABASE_URL
// (.env.local); skipped when they're missing.
import { existsSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const OWNER = process.env.TEST_OWNER_DATABASE_URL;
const APP = process.env.TEST_APP_DATABASE_URL;
const WEB = process.env.TEST_WEB_DATABASE_URL;
const ready = !!(OWNER && APP && WEB);

// The app modules must talk to the test branch, never production.
if (ready) {
  process.env.APP_DATABASE_URL = APP;
  process.env.APP_READONLY_DATABASE_URL = WEB;
}

const USER_COLS = "name, firm, thesis, status, last_contact_date::text as last_contact_date, contact_history, personal_notes";
const USER_ROW = "name, firm, thesis, status, last_contact_date, contact_history, personal_notes";
const SEED_KEY = `test-audit-${Date.now()}`;
const NOTES = "AUDIT NOTE 123";
const HISTORY = "2026-09-01 · email · Intro sent via a mutual angel\n2026-09-20 · call · 20 minutes with the partner";

async function expectDenied(p: Promise<unknown>, pattern = /permission denied|read-only|cannot be deleted/i) {
  const err = await p.then(() => null, (e: { code?: string; message: string }) => e);
  expect(err, "expected the database to refuse this").not.toBeNull();
  expect(err!.code === "42501" || pattern.test(err!.message)).toBe(true);
}

describe.skipIf(!ready)("data ownership (Neon test branch)", () => {
  let owner: Pool;
  let app: Pool;
  let web: Pool;
  let vcId: string;

  beforeAll(async () => {
    owner = new Pool({ connectionString: OWNER });
    app = new Pool({ connectionString: APP });
    web = new Pool({ connectionString: WEB });
    // Guard: refuse to run against the production endpoint.
    const prodHost = (() => {
      try {
        return new URL(process.env.DATABASE_URL_UNPOOLED ?? "").hostname.replace("-pooler", "");
      } catch {
        return "";
      }
    })();
    expect(new URL(OWNER!).hostname.replace("-pooler", "")).not.toBe(prodHost);

    const { rows } = await owner.query(
      `insert into vcs (seed_key, name, firm, thesis, status, last_contact_date, contact_history, personal_notes,
                        signal_summary, follow_up_score, recommended_action)
       values ($1, 'Audit Test Partner', 'Audit Test Ventures', 'B2B logistics seed', 'waiting_for_response', '2026-09-20', $2, $3,
               'before the scan', 77, 'Nudge now') returning id`,
      [SEED_KEY, HISTORY, NOTES],
    );
    vcId = rows[0].id;
  }, 60_000);

  afterAll(async () => {
    if (vcId) await owner.query("delete from vcs where seed_key like 'test-audit-%'");
    await Promise.all([owner?.end(), app?.end(), web?.end()]);
  });

  it("a scan leaves notes and contact history byte-for-byte unchanged and updates the signal columns", async () => {
    const before = (await owner.query(`select ${USER_COLS}, updated_by_system_at from vcs where id = $1`, [vcId])).rows[0];
    const beforeHash = (await owner.query(`select md5(row(${USER_ROW})::text) h from vcs where id = $1`, [vcId])).rows[0].h;

    const { processVc } = await import("@/lib/pipeline");
    const { startRun, finishRun } = await import("@/lib/db");
    const { q } = await import("@/lib/sql");
    const [vc] = await q("select * from vcs where id = $1", [vcId]);
    const runId = await startRun("script");
    const r = await processVc({
      vc: vc as never,
      profile: null,
      sources: [],
      runId,
      portfolioDiff: false,
      extract: async () => ({ is_same_person_or_firm: true, signals: [], mode: "grounded" as const }) as never,
    });
    await finishRun(runId, { vcsProcessed: 1, errors: r.errors, usage: {} });

    const after = (await owner.query(`select ${USER_COLS}, signal_summary, follow_up_score, recommended_action, updated_by_system_at from vcs where id = $1`, [vcId])).rows[0];
    const afterHash = (await owner.query(`select md5(row(${USER_ROW})::text) h from vcs where id = $1`, [vcId])).rows[0].h;

    expect(after.personal_notes).toBe(NOTES);
    expect(after.contact_history).toBe(HISTORY);
    for (const c of ["name", "firm", "thesis", "status", "last_contact_date"]) expect(after[c]).toBe(before[c]);
    expect(afterHash).toBe(beforeHash);

    // The scan did write its own columns.
    expect(after.signal_summary).not.toBe("before the scan");
    expect(after.follow_up_score).toBe(0);
    expect(new Date(after.updated_by_system_at).getTime()).toBeGreaterThan(new Date(before.updated_by_system_at ?? 0).getTime());
  }, 120_000);

  it("the scan role can't update, insert or delete vcs directly", async () => {
    await expectDenied(app.query("update vcs set personal_notes = 'x' where id = $1", [vcId]));
    await expectDenied(app.query("update vcs set contact_history = 'x' where id = $1", [vcId]));
    await expectDenied(app.query("update vcs set follow_up_score = 1 where id = $1", [vcId]));
    await expectDenied(app.query("insert into vcs (name, firm, personal_notes) values ('x', 'x', 'x')"));
    await expectDenied(app.query("delete from vcs where id = $1", [vcId]));
    const notes = (await owner.query("select personal_notes from vcs where id = $1", [vcId])).rows[0].personal_notes;
    expect(notes).toBe(NOTES);
  });

  it("the trigger blocks user columns even if a grant is added by mistake", async () => {
    const c = await owner.connect();
    try {
      await c.query("begin");
      await c.query("grant update (personal_notes) on public.vcs to pipeline_writer");
      await c.query("set local role pipeline_writer");
      await expectDenied(c.query("update public.vcs set personal_notes = 'overwritten' where id = $1", [vcId]), /read-only/);
    } finally {
      await c.query("rollback");
      c.release();
    }
  });

  it("seeding can add rows but never overwrite an existing one", async () => {
    const seed = (key: string, notes: string) =>
      app.query("select public.seed_new_vcs($1::jsonb) as n", [JSON.stringify([{ seed_key: key, name: "Seed Test", firm: "Seed Test", status: "yet_to_reach_out", personal_notes: notes }])]);
    expect((await seed(`${SEED_KEY}-new`, "fresh row")).rows[0].n).toBe(1);
    expect((await seed(SEED_KEY, "OVERWRITE ATTEMPT")).rows[0].n).toBe(0);
    expect((await owner.query("select personal_notes from vcs where id = $1", [vcId])).rows[0].personal_notes).toBe(NOTES);
  });

  it("the dashboard role is read-only", async () => {
    expect((await web.query("select count(*)::int n from v_dashboard_vcs")).rows[0].n).toBeGreaterThan(0);
    await expectDenied(web.query("update vcs set personal_notes = 'x' where id = $1", [vcId]));
    await expectDenied(web.query("insert into signals (vc_id, signal_type, summary, source_url, source_name, source_tier, published_date, logistics_relevance, confidence) values ($1, 'other', 'x', 'https://x.test', 'x', 'D', current_date, 'unrelated', 0.5)", [vcId]));
    await expectDenied(web.query("select update_vc_signals($1, null, 'x', 1, 'Hold')", [vcId]));
    await expectDenied(web.query("delete from vc_contacts where vc_id = $1", [vcId]));
  });

  it("database guards match lib/ownership.ts", async () => {
    const { USER_OWNED_VCS_COLUMNS, VCS_SIGNAL_COLUMNS, VCS_IDENTIFIER_COLUMNS, VCS_SYSTEM_TIMESTAMP } = await import("@/lib/ownership");
    const granted = (await owner.query(
      "select column_name from information_schema.column_privileges where table_schema = 'public' and table_name = 'vcs' and privilege_type = 'UPDATE' and grantee = 'pipeline_writer'",
    )).rows.map((r) => r.column_name as string);
    for (const c of USER_OWNED_VCS_COLUMNS) expect(granted).not.toContain(c);
    for (const c of [...VCS_SIGNAL_COLUMNS, VCS_SYSTEM_TIMESTAMP, ...VCS_IDENTIFIER_COLUMNS]) expect(granted).toContain(c);

    const fn = (await owner.query("select prosrc from pg_proc where proname = 'guard_vcs_user_columns'")).rows[0].prosrc as string;
    for (const c of USER_OWNED_VCS_COLUMNS) expect(fn).toContain(`new.${c}`);

    const rls = (await owner.query("select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'")).rows;
    expect(rls.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
    const app = (await owner.query("select has_table_privilege('vc_runtime', 'public.vcs', 'INSERT') i, has_table_privilege('vc_web', 'public.signals', 'INSERT') w")).rows[0];
    expect(app).toEqual({ i: false, w: false });
  });
});
