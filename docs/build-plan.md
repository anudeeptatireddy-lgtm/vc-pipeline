# Build Plan

Work top to bottom. Don't start a phase until the previous phase's acceptance criteria pass. Tick boxes as you finish them. Section references (§) point to `docs/signal-sources.md`.

## Phase 0 — Scaffold
- [x] Next.js App Router + TypeScript strict, ESLint, Vitest, `zod`, `@google/genai`, `@supabase/supabase-js`, `rss-parser`, `cheerio`
- [x] `.env.example` with every variable from `CLAUDE.md`
- [x] `vercel.json`: cron `30 2 * * 1,4` (08:00 IST Mon & Thu) → `/api/run-pipeline`; `maxDuration: 300` for pipeline routes
- [x] `lib/types.ts` with `Vc`, `RawItem`, `SignalSource`, `VerifiedSignal`

**Accept:** `npm run build`, `npm run typecheck`, `npm test` all pass on an empty test.

## Phase 1 — Database (§DB)
- [ ] Migration with `vcs`, `signals`, `portfolio_snapshots`, `pipeline_runs`, `suggested_vcs`
- [ ] `pipeline_writer` role, column grants, `update_vc_signals` RPC
- [ ] `update_vc_identifiers` RPC (same pattern) for seeding
- [ ] Dashboard read-model migration from `docs/dashboard-design.md` §6 (`opening_line`, `nudge_line`, `signal_value`, `vc_score_history`, views `v_top_signal`, `v_vc_sources`, `v_signal_tape`, `v_score_changes`)
- [ ] Read-model migration from `docs/components-map.md` §3.6: extra `vcs` columns, `signals.corroborated_by`, RLS on all tables, views `v_dashboard_vcs`, `v_signal_feed`, `v_last_run`
- [ ] `lib/db.ts`: typed helpers; `writeVcSignals()` is the ONLY function that writes to `vcs`

**Accept:** both SQL acceptance tests in §DB behave as described (role update → permission denied).

## Phase 2 — Seed real data (§3, §5)
- [ ] `scripts/seed-vcs.ts`: load `data/vc-seed-list.csv` (50 VCs) and follow the steps in `docs/vc-list.md`; every website and partner name must be verified by fetching, never assumed
- [ ] Resolve identifiers per VC: `linkedin_url` (Exa `category:"people"`), `rss_url`, `portfolio_url`, `team_url`, `sec_cik` (US firms), `youtube_channel_id` where they exist
- [ ] `scripts/profile-vcs.ts`: one Gemini call per VC → `vc_profiles` (does_seed, b2b_logistics_thesis, investor_type, typical_check, geo_focus) with evidence URLs (§4.5)
- [ ] Drop or flag VCs that come back `series_a_plus_only` or `b2b_logistics_thesis = none`; aim for ≥35 of 50 with seed fit ✅
- [ ] Fill Vikram-owned columns with realistic placeholder status/notes (clearly marked as demo data)

**Accept:** 50 rows; ≥30 have at least two identifiers; script is idempotent.

## Phase 3 — Vertical slice for ONE VC
- [ ] `lib/sources/google-news-rss.ts` (§1.2)
- [ ] `lib/gemini.ts` + `lib/sources/gemini-grounding.ts` with googleSearch + urlContext + JSON schema (§1.1, §7)
- [ ] `lib/verify.ts`: resolve redirects, date precedence (page meta → RSS pubDate → LinkedIn ID decode → model), 30-day cutoff, dedupe (§7.3)
- [ ] `lib/score.ts`: derive relevance from §4.0 axes (§4.3), stage multiplier (§4.4), firm fit (§4.5), §8.3 score with the off-thesis cap, §8.4 action table
- [ ] Unit tests for the §4.0 examples table (TMS seed → direct; robotics Series A → adjacent; consumer delivery seed → adjacent; e-bike Series C → unrelated)
- [ ] Insert into `signals` (with `signal_value`, `opening_line`, `nudge_line`), then `writeVcSignals()` and `recordScoreHistory()`

**Accept:** running the slice for one VC writes ≥1 verified signal with a real URL (or a correct "quiet" result), and the four columns update.

