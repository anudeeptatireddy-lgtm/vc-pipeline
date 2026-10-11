# VC Pipeline Intelligence

Twice a week, this app checks ~50 VCs on a founder's list for public activity in the last 30 days, scores how worth contacting each one is **this week**, and writes the result into his Neon Postgres table (moved from Supabase on 11 Oct 2026; Supabase is no longer used). The founder (Vikram) is raising a **Seed round for a B2B logistics SaaS**, so relevance is judged through a strict fit lens: **B2B customers + logistics/supply-chain sector + software offering + pre-seed/seed stage**. Consumer logistics, hardware/robotics, and late-stage deals are tracked but down-weighted (`docs/signal-sources.md` §4).

This is a graded exam project. Grading checks: live external data, Gemini Flash for all AI tasks, deployed on Vercel, Supabase updated each run, and the founder's manual columns never overwritten.

Read `docs/assumptions.md` once at the start of a session; treat it as settled scope.

## Non-negotiable rules

1. **Runtime AI is Gemini only.** Use `@google/genai`, model from `GEMINI_MODEL` (default `gemini-3.7-flash`). Never import the Anthropic or OpenAI SDKs in application code. Gemini 3 deprecates `temperature`/`top_p`/`top_k` and prefilled model turns, so don't send them.
2. **Never write Vikram's columns.** All writes to `vcs` go through the `update_vc_signals` / `update_vc_identifiers` functions. No `UPDATE`/`DELETE` on `vcs` from app code; the app's role (`vc_runtime`) has no such grant. The only system-written columns on `vcs` are `last_signal_date`, `signal_summary`, `follow_up_score`, `recommended_action`, plus the identifier columns listed in `docs/signal-sources.md` §DB.
3. **Verify in code, not in the model.** A signal is stored only if it has a resolved (non-redirect) URL and a publish date within 30 days, both checked by `lib/verify.ts`. Never trust a model-reported date or URL.
4. **Legitimate access only.** No logged-in automation of LinkedIn/X, no cookie scrapers, no proxy rotation, no CAPTCHA solving. Respect `robots.txt`, send a descriptive `User-Agent`, max one fetch per page per run.
5. **Secrets stay server-side.** No API key ever gets a `NEXT_PUBLIC_` prefix. `APP_DATABASE_URL` is used only in server code; the Neon owner URLs (`DATABASE_URL*`) are for migrations and never go to Vercel.
6. **Fail per source, not per run.** Every source call is wrapped; one source or one VC failing must never abort the run. Record errors in `pipeline_runs`.
7. **Fit is computed, not guessed.** Gemini returns `sector_fit`, `customer_type`, `offering_type`, `round_stage`; `lib/score.ts` derives `logistics_relevance` and applies stage + firm-fit multipliers (§4.3–§4.5, §8.3). Keep those rules in one place with unit tests.
8. **Dashboard is read-only and uses views.** Before any UI work read `docs/dashboard-design.md`; its copy deck and tokens are binding. Pages read through `lib/queries.ts` over the SQL views in `docs/components-map.md` §3.6; they never write. `recommended_action` strings and bucket mapping live in `lib/types.ts` (§3.4) and are shared by `score.ts` and the UI. Run now has no passcode (owner's decision, 11 Oct 2026) and is guarded by the single-run lock and a 3-hour cooldown; `CRON_SECRET` never reaches the browser.
9. **Don't add paid services or new data sources** that aren't in `docs/signal-sources.md` without asking first.

## Stack

- Next.js (App Router, TypeScript, strict mode) on Vercel (Hobby plan, Fluid Compute, `maxDuration` 300 s).
- Neon Postgres via `@neondatabase/serverless` (`lib/sql.ts`); migrations in `db/migrations/`, applied with `npm run db:migrate`. `supabase/migrations/` is the historical Supabase schema.
- `@google/genai` (Gemini grounding + URL context + structured JSON output).
- `rss-parser`, `cheerio`, `zod` (validate every external payload and every Gemini response).
- Vercel Cron → `GET /api/run-pipeline`, protected by `CRON_SECRET` (Vercel sends `Authorization: Bearer <CRON_SECRET>`).

## Layout

```
app/
  api/run-pipeline/route.ts   # cron entry: auth → load VCs → batch → sources → verify → score → RPC
  api/run-now/route.ts        # manual trigger for demos (same pipeline, auth-protected)
  page.tsx                    # dashboard home (spec: docs/components-map.md §3)
  vc/[id]/page.tsx            # per-VC signal timeline and evidence
  runs/page.tsx               # run history and per-source counts
  actions.ts                  # runNow server action (passcode-protected)
components/                   # RunStatusBar, BucketTabs, VcRow, ScoreBar, SourceChips, FitBadges, ...
lib/
  sources/                    # one file per source, each implements SignalSource
  gemini.ts                   # single place that calls Gemini
  verify.ts                   # URL resolution, date checks, dedupe
  score.ts                    # triangulation + follow_up_score + recommended_action
  db.ts                       # Supabase client + typed helpers; only path to update_vc_signals
  queries.ts                  # read-only queries over SQL views, used by the dashboard
  types.ts
supabase/migrations/
data/
  vc-seed-list.csv            # 50 starting VCs with evidence; input to scripts/seed-vcs.ts
docs/
  vc-list.md                  # how the list was built, what to verify, seed-script steps
  signal-sources.md           # per-source endpoints, limits, queries, schema, scoring, SQL
  build-plan.md               # phased tasks with acceptance criteria (tick boxes as you go)
  demo-script.md              # grading requirements → proof map, pre-demo checklist, demo steps
  dashboard-design.md         # dashboard build spec: layout, components, tokens, copy, states, acceptance (read before any UI work)
  dashboard-design-brief.md   # rationale + self-contained Superdesign prompt (dashboard-design.md wins on conflicts)
  components-map.md           # Components Map (text) + dashboard spec, views SQL, bucket contract
  components-map.png          # Components Map as an image: the submission artifact
  tools/make-components-map.py # regenerates the PNG; update it when components change
  assumptions.md              # decided answers to open questions in the brief (India-based founder, demo data, etc.)
```

## Source contract

Every file in `lib/sources/` exports one object of this shape. Read the matching section of `docs/signal-sources.md` before implementing a source.

```ts
export interface RawItem {
  url: string;              // may be a redirect; verify.ts resolves it
  title: string;
  snippet?: string;
  publishedAt?: string;     // ISO if the source provides it
  source: string;           // e.g. "google-news-rss"
  sourceTier: "A" | "B" | "C" | "D";
}

export interface SignalSource {
  name: string;
  enabled: (vc: Vc) => boolean;               // e.g. needs vc.rss_url
  fetchForVc?: (vc: Vc, since: Date) => Promise<RawItem[]>;
  fetchBatch?: (since: Date) => Promise<RawItem[]>; // once per run, matched to VCs after
}
```

## Environment variables

`GEMINI_API_KEY`, `GEMINI_MODEL`, `APP_DATABASE_URL` (Neon, vc_runtime role), `DATABASE_URL_UNPOOLED` (Neon owner, migrations only) `CRON_SECRET`, `TAVILY_API_KEY` (primary web search), `EXA_API_KEY` (fallback only, and seeding/discovery scripts), `PODCASTINDEX_API_KEY`, `PODCASTINDEX_API_SECRET`, `YOUTUBE_API_KEY`, `SEC_USER_AGENT` (format: `AppName contact@email`). Optional v2: `X_BEARER_TOKEN`, `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD`, `JINA_API_KEY`.

Keep `.env.example` in sync whenever you add one.

## Commands

- `npm run dev` / `npm run build` / `npm run lint` / `npm run typecheck` / `npm test`
- `npm run db:migrate` (Neon) · `npm run check:manual` · `npm run keepalive`

## How to work in this repo

- Follow `docs/build-plan.md` in order. Finish a phase's acceptance criteria before starting the next, and tick its boxes.
- Build one source at a time: implement, add a test with a saved fixture response (no live calls in tests), run `npm run typecheck && npm test`.
- Before finishing any task that touches `vcs` or `db.ts`, re-run the "manual columns untouched" test.
- Prefer small, readable modules over abstractions. No new dependencies without a one-line reason in the commit message.
- If a free-tier limit or endpoint in the docs looks wrong at runtime, stop and report it rather than working around it.
