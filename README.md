# VC Pipeline Intelligence

Twice a week, this app checks 50 VCs on a founder's list for public activity in the last 30 days, scores how worth contacting each one is **this week**, and writes the result into Postgres on **Neon**. The founder (Vikram) is raising a seed round for a B2B logistics SaaS in Bengaluru, so relevance is judged through a strict fit lens: B2B customers + logistics sector + software + pre-seed/seed.

**Live:** https://vc-pipeline-lovat.vercel.app · **Proofs for each grading requirement:** [`docs/proofs/README.md`](docs/proofs/README.md)

- **Runtime AI is Gemini only** (`@google/genai`, `GEMINI_MODEL`). Claude Code was used as a development tool; no Anthropic or OpenAI SDK ships in the app (`docs/assumptions.md` A1, enforced by an ESLint rule).
- **Vikram's columns are never written by the pipeline.** Four independent locks (allowlist, column permissions, a trigger, a read-only dashboard role with RLS); see [Data ownership](#data-ownership).
- **Every stored signal has a resolved URL and a publish date within 30 days,** both checked in code (`lib/verify.ts`), never taken from the model.
- **What's real and what's demo:** the investors, their websites and partners, every signal, link, date, score and recommendation are **real, live data** refreshed on each run. Only Vikram's *own* columns (his status, notes and contact history with each VC) are `[DEMO]` sample values, because Vikram is a fictional founder (`docs/assumptions.md` A3).

## Demo and theme

The **Demo** button (top right on every page) walks a viewer through finding a relevant investor in 21 steps: the weekly answer, the signal behind the top lead, its sources, opening an investor, who to contact and the drafted message, the score, and the run history. It highlights the real page and does the clicks itself; Esc or **End demo** stops it. The moon/sun button switches light and dark (it follows the system setting until clicked).

## Data ownership

Vikram's own columns are never written by the system. The brief's non-negotiable rule, enforced in four independent places:

| | Columns | Who can change them |
|---|---|---|
| **Yours** (`vcs`) | `name`, `firm`, `thesis`, `status`, `last_contact_date`, `contact_history`, `personal_notes` | Nobody but the database owner. Set once when a row is created, never updated by the app |
| **Signal-derived** (`vcs`) | `last_signal_date`, `signal_summary`, `follow_up_score`, `recommended_action` (+ the timestamp `updated_by_system_at`) | Only `update_vc_signals()`, called by the scan |
| **Identifiers** (`vcs`) | website, partner, LinkedIn, RSS, portfolio URL, archive flag, … | Only `update_vc_identifiers()`, called by setup scripts |
| **System tables** | `signals`, `vc_score_history`, `pipeline_runs`, `portfolio_snapshots`, `vc_profiles`, `vc_contacts`, `vc_channels`, `vc_messages`, `suggested_vcs` | The scan, column by column from the allowlist |

How it's enforced:

1. **One allowlist in code** (`lib/ownership.ts`). Every write is built from it; there are no full-row upserts, and a test fails if any other file contains write SQL.
2. **Column permissions.** The scan connects as `vc_runtime`, which has no INSERT, UPDATE or DELETE on `vcs`. The two write functions run as `pipeline_writer`, which can update the signal and identifier columns only. New rows come from `seed_new_vcs()`, which never overwrites an existing row.
3. **A trigger** (`guard_vcs_user_columns`) rejects any change to your columns, or any deletion, unless the database owner makes it, even if a permission is granted by mistake.
4. **A read-only dashboard.** Pages and read APIs connect as `vc_web` (SELECT only). Row-level security is on for every table.

Proof: `npm run test:ownership` runs against a Neon test branch. It seeds an investor with `personal_notes = "AUDIT NOTE 123"` and a contact history, runs the real scan code, and asserts both are byte-for-byte unchanged while the signal columns updated. It also asserts that direct writes by the scan role and the dashboard role are refused, and that the database guards match `lib/ownership.ts`. Migration: `db/migrations/0008_data_ownership.sql` (rollback in `db/rollback/`).

## Who to contact and what to send

Each VC's page (`/vc/[id]`) has a **Who to contact** section, refreshed by the daily cron:

- **People** from the firm's own team page: title, point-of-contact level (decision-maker → associate), stated focus, LinkedIn/X links, and an email **only if the firm publishes it**. Names are accepted only if they appear on the fetched page.
- **Firm routes:** pitch form, published firm emails (own domain only), contact page. Emails hidden from bots (e.g. Cloudflare protection) are not decoded; the page is linked instead.
- **Drafted messages** for the top two contacts (email, LinkedIn note under 300 characters, and a follow-up if Vikram is waiting): written by Gemini from the person's role/focus, the firm's best dated signal and `data/founder.json`, then checked in code (no exclamation marks or flattery, length limits, `[placeholders]` kept). Nothing is sent automatically: Copy, or **Open in email** to send from your own mail app.
- Fill in `data/founder.json` (`[Company]`, `[traction]`) and the drafts pick it up on the next refresh (`npm run contacts`).

## How it works