## Phase 4 — Core sources (v1)
- [ ] Exa (§1.3) · Tavily fallback (§1.4)
- [ ] Firm/Substack/Medium RSS (§2.2) · trade-media RSS (§1.10)
- [ ] Podcast Index (§1.8) · YouTube channel RSS + capped search (§1.9)
- [ ] India funding RSS: Inc42 + YourStory, batch then match investor names (§3)
- [ ] SEC Form D with `SEC_USER_AGENT` (§5.1)
- [ ] LinkedIn via search index + `lib/linkedin-date.ts` (§1.6)

**Accept:** each source has a fixture-based unit test; a full run over 5 VCs completes with per-source counts logged in `pipeline_runs.usage`.

## Phase 5 — Portfolio diffing (§6)
- [ ] fetch + cheerio extractor; Jina Reader fallback for JS-rendered pages
- [ ] canonicalize → hash → diff → 2-run debounce → Gemini enrichment of additions
- [ ] Snapshots in `portfolio_snapshots`

**Accept:** unit test with two fixture HTML snapshots detects exactly the added company; nothing alerts after only one run.

## Phase 6 — Full run, cron, safety
- [ ] Batch 50 VCs at concurrency 6 within 300 s; per-source and per-VC error isolation
- [ ] `CRON_SECRET` check on `/api/run-pipeline`; `/api/run-now` behind the same secret (or Supabase auth)
- [ ] Triangulation rules (§8.2)

**Accept:** full run finishes < 280 s on Vercel; a forced failure in one source still completes the run; the manual-columns test passes.

## Phase 7 — Dashboard (spec: `docs/dashboard-design.md`, system context: `docs/components-map.md` §3)
- [ ] `lib/types.ts`: `recommended_action` constants and bucket mapping (§3.4), shared with `score.ts`
- [ ] `lib/queries.ts`: read-only queries over the views; no write helpers imported anywhere under `app/` or `components/`
- [ ] Tokens, fonts and base layout from `dashboard-design.md` §3 and §5; develop against `fixtures/dashboard.sample.json` first (§12)
- [ ] `/` page: `StatusBar`, `Headline`, `PipelineStrip`, `RankedRow` (top + compact), `SignalTape`, `FreshnessChip`, `SourceChips`, `ConfirmationBadge`, `FitLine`, `YoursChip`, `CopyLineButton`, `NudgeList`, `ChangesPanel`, `SuggestedPanel`, `ParkedList`, `EndNote`
- [ ] `/vc/[id]` page: `SignalTimeline`, `FirmProfileCard`, Vikram's notes and contact history shown read-only
- [ ] `/runs` page: run history with per-source counts and errors
- [ ] `RunNowButton` + `runNow` server action guarded by `DEMO_PASSCODE`; single-run lock
- [ ] `EmptyState` and failed-run fallback that keeps showing the last good data
- [ ] All strings from the copy deck (§8); responsive at 390 and 1440; accessibility rules (§10)
- [ ] Run the acceptance checklist in `dashboard-design.md` §13 (Playwright screenshots, axe-core, Lighthouse)

**Accept:** deployed URL shows live data from the latest run; every "reach out" row has at least one working source link; stopping the pipeline mid-run still leaves a usable dashboard; no `app/` or `components/` file writes to the database.

## Phase 8 — Submission
- [ ] Public Vercel URL, GitHub repo, Components Map (`docs/components-map.md`, already drafted; update it if components changed)
- [ ] Every row in `docs/demo-script.md` §1 has its proof produced and saved
- [ ] Pre-demo checklist (§2) passes on the day before and the morning of submission
- [ ] Demo script (§3) rehearsed end-to-end at least twice

## v2 (after the exam)
- [ ] LinkedIn capture button / bookmarklet · X pay-per-use timelines · Bluesky · GDELT batch job
- [ ] Team-page diffing · SEBI AIF diff · job boards
- [ ] Signal history timeline per VC · weekly email/Telegram digest · Gemini-drafted outreach openers
- [ ] Reverse-lookup "suggested VCs" from recent logistics seed rounds
