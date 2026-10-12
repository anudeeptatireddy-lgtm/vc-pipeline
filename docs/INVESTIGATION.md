# Investigation: brief and audit findings vs the code

Read-only investigation (no code changed). Sources: [`BRIEF.md`](BRIEF.md), [`AUDIT.md`](AUDIT.md), the repository at commit `a4bc212`, and read-only queries against the live Neon database on Mon 12 Oct 2026 (after the 08:24 scheduled run and the auditor's 17:06 manual run).

> **Supabase vs Neon.** The brief and audit say "Supabase". The app moved to **Neon Postgres** on 11 Oct 2026 (`CLAUDE.md`, `db/migrations/0001_init.sql:1`). There is no Supabase client, anon key or RLS policy in use. Questions 1–3 are answered for Neon, where the same guarantees are enforced with Postgres roles and column grants.

---

## 1. Scan write scope

The scan connects as **`vc_runtime`** (`APP_DATABASE_URL`, `lib/sql.ts`). Every write in the pipeline (`lib/pipeline.ts`, `lib/run.ts`, `lib/sources/*`) and in the daily upkeep (`lib/maintenance.ts`):

| # | Where | Statement | Columns touched |
|---|---|---|---|
| W1 | `lib/db.ts:28` ← `lib/pipeline.ts:275` | `select update_vc_signals($1..$5)` | `vcs.last_signal_date` (coalesced, keeps old if null), `signal_summary`, `follow_up_score`, `recommended_action`, `updated_by_system_at` |
| W2 | `lib/db.ts:145-148` ← `pipeline.ts:226` | `insert into signals (...) ... on conflict (vc_id, source_url) do nothing` | 20 explicit columns (`SIGNAL_COLS`, `db.ts:129-133`); new rows only |
| W3 | `lib/db.ts:184-191` ← `pipeline.ts:235` | `update signals set sector_fit, customer_type, offering_type, round_stage, logistics_relevance, signal_value, classification_votes` (or only `classification_votes`) | named columns on `signals` |
| W4 | `lib/db.ts:200-204` ← `pipeline.ts:253` | `update signals s set corroborated_by, confidence, signal_value` | named columns on `signals` |
| W5 | `lib/db.ts:230` ← `sources/portfolio-diff.ts:77` | `insert into portfolio_snapshots` | `vc_id, kind, entries, entries_hash` |
| W6 | `lib/db.ts:236` ← `pipeline.ts:276` | `insert into vc_score_history` | `vc_id, run_id, follow_up_score, recommended_action` |
| W7 | `lib/db.ts:256`, `:265` ← `run.ts:51`, `:101` | `insert into pipeline_runs (trigger)`; `update pipeline_runs set finished_at, vcs_processed, errors, usage` | run log only |
| W8 | `lib/contacts-refresh.ts:167-175` (upkeep) | `delete from vc_contacts where vc_id`; `insert into vc_contacts (...)` | snapshot of system table |
| W9 | `lib/contacts-refresh.ts:177-183` (upkeep) | `insert into vc_channels ... on conflict (vc_id) do update set pitch_url, emails, email_sources, x_url, contact_url, email_hidden_from_bots, updated_at` | named columns, system table |
| W10 | `lib/contacts-refresh.ts:205-214` (upkeep) | `delete from vc_messages where contact_id`; `insert into vc_messages` | system table |

Outside the scan (one-off scripts, same role): `insertNewVcs` (`db.ts:87-97`, `on conflict (seed_key) do nothing`; writes Vikram's columns **once**, at row creation), `writeVcIdentifiers` → `update_vc_identifiers` (identifier and archive columns only, every value `coalesce`d), `upsertVcProfile` (`vc_profiles`), and `scripts/suggest-from-lookup.ts` (`suggested_vcs`).

**Full-row upsert check:** none. No statement sends a whole row object to `vcs`. The only upserts (`vc_profiles`, `vc_channels`) name each column in `do update set`, and both are system tables. `insertSignals` builds its payload from the fixed `SIGNAL_COLS` list (`db.ts:143`), not from the row object. The protected function itself:

```sql
-- db/migrations/0001_init.sql:156-162
update public.vcs set
  last_signal_date     = coalesce(p_last_signal_date, last_signal_date),
  signal_summary       = p_signal_summary,
  follow_up_score      = p_follow_up_score,
  recommended_action   = p_recommended_action,
  updated_by_system_at = now()
where id = p_id;
```

**Note:** the brief lists exactly four columns. The scan also sets `updated_by_system_at` (a timestamp, system-owned). Everything else the UI shows (fit, lanes, drafts, team) lives in other tables (`signals`, `vc_contacts`, `vc_messages`, …) or is computed at read time (`lib/triage.ts`).

## 2. Where Vikram's notes live, and whether the scan can write them

Same table as the signal columns: `vcs` (`0001_init.sql:17-24`: `name, firm, thesis, status, last_contact_date, contact_history, personal_notes`; signal columns at `:25-29`).

The scan role **cannot** write them. Live check:

```
has_table_privilege('vc_runtime','public.vcs','UPDATE')                 → false
has_table_privilege('vc_runtime','public.vcs','DELETE')                 → false
has_column_privilege('vc_runtime','public.vcs','personal_notes','UPDATE') → false
vcs grants: vc_runtime = INSERT, SELECT
```

Column-level UPDATE is held only by `pipeline_writer` (NOLOGIN), and only on system columns (`0001_init.sql:140-143` and `0003_archive.sql:11`). `status`, `last_contact_date`, `contact_history`, `personal_notes`, `name`, `firm` and `thesis` are not in that list. The two `security definer` functions are owned by `pipeline_writer` (`0001_init.sql:207-209`), so even they can't change Vikram's columns. `vc_runtime` is not a member of any role (no `neon_superuser`).

**Residual risk:** `vc_runtime` keeps INSERT on `vcs` for seeding (`0002_runtime_role.sql:13`). That allows creating rows, not changing existing ones.

## 3. Database security (RLS, policies, frontend key)

- **RLS:** disabled on all 11 tables (`relrowsecurity = false`); **0 policies** (`pg_policies` is empty).
- **Frontend key:** none. The browser never receives database credentials. Pages are server components and `APP_DATABASE_URL` is read only server-side (`lib/sql.ts`); no `NEXT_PUBLIC_` variable exists. The only browser-callable data route is `GET /api/vc/[id]/contacts` (read-only, `app/api/vc/[id]/contacts/route.ts`). The only browser-triggered write is the `runNow` server action (`app/actions.ts`), which runs the pipeline under the protections in §1–2.
- **Can the frontend write?** No user-data write path exists, and no client can write to `vcs`. Protection comes from role grants, not RLS. RLS would matter only if a client-side key were ever introduced.
- **Exposure:** reads are public. Anyone with the URL sees the pipeline and the (demo) notes, because the site has no login.

## 4. Cron

```json
// vercel.json:6-15
"crons": [
  { "path": "/api/run-pipeline", "schedule": "30 2 * * 1,4" },
  { "path": "/api/keepalive",    "schedule": "0 6 * * *" }
]
```

- **Thursday:** yes. `1,4` = Monday and Thursday. 02:30 UTC = 08:00 IST (UTC+5:30, no daylight saving). Next run: Thu 15 Oct 08:00 IST (`lib/format.ts` `nextRun()` uses the same 02:30 UTC rule).
- **Handler:** `app/api/run-pipeline/route.ts:8-19`. It checks `CRON_SECRET` (`isCronAuthorized`) → `runPipeline({ trigger: "cron" })` → returns 409 if locked, 500 on error.
- **maxDuration:** 300 s (`route.ts:6` and `vercel.json:17-19`). Budget: no new VC starts after 140 s (`lib/run.ts:47-49`, `:74-77`), concurrency 25 (`run.ts:73`).
- **Durations (full runs):** 179–242 s on Vercel and in scripts; cron 193 s; manual 179 s. One early local script run took 382 s with 8 VCs skipped for time (`pipeline_runs.id = 3`); that was before the 140 s budget and concurrency 25. It ran locally, where there is no 300 s limit.
- **Late start (08:24):** Monday's cron started at 02:54:39 UTC, 24 minutes after 02:30. The code has no delay. This matches Vercel Hobby cron timing, which only guarantees the scheduled hour, not the minute.

## 5. Gemini

- **Model string:** a single source, `lib/gemini.ts:16`: `process.env.GEMINI_MODEL || "gemini-3.7-flash"`. It is passed as `model: model()` in the only `generateContent` call (`gemini.ts:49`). Local `.env.local`: `GEMINI_MODEL=gemini-3.7-flash`. The last proofs run recorded the same value (`docs/proofs/README.md:37`). Vercel stores it as an encrypted secret; I did not decrypt it. **It is a Gemini Flash variant.**
- **Every AI call goes through `geminiJson`:** pipeline extraction (`sources/gemini-grounding.ts:125-141`), portfolio enrichment (`sources/portfolio-diff.ts:56`), team extraction (`contacts-refresh.ts:95`), drafts (`messages.ts:106`), plus scripts. `@google/genai` is imported only in `lib/gemini.ts` (and by `scripts/proofs.ts` for the check); ESLint blocks other AI SDKs.
- **On timeout:** `AbortSignal.timeout` (`gemini.ts:55`). A timeout is not retried (`gemini.ts:76`). Extraction falls back from the 90 s grounded call to a 40 s **items-only** call over at most 15 collected items, with no search (`gemini-grounding.ts:133-140`). That is logged as "grounded call timed out; classified collected items only" (`pipeline.ts:137`). If that also fails, the error is recorded and `modelSignals` stays empty (`pipeline.ts:140-143`). Scoring still uses previously stored signals (see §11).

## 6. The 30-day window and which date is stored

- **`published_date` is the publish date, with fallbacks** (`lib/verify.ts:168-176`), taken from the first that exists:
  1. page metadata (`pagePublishedDate`, `verify.ts:97-119`),
  2. RSS item date,
  3. LinkedIn activity-ID date,
  4. **the model's reported date**.
- **Exception:** portfolio-diff signals store the **crawl date** (`portfolio-diff.ts:93`: `published_date: toDay(today)`).
- **Off-by-one:** `toDay` converts to a UTC day (`verify.ts:121`), so a date with an IST offset early in the day becomes the previous day. For TMV, the stored 28 Sept came from **the model**: the homepage has no date metadata (live check: `pagePublishedDate(tmv.vc) = null`), and there is no RSS item.
- **Window enforced at three points:**
  1. **ingest:** `withinWindow` (`verify.ts:123-126`; 30 days with 1 day of skew) in `verifyCandidate` (`verify.ts:177`);
  2. **scoring:** `loadRecentSignals(vc, since)` (`pipeline.ts:246`, `db.ts:209-211`; `published_date >= since`);
  3. **query time:** views `v_top_signal`, `v_vc_sources`, `v_signal_tape` (`published_date >= current_date - 30`, `0001_init.sql:243, 249, 254`) and `getTriage` (`lib/queries.ts`, `v_signal_feed where published_date >= current_date - 30`).

## 7. What "Date and link checked" checks

The badge is **unconditional**: every evidence item renders it (`components/triage/Workspace.tsx:64`). What verification actually did at ingest (`verify.ts:156-195`):

1. the URL is http(s) and isn't a redirector (or was followed to a non-redirector);
2. **some** date was found (page → RSS → LinkedIn → model) and is within the window;
3. the fetched page's text, title or description contains the firm's tokens or the partner's surname.

**Not checked:** that the path isn't the site root, that the evidence quote appears on the page, or where the date came from (`dateSource` is computed but never stored; `signals` has no such column).

**Why a homepage passes:** Gemini grounding returns the firm's homepage as `source_url`. It resolves (200), it obviously names the firm (entity check passes), and the date falls back to the model's. Live reproduction:

| Signal | URL | Page date meta | Quote on page |
|---|---|---|---|
| TMV #422 | `https://www.tmv.vc` | none | **no** |
| Better Capital #92 | `https://www.bettercapital.vc` | none | **no** |
| Eclipse #647 | `https://eclipse.capital` | none | **no** |

10 signals in the current 30-day window have a root or section-index URL (e.g. `/insights`).

## 8. Deduplication

- **At storage:** `unique (vc_id, source_url)` (`0001_init.sql:71`) plus `on conflict do nothing` (`db.ts:148`). Same exact URL only.
- **At scoring only, in memory:** `dedupe()` (`verify.ts:214-237`) removes duplicates by canonical URL, then by **identical lower-cased `company_name` + same `signal_type` within 7 days**, and sets `corroborated_by` on the kept copy. The result is **not persisted** (no delete, no merge, and that `corroborated_by` is never written back).
- **The dashboard reads raw rows** (`getTriage`, `lib/queries.ts`), so duplicates appear in "Other activity", the full page and the score breakdown.
- **Primary's duplicates (live):**
  - **Zero:** rows #159 (`zero.inc/blog/...`, gemini-grounding) and #45 (`pulse2.com/...`, exa). Different URLs, same company and type. Merged in scoring, both shown in the UI.
  - **WSJ:** rows #574 (`.../new-yorks-primary-venture-partners-plans-expansion-...`) and #46 (`.../why-new-yorks-primary-venture-partners-wants-to-plant-a-flag-...`). Two different WSJ URLs about the same story, with `company_name` null, so the company rule can't merge them.
- **Fuel Ventures, the same deal three times:** `company_name` reads "Doris", "Doris Labs" and a description, so the exact-name match fails and all three count.
- **Live:** 44 (VC, company, type) groups in the window are stored more than once.

## 9. Score formula vs the UI and Primary's 61

Code (`lib/score.ts`):

```ts
signalValue = TYPE_WEIGHT[type] * RELEVANCE_MULT[relevance] * stageMultiplier(stage) * confidence * exp(-daysAgo/14)
followUpScore: raw = top3(values).sum + (sourcesAgree(signals) ? 10 : 0)
               score = min(100, round(raw * firmFit)); if no direct/thematic signal: min(score, 45)
```

The pipeline passes **deduplicated** signals (`pipeline.ts:246, 270`). For Primary (firm fit 1.15 × 1.1 × 1.0 = **1.265**) at the time of the run:

- Lantern 34.6 + Zero 3.3 + LinkedIn event 0.5 = 38.4
- `+10`: the kept Zero row carries `corroborated_by` from its own duplicate
- 48.4 × 1.265 = 61.2 → **61** ✓

The UI (`lib/queries.ts:183-187`, `Workspace.tsx:214-216`) recomputes the top three from **raw, non-deduplicated** rows: 34.6 + 3.3 (Zero) + 3.3 (Zero again). Its text puts the +10 *before* the fit multiplier, which gives (41.2 + 10) × 1.26 = 64.5. It also recomputes the values at page-load time, not at run time.

So **the UI breakdown is wrong**, and the **+10 bonus comes from one deal reported twice**, not from independent confirmation of the lead (Lantern itself is single-source: `confirmed: false`).

## 10. Lanes

```ts
// lib/triage.ts:74-81
export function laneOf(r: LaneInput): Lane {
  if (!r.hasSignal || r.score < 30) return "parked";
  const ok = !!r.tags && fitConfirmed(r.tags);
  const waiting = r.status === "waiting_for_response";
  if (waiting && ok && /nudge/i.test(r.action)) return "follow";
  if (!waiting && r.score >= 60 && ok) return "today";
  return "maybe";
}
```

- **Why active VCs are parked:** any score under 30 is parked, whether or not there are signals. **40 of 41** parked VCs have a signal in the window; only Tech Square Ventures has none. The copy ("No strong signal this month", `Triage.tsx`) describes *quiet*, but the rule is *low score*.
- **Why Primary isn't in Message today:** `status = waiting_for_response` (demo data), so line 78 routes it to *follow*. "Message today" is only for VCs not yet contacted (line 79). That is intended. The empty-state text "No one scored 60 or more with a confirmed fit this week." (`Triage.tsx:182`) contradicts it.
- **Why the audit's logistics funds are parked:**

| VC | Score | Why |
|---|---|---|
| Prologis Ventures | 11 | Its 5 Oct interview **is** classified `direct` (value 15.7), but it's the only signal, and firm fit is **0.76** (corporate venture arm × 0.6), so 15.7 × 0.76 ≈ 12 |
| Supply Change Capital | 5 | Top signal is a chemical-container hardware deal: `sector none / hardware → unrelated` |
| Ironspring | 6 | Wyre AI (document AI) classified `partial` → `adjacent` |
| Schematic | 11 | Three tier-D LinkedIn posts (confidence ~0.5) |

- **Why off-topic VCs are in Maybe:** *Maybe* has no relevance gate, only `score >= 30`. Elevation (37) is three `adjacent` AI items (the open-weight video counts at 0.6×). Fuel (34) is the same Doris pre-seed counted three times (§8).

## 11. Failed sources and failed runs

- **Per source:** every adapter is isolated (`Promise.allSettled`, `pipeline.ts:104-120`). 401/403/429/432 trips a circuit breaker for the rest of the run (`:112-115`).
- **Gemini failure:** recorded (`:140-143`); no new signals are added.
- **Scores are not recomputed from partial data alone.** Step 5 scores the **whole stored 30-day window** (`pipeline.ts:242-246`), so a Gemini outage keeps last week's evidence and the score decays naturally. The VC isn't wiped.
- **Exception:** if loading stored signals throws, `window` falls back to this run's `fresh` items (`:244-249`), and the VC is scored and **written** from partial data.
- **Previous state:** the scan **always** writes the four columns (`:275`), even when every source failed. `last_signal_date` is kept if no signal is found (`coalesce`). The summary and score are overwritten with the recomputed values.
- **VCs skipped for time** are not written at all (`run.ts:74-77`), so they keep their previous state.
- **No alerting** exists.
- **Run "Result" status** (`app/runs/page.tsx:31-37` → `runState`, `lib/queries.ts`):
  - `ok`: `finished_at` is set and no error starts with `"run failed"`. Shown as **"Finished in Ns"** regardless of the error count (101 errors → "Finished").
  - `running`: unfinished and under 10 minutes old.
  - `failed`: anything else.
- **Run now dialog:** always shows a ✓ icon when done, even for failed sources (`components/RunNowButton.tsx:71-72`). Its failed set uses `SOURCE_KEYS` names from `result.failedSources`.
- **Status pill:** counts a source as missed only if its error contains "skipped for the rest of this run" (`lib/triage.ts:115-116`). So SEC 500, portfolio 403 and news-rss parse errors still show as "10 of 10".
- **Note:** in the auditor's 17:06 manual run, **news-rss failed for 29 VCs** (`Unquoted attribute value…` / `Feed not recognized as RSS`, meaning Bing returned HTML). That is not a 4xx, so the breaker didn't trip and the pill didn't count it.

## 12. The "Since X: N new signals… 12 went quiet" line

Computed in `lib/status.ts:17-25` from `getTriage()` (`lib/queries.ts`):

- **`day`:** weekday of `previousRun`, the second-newest **finished run with ≥ 40 VCs, any trigger** (manual counts).
- **`N new signals`:** `lastGoodRun.usage.newSignals` = the sum of `fresh.length` (`run.ts:108`, `pipeline.ts:219`). That counts every verified item seen in the run, **including ones already stored**. Live: the cron run reported **86** but inserted **38** new rows; the manual run reported **112** but inserted **41**.
- **Mover / "went quiet":** from `v_score_changes` (`0001_init.sql:256-270`), the newest `vc_score_history` row vs the one before it, per VC, regardless of which run wrote them. "Went quiet" = parked and `delta < 0`.
- **Why a manual run resets it:** a manual full run becomes `lastGoodRun`, and the previous one (the cron) becomes the baseline ("Since Monday"). `v_score_changes` now compares two runs a few hours apart, so most deltas are 0 and the quiet count disappears.
- **Nothing stores a "went quiet" state.** It isn't a list and isn't a link.

## 13. portfolio-diff

- **403s are not "every run, every firm".** In runs 15, 19 and 20, only **3 firms** returned 403: **Blume** (`blume.vc/companies`), **LetsVenture** (`lvxventures.com/portfolio`) and **Mela** (`melaventures.in/portfolio-companies/`). These are bot protection rejecting the descriptive User-Agent (`lib/http.ts`). The code deliberately doesn't retry through Jina after a refusal (`portfolio-diff.ts:26-27`).
- **Why it returns 0 signals:**
  - 44 active VCs have a portfolio URL; 34 have been snapshotted (195 snapshots).
  - An addition must be absent from the oldest of the last three snapshots and present in the latest two (`lib/portfolio.ts:130-135`, the 2-run debounce).
  - The data spans only ~2 days of runs, and **every firm's snapshots have identical hashes** (no portfolio page changed).
  - So zero additions is the correct output today. There have been 0 `portfolio-diff` signals ever.
- It can't be called a silent outage yet, but 3 firms are permanently blocked, and pages that render fewer than 10 entries are skipped silently (`portfolio-diff.ts:76`).

---

## Confirmed bugs

Verdict per audit finding (F1–F34).

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| F1 | "Parked" isn't "quiet" | **Confirmed** | `laneOf` parks any score < 30 (`lib/triage.ts:75`); 40 of 41 parked VCs have a signal in the window. |
| F2 | Relevance gate wrong both ways | **Partially true** | Maybe has no relevance gate (Elevation = 3 `adjacent` AI items; Fuel = one deal ×3). But Prologis is parked by firm fit 0.76 on a single `direct` interview, and Supply Change's top signal really is off-topic hardware. |
| F3 | Can't edit notes, log contact, mark sent | **Confirmed** | No write route for user columns; the dashboard is read-only by design (`CLAUDE.md` rule 8). |
| F4 | No import / add investor | **Confirmed** | Only `scripts/seed-vcs.ts`; no `/import` route (`app/` has no such page). |
| F5 | AI changes facts / mislabels types | **Confirmed** | Role comes from regex on Gemini's summary (`lib/triage.ts:98`), which says "co-led" while the stored quote says "led by Primary"; type labels come from Gemini's `signal_type` (`labels.ts:16-20`). |
| F6 | "Date and link checked" passes homepages | **Confirmed** | Badge is unconditional (`Workspace.tsx:64`); TMV, Better Capital and Eclipse: root URL, no page date, quote not on page. |
| F7 | No auth; a stranger could overwrite notes | **Partially true** | No login, so reads are public. But there's no browser DB key and `vc_runtime` has no UPDATE on `vcs`, so notes can't be overwritten. |
| F8 | "No one scored 60" vs Primary's 61 | **Confirmed** (copy) | Primary is in *follow* because it's `waiting_for_response` (`triage.ts:78`); empty-state text at `Triage.tsx:182` ignores that. |
| F9 | Freshness invisible / misreported | **Confirmed** | Pill text hidden below 1100 px (`globals.css:322-323`; audit at 1084 px); missed-source count only matches "skipped for the rest of this run" (`triage.ts:116`). |
| F10 | Run results hide failures | **Confirmed** | ✓ for every source (`RunNowButton.tsx:71`); "Finished" whenever `finished_at` is set (`runs/page.tsx:37`); raw error strings. |
| F11 | Score hidden and doesn't reconcile | **Confirmed** | UI breakdown uses non-deduplicated rows and puts +10 before the multiplier (`queries.ts:184-187`, `Workspace.tsx:216`); the real result is (38.4 + 10) × 1.265 = 61. |
| F12 | Duplicate signals | **Confirmed** | Storage is unique only per URL (`0001_init.sql:71`); `dedupe` runs only in memory at scoring (`verify.ts:214`); WSJ ×2, Zero ×2, Doris ×3. |
| F13 | Hero + grid on every tab | **Confirmed** | `showBand = view !== "discover"` (`Triage.tsx:114`). |
| F14 | Since-line fragile | **Confirmed** | Baseline is the previous full run of any trigger (`status.ts:20`); "quiet" is score-delta-based and unstored; `newSignals` over-counts (86 reported vs 38 inserted). |
| F15 | Routine over 5 minutes, notes last | **Confirmed** | Panel order in `Workspace.tsx`: Why now → Fit → Activity → Evidence → What to say → Who to contact → Firm → Score → Notes. |
| F16 | Contact identity unclear; stale titles | **Confirmed** | Header shows `vcs.partner_name`; contacts are ranked separately (`contacts-refresh.ts`); `team_change` signals never update `vc_contacts.title`. |
| F17 | Clunky drafts, no AI label | **Partially true** | Draft checks cover punctuation, flattery and length, not grammar (`messages.ts:53-68`); "Check it before you send" appears only under the opening line. Grammar quality is subjective. |
| F18 | Different dates in different views | **Confirmed** | Focus age uses the lead signal's date (`Triage.tsx` `Age`); the Table uses `lastSignalDate` (newest). |
| F19 | Table interactions limited | **Partially true** | Row click calls `select()`, which `setView("focus")` (`Triage.tsx:57`); no anchor links. But the lane chips do filter the Table. |
| F20 | Search name-only | **Confirmed** | `SearchModal` filters on firm + partner only (`TopBar.tsx`). |
| F21 | Demo tour page-blind / stuck | **Partially true** | `onPage` checks only the pathname (`DemoTour.tsx:130`), so starting from Discover (`/?view=discover`) counts as "home" and early targets are hidden. The other symptoms weren't reproduced. |
| F22 | Run now blocks the app | **Confirmed** | `dialog.showModal()` with no timer or cancel (`RunNowButton.tsx:45`). |
| F23 | Run history hard to find, noisy | **Confirmed** | The dot is the only entry below 1100 px; script runs are listed with internal source names. |
| F24 | Mobile issues | **Confirmed** | Band before queue; Table `min-width: 760px` scrolls inside its wrapper. |
| F25 | Board duplicates Focus | **Not a bug** | Intentional view from the triage spec (`dashboard-design.md` §3); a product choice. |
| F26 | Amber overloaded | **Not a bug** | Intentional tokens (`globals.css` `:focus-visible` amber); a valid design critique, not a defect. |
| F27 | Prologis panel has no fit section | **Confirmed** | Fit tags render only for non-parked rows (`Workspace.tsx`, parked branch). |
| F28 | Full page vs panel; no loading feedback | **Confirmed** | No `app/loading.tsx`. |
| F29 | Default 404 | **Confirmed** | No `app/not-found.tsx`. |
| F30 | Visual polish (empty slot, formats) | **Confirmed** | 26 px rank column always reserved (`globals.css:154`); amounts copied from summary text (`dealFacts`). |
| F31 | Muted text contrast likely low | **Not a bug** | axe-core: 0 colour-contrast violations on every view, light and dark, at 390 and 1440 px. |
| F32 | System/user boundary half-drawn | **Confirmed** | Only "Your notes" is tagged; system fields have no "Auto" label. |
| F33 | Discover has no action | **Confirmed** | Read-only cards by design (no add/dismiss route). |
| F34 | Scheduled run fires late | **Partially true** | Started 02:54 UTC for a 02:30 UTC schedule. Vercel Hobby cron timing only guarantees the hour; the code has no delay. |

**Also found:**
- **`newSignals` over-counts:** it counts re-seen items. Reported 86 vs 38 inserted (cron), 112 vs 41 (manual).
- **Bing News RSS failed for 29 VCs in the 17:06 manual run** (HTML instead of RSS). The breaker and the pill don't catch it.
- **The `+10` "two sources agree" bonus is earned by one deal reported twice** (Primary/Zero), not by independent confirmation.