```
Vercel Cron (Mon & Thu 08:00 IST) or Run now → /api/run-pipeline
  → batch feeds once (Inc42, YourStory, trade press)
  → per VC, 25 in parallel: Bing News RSS · Tavily web search (Exa only as fallback) · LinkedIn via search index
      · firm blog/Substack RSS · YouTube Data API · SEC Form D · Podcast Index
  → Gemini 3.7 Flash: Google Search + URL context + JSON schema (items-only fallback on timeout)
  → lib/verify.ts: resolve redirects, page/RSS/LinkedIn-ID dates, 30-day window, entity match, dedupe
  → classification majority vote (lib/classify.ts) · portfolio page diff (2-run debounce)
  → lib/triangulate.ts (§8.2) → lib/score.ts (§4.3–§8.4)
  → signals + update_vc_signals() + vc_score_history   (Neon Postgres)
Dashboard (read-only, SQL views) → /, /vc/[id], /runs
Vercel Cron daily → /api/keepalive (one Neon query, then re-draft messages whose signal changed
  and re-check contacts not refreshed in 30 days, inside the 300 s limit)
```

Deployed on Vercel (region `cle1`, next to Neon in AWS us-east-2); every push to `main` deploys. Components Map: [`docs/components-map.md`](docs/components-map.md) and [`docs/components-map.png`](docs/components-map.png).

**Search cost:** Tavily's free tier (1,000 searches/month) does the web search, about 100 per full run, capped at 950/month in code. Exa is only used if Tavily fails or hits the cap, and then with small requests; Exa credits are kept for submission week. Bing News RSS, firm feeds and Gemini's Google Search are free.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the keys
neon link --project-id noisy-surf-05848493 --branch production -y   # pulls DATABASE_URL*
npm run db:migrate           # schema + roles on Neon (create role vc_runtime first, see db/migrations/0002)
npm run seed                 # insert + resolve the VCs (idempotent)
npm run profile              # firm-level fit per VC (Gemini)
npm run run-one -- --all     # one full pipeline run, locally
npm run dev                  # dashboard on http://localhost:3000
```

## Commands

| Command | What it does |
|---|---|
| `npm run typecheck` / `npm test` / `npm run lint` / `npm run build` | Checks. Tests use saved fixtures, no live calls |
| `npm run test:ownership` | Data-ownership tests against the Neon test branch (`TEST_*_DATABASE_URL`) |
| `npm run run-one -- vc01 vc12` / `-- --all` | Pipeline run; `--break=<source>` forces a source to fail |
| `npm run diagnose [-- <runId>]` | Per-source funnel and a per-VC "why not 60" table |
| `npm run check:manual [-- vc01]` | Runs the pipeline and proves Vikram's columns are unchanged on all rows |
| `npm run proofs` | Regenerates `docs/proofs/README.md` (R1–R12) |
| `npm run ui:check -- <url>` | Screenshots, above-the-fold, axe-core, reduced motion, Lighthouse |
| `npm run seed` / `npm run profile` | Seed/resolve identifiers; firm profiles |
| `npm run reverse-lookup` | Discover active B2B logistics seed investors (12 months) |
| `npm run swap:apply` / `npm run swap:undo` | Apply or undo the rubric swap in `data/swap-plan.json` (see `docs/swap-log.md`) |
| `npm run export:list` | `data/vc-list-export.xlsx` (active + archived) |
| `npm run contacts [-- vc01 …]` | Find who to contact + draft messages (1 Tavily search per firm at most) |
| `npm run roundup-lookup` | Discovery from a year of Inc42/Entrackr weekly funding roundups |
| `npm run db:migrate` · `npm run keepalive` | Neon migrations · keep-alive ping |

## Decisions that differ from the docs

| Doc says | What was built | Why |
|---|---|---|
| Supabase | Neon Postgres only | Owner's decision (11 Oct 2026). Neon roles made via its API join `neon_superuser`, so the app role `vc_runtime` is created in SQL to keep the no-UPDATE-on-vcs guarantee |
| Google News RSS (§1.2) | Bing News RSS | `news.google.com/robots.txt` disallows `/rss/search` for all bots (CLAUDE.md rule 4); Bing allows its news RSS |
| Exa as the main search | Tavily first, Exa fallback only | Cost: Exa cost ~$1.70 per full run; Tavily's free tier covers the schedule |
| YouTube channel RSS (§1.9) | Data API `playlistItems` + capped `search.list` | `youtube.com/robots.txt` disallows `/feeds/` |
| `DEMO_PASSCODE` guards Run now | No passcode; single-run lock + 3-hour cooldown | The professor must be able to use it without a passcode |
| §DB grants | Plus SELECT on system columns for `pipeline_writer` | `coalesce(new, old)` reads the current value |
| Concurrency 6 | 25; Gemini grounded call capped at 90 s with a 40 s items-only fallback; no new VCs after 140 s | Grounded Gemini calls take ~55 s median; 50 VCs run in ~240 s |

## Known limits

- 17 portfolio pages are JavaScript-only, bot-blocked or missing, so portfolio diffing covers 33 of 50 funds.
- The YouTube Data API allows ~100 searches a day; heavy manual testing can use it up (it resets daily; the circuit breaker skips it for the rest of a run).
- Podcast Index needs the API **secret** that matches the key; until it's set correctly the source is skipped.
