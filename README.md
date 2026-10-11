# VC Pipeline Intelligence

Twice a week, this app checks 50 VCs on a founder's list for public activity in the last 30 days, scores how worth contacting each one is **this week**, and writes the result into Postgres on Neon (Supabase is kept, unused, as a fallback). The founder (Vikram) is raising a seed round for a B2B logistics SaaS in Bengaluru, so relevance is judged through a strict fit lens: B2B customers + logistics sector + software + pre-seed/seed.

- **Runtime AI is Gemini only** (`@google/genai`, `GEMINI_MODEL`). Claude Code was used as a development tool; no Anthropic or OpenAI SDK ships in the app (`docs/assumptions.md` A1, enforced by an ESLint rule).
- **Vikram's columns are never written by the pipeline.** The app connects as `vc_runtime`, which has no UPDATE or DELETE on `vcs`. All changes go through `update_vc_signals` / `update_vc_identifiers`, `security definer` functions owned by a role with column-level UPDATE on the system columns only. Verified by `npm run check:manual` and the acceptance SQL (direct UPDATE/DELETE as the app → permission denied).
- **Every stored signal has a resolved URL and a publish date within 30 days,** both checked in code (`lib/verify.ts`), never taken from the model.
- **Demo data:** Vikram's status, notes and contact history are sample values prefixed `[DEMO]` (`docs/assumptions.md` A3). VC names, firms, identifiers and all signals are real and live.

## How it works

```
Vercel Cron (Mon & Thu 08:00 IST) → /api/run-pipeline (CRON_SECRET)
  → batch feeds once (Inc42, YourStory, Supply Chain Dive, The Loadstar, ET Infra, JOC)
  → per VC, 25 in parallel: firm RSS · Exa · LinkedIn via search index · Podcast Index · YouTube Data API · SEC Form D · (Tavily fallback)
  → Gemini 3.7 Flash with Google Search + URL context + JSON schema (classify + find more)
  → lib/verify.ts: resolve redirects, page/RSS/LinkedIn-ID dates, 30-day window, entity match, dedupe
  → portfolio page diff (2-run debounce) → tier-A signals
  → lib/triangulate.ts (§8.2) → lib/score.ts (§4.3–§8.4)
  → signals table + update_vc_signals() + vc_score_history  (Neon Postgres)
Dashboard (read-only, SQL views) → /, /vc/[id], /runs
```

Deployed on Vercel (region `cle1`, next to the Neon project in AWS us-east-2). Every push to `main` deploys. A daily cron hits `/api/keepalive`, which queries Neon and the fallback Supabase project so neither sits idle.

Components Map: [`docs/components-map.md`](docs/components-map.md) and [`docs/components-map.png`](docs/components-map.png).

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the keys
neon link --project-id noisy-surf-05848493 --branch production -y   # pulls DATABASE_URL*
npm run db:migrate           # schema + roles on Neon (create role vc_runtime first, see db/migrations/0002)
npm run seed                 # insert + resolve the 50 VCs (idempotent)
npm run profile              # firm-level fit per VC (Gemini)
npm run run-one -- --all     # one full pipeline run, locally
npm run dev                  # dashboard on http://localhost:3000
```

Migrations live in `db/migrations/` (Neon). `supabase/migrations/` is the original Supabase schema, kept for the fallback project.

## Commands

| Command | What it does |
|---|---|
| `npm run typecheck` / `npm test` / `npm run lint` / `npm run build` | Checks. Tests use saved fixtures, no live calls |
| `npm run seed [-- --only=vc01,vc02] [-- --force]` | Seed and resolve identifiers |
| `npm run profile [-- --only=…] [-- --force]` | Firm profiles (`vc_profiles`) |
| `npm run run-one -- vc01 vc12` / `-- --all` | Pipeline run; `--break=<source>` forces a source to fail |
| `npm run check:manual [-- vc01]` | Runs the pipeline and proves Vikram's columns are unchanged on all rows |
| `npm run db:migrate` | Apply `db/migrations/*.sql` to Neon as the owner |
| `npm run keepalive` | Ping Neon and the fallback Supabase project |

## Decisions that differ from the docs

| Doc says | What was built | Why |
|---|---|---|
| Google News RSS (§1.2) | Not built | `news.google.com/robots.txt` disallows `/rss/search` for all bots (CLAUDE.md rule 4). Gemini grounding and Exa cover news |
| YouTube channel RSS (§1.9) | Data API `playlistItems` (1 unit) + capped `search.list` | `youtube.com/robots.txt` disallows `/feeds/` |
| FreightWaves / StrictlyVC feeds | Left out | Feeds last updated 2022 / 2020 |
| §DB grants | Plus SELECT on system columns, RLS policies for `pipeline_writer`, `security_invoker` views | Without them the RPC silently updated 0 rows, or views exposed `personal_notes` to the anon key |
| Supabase (CLAUDE.md, grading wording) | Neon Postgres; Supabase kept as an untouched fallback | Owner's choice (11 Oct 2026). Neon roles made via its API join `neon_superuser`, so the app role `vc_runtime` is created in SQL to keep the no-UPDATE-on-vcs guarantee |
| Concurrency 6 | 25, Gemini capped at 110 s, no new VCs after 150 s | Grounded Gemini calls take ~55 s median; measured 214 s for 50 VCs |

## Not done yet

- `DEMO_PASSCODE` isn't set in Vercel yet, so Run now refuses every passcode until it is.
- `SEC_USER_AGENT` needs a real contact email before SEC lookups switch on; `PODCASTINDEX_API_SECRET` is empty, so podcasts are off.
- Lighthouse scores and Playwright screenshots from the acceptance checklist; axe-core was run by hand (0 violations on `/`, `/vc/[id]`, `/runs`).
- `suggested_vcs` (reverse lookup) is v2; the panel hides when empty.
