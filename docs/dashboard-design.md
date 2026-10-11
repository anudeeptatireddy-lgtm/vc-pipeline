# Dashboard Design Spec

For Claude Code. This is the build spec for the dashboard (output O2). Rules live in `CLAUDE.md`; component inventory and system context live in `docs/components-map.md` §3. This file wins on anything visual or about wording.

## 1. Purpose and the person

Vikram is a first-time founder, two months into raising a Seed round for a B2B logistics SaaS. He opens this twice a week, before he starts emailing. He is tired, short on time and sensitive to rejection. He needs five answers, in this order:

1. Who should I contact?
2. Why now?
3. What do I say?
4. Is this real?
5. Who can I ignore?

The page must answer 1 and 2 within five seconds of loading, with no scrolling and no clicking. Everything else is progressive disclosure.

## 2. Non-negotiables

1. **Read-only.** Nothing under `app/` or `components/` writes to the database. The only write path is the `runNow` server action, which starts the pipeline (it does not write rows itself).
2. **Reads go through `lib/queries.ts` over SQL views** (see §6). No direct table access from pages.
3. **Never rely on color alone.** Every state also has a label, a shape or a height difference.
4. **Never blank.** If the latest run failed or no data exists, show the last good data with a notice (§9).
5. **Every row that recommends action shows at least one working source link.** A reach-out row without evidence is a bug.
6. **Demo data stays labelled.** Vikram's notes, status and contact history display their `[DEMO]` prefix.
7. **Mobile first.** Design at 390 px wide, then enhance.
8. **Plain words.** User-facing text never shows column names (`follow_up_score`), enum values or jargon. Use the copy in §8.

## 3. Layout (triage, October 2026)

Replaces the single-column "reach out list" layout. The clickable prototype it was matched to is the claude.ai artifact "Pipeline: layout prototype"; this section describes what was built with real data.

### 3.1 Structure

```
┌ Pipeline  Focus Board Table Discover ····· ● Checked 9 of 10 sources. Updated Mon 8:02 IST  [Search /] [Demo] [◐] [Run now] ┐  TopBar (sticky)
│                                                                                                                         │
│ No one needs a first message today.                                              ▦▦▦▦▦▦▦▦▦▦                             │  Briefing band:
│ One investor you're waiting on has news ... Eight more are worth a look.          ▦▦▦▦▦▦▦▦▦▦  yard map, 10 columns,      │  headline, subline,
│ ● Since Sunday: 68 new signals. Prime Venture Partners moved up 13 points.        ...         sorted by lane            │  since-last-run line
│                                                                                  [Message today 0][Follow up 1][Maybe 8][Parked 41]  legend chips filter
│                                                                                                                         │
│ Message today 0            │ ┌ Workspace (sticky) ───────────────────────────────────────────────┐                     │  Focus view
│ Waiting on a reply ... 1   │ │ Firm · partner · region   [Yours: waiting for 35 days] [Follow up] │                     │
│  ▌Primary Venture ... 6d   │ │ Why now: sentence + deal facts (company, round, size, role, date) │                     │
│ Maybe, if you have time 8  │ │ Does it fit you? ● Seed ● B2B ● Logistics ◐ Software              │                     │
│  ▌8VC ...                  │ │ Activity in the last 30 days (tape)                               │                     │
│ Parked 41 [Show]           │ │ Evidence (date and link checked) · Confirmed by 2 sources         │                     │
│                            │ │ What to say [Copy opening line c]                                 │                     │
│                            │ │ Who to contact: people, POC level, LinkedIn/X/email, drafts       │                     │
│                            │ │ The firm · How the score works · Your notes (locked, read-only)   │                     │
└────────────────────────────┴─┴───────────────────────────────────────────────────────────────────┴─────────────────────┘
```

- **Lanes** (`lib/triage.ts`, unit-tested): *Message today* = score ≥ 60, not already waiting, fit confirmed (B2B and logistics filled, no hollow seed or software tag). *Waiting on a reply, with something new to say* = Vikram is waiting, the pipeline says nudge, fit confirmed. *Maybe, if you have time* = score 30–59, or a higher score whose fit isn't confirmed, or a recent contact (Hold). *Parked* = everything else; collapsed.
- **Headline** counts only *Message today*. The subline mentions follow-ups and maybes.
- **Yard map**: one square per active investor, 10 columns, ordered by lane then score. Amber, blue, grey, dark, with container ridges; follow-up squares carry a notch and parked squares are flat, so lane is not color alone. Click selects, hover or focus shows the name, arrow keys move (one tab stop). Legend chips filter the queue, Board and Table.
- **Board**: four columns by lane (parked capped at 8 with a pointer to Table). **Table**: all 50, sortable (firm, lane, score, status, last signal), filter by name. **Discover**: `suggested_vcs` with the rubric score (`lib/rubric.ts`), deal count, founder-facing summary and caveat, evidence links.
- `/vc/[id]` is the same workspace at full width plus every signal on record. `/runs` is the run history. Both use the same top bar.
- **Keyboard**: `j`/`k` move through the queue, `c` copies the line, `/` or Cmd+K opens search, Esc closes the sheet or search.
- **Phone (≤ 1000 px)**: the band stacks, the workspace opens as a full-screen sheet with a Back button (focus moves to it; Esc or Back returns to the list). At ≤ 640 px the tabs wrap under the bar, Demo and Run now become icon buttons with labels for screen readers, and the status pill moves under the bar.

### 3.2 Where each output goes

| Output | Location |
|---|---|
| Who to contact this week | Headline + *Message today* lane |
| Why now | Workspace "Why now" box: the lead signal's sentence and deal facts |
| Fit | Four tags: filled, half, hollow, each with a text label |
| Freshness | Queue item age ("Fresh · 4d" when ≤ 7 days) and the 30-day tape |
| Evidence | Lead signal plus items about the same company, deduplicated by link and site; the rest under "Other activity this month" |
| What to say | Opening or nudge line with Copy; per-person email, LinkedIn note and follow-up drafts under Who to contact |
| Score | Inside "How the score works" (collapsed) and the Table; never the headline |
| Vikram's data | Lock chip and the locked "Your notes" panel; never edited |
| Run status | Status pill (links to `/runs`); calm wording |

## 4. Components

`components/triage/`: `TopBar` (tabs, pill, search modal, Demo, theme, Run now), `Briefing` (headline, since line, yard map, legend), `Triage` (state, Focus queue, Board, Table, Discover, keyboard), `Workspace` (one investor), `WhoToContact` (people and drafts, fetched from `/api/vc/[id]/contacts` when an investor opens), `InvestorPage` (`/vc/[id]`), `labels.ts` (copy). Shared: `RunNowButton` (no passcode; single-run lock and 3-hour cooldown), `ThemeToggle`, `DemoTour` (19-step guided tour).

## 5. Visual system

Tokens are CSS variables in `app/globals.css`. Dark follows the system setting by default; the toggle stores a choice and an inline script in `app/layout.tsx` applies it before paint (no flash).

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #EDF0F3 | #0C131B | page (also on `<html>`) |
| `--surface` / `--surface2` | #FFFFFF / #F4F6F9 | #121B26 / #182333 | panels, hovers |
| `--line` | #D3DAE3 | #243346 | borders |
| `--ink` / `--ink2` | #15202E / #4B596B | #E8EDF3 / #9EAEC1 | text |
| `--amber`, `--amber-ink`, `--amber-tint` | #F2A900, #6E4A00, #FDEFC3 | #F2A900, #F7C453, amber 14% | Message today |
| `--blue`, `--blue-ink`, `--blue-tint` | #3B6FB6, #1F4A82, #DCE8F7 | #6FA3EA, #A9C6EE, blue 17% | Follow up |
| `--teal`, `--teal-ink` | #1F7A70, #14594F | #4CC2B0, #8FD9CE | checked, confirmed, fit |
| `--maybe`, `--park` | #7F8EA3, #C3CCD8 | #70819B, #2B3A4E | Maybe, Parked |

- Fonts: *Barlow Semi Condensed* (headings, firm names, numbers) and *Atkinson Hyperlegible Next* (body), via `next/font`.
- Text on tints uses the matching `-ink` color. WCAG AA in both themes (axe-core: 0 violations on every view at 390 and 1440, light and dark).
- Red only for genuine errors, in text.

### Motion

- One orchestrated load animation: the yard map squares drop in (about 0.5 s, staggered). Nothing else animates on load.
- `prefers-reduced-motion`: no animation at all.

## 6. Data contracts (migration additions)

New migration `supabase/migrations/<timestamp>_dashboard_read_model.sql`. These add to `docs/components-map.md` §3.6; do not duplicate its views.

```sql
-- Words Vikram can copy. Live in signals, never in vcs.
alter table public.signals
  add column if not exists opening_line text,
  add column if not exists nudge_line text,
  add column if not exists signal_value numeric;

-- Score history for "since last run" changes. System-owned, written by the pipeline.
create table if not exists public.vc_score_history (
  id bigserial primary key,
  vc_id uuid not null references public.vcs(id) on delete cascade,
  run_id bigint references public.pipeline_runs(id),
  follow_up_score int not null,
  recommended_action text not null,
  created_at timestamptz default now()
);
alter table public.vc_score_history enable row level security;
create index if not exists vc_score_history_vc_created on public.vc_score_history (vc_id, created_at desc);

-- Best signal per VC (drives the why-now sentence, chips, copy lines).
create or replace view public.v_top_signal as
select distinct on (s.vc_id)
  s.vc_id, s.id as signal_id, s.summary, s.published_date, s.source_url, s.source_name,
  s.source_tier, s.evidence_quote, s.sector_fit, s.customer_type, s.offering_type,
  s.round_stage, s.logistics_relevance, s.corroborated_by, s.opening_line, s.nudge_line
from public.signals s
where s.published_date >= current_date - 30
order by s.vc_id, s.signal_value desc nulls last, s.published_date desc;

-- Source links per VC (all evidence in the window, for chips).
create or replace view public.v_vc_sources as
select s.vc_id, s.source_name, s.source_url, s.source_tier, s.published_date
from public.signals s
where s.published_date >= current_date - 30;

-- Tape: days-ago for every signal in the window.
create or replace view public.v_signal_tape as
select s.vc_id, (current_date - s.published_date) as days_ago
from public.signals s
where s.published_date >= current_date - 30;

-- Change since the previous run.
create or replace view public.v_score_changes as
with ranked as (
  select vc_id, follow_up_score, recommended_action, created_at,
         row_number() over (partition by vc_id order by created_at desc) as rn
  from public.vc_score_history
)
select cur.vc_id,
       cur.follow_up_score as score_now,
       prev.follow_up_score as score_before,
       cur.follow_up_score - coalesce(prev.follow_up_score, cur.follow_up_score) as delta,
       cur.recommended_action as action_now,
       prev.recommended_action as action_before
from ranked cur
left join ranked prev on prev.vc_id = cur.vc_id and prev.rn = 2
where cur.rn = 1;
```

Pipeline changes this requires:
- `lib/db.ts` gets `recordScoreHistory(vcId, runId, score, action)`: a plain insert into `vc_score_history` (service role). It does not touch `vcs`.
- `lib/gemini.ts` extraction schema adds `opening_line` and `nudge_line` per signal (see §7).
- `lib/score.ts` writes `signal_value` for each signal it scores.

Typed row the dashboard works with (`lib/types.ts`):

```ts
export type Bucket = "reach_out" | "nudge" | "parked";

export interface DashboardRow {
  id: string;
  firm: string;
  partnerName: string | null;
  priority: "P1" | "P2" | "P3" | null;
  region: string | null;
  status: "waiting_for_response" | "yet_to_reach_out" | null; // Vikram's data
  lastContactDate: string | null;                             // Vikram's data
  action: RecommendedAction;                                  // shared constants, components-map §3.4
  bucket: Bucket;
  score: number;
  scoreDelta: number | null;
  top: null | {
    summary: string;
    publishedDate: string;
    sources: { name: string; url: string; tier: "A" | "B" | "C" | "D" }[];
    corroborated: boolean;
    fit: { sector: string; customer: string; offering: string; stage: string };
    openingLine: string | null;
    nudgeLine: string | null;
  };
  tapeDaysAgo: number[];
}
```

Bucket mapping (replaces the "Hold" row in `components-map.md` §3.4): `Reach out this week` and `Reach out if capacity allows` → `reach_out`; `Nudge now` and `Light nudge` → `nudge`; `Hold` and `Quiet: deprioritize this week` → `parked`. Order inside a bucket: score descending, then most recent signal.

## 7. Opening and nudge lines (Gemini)

Generated in the same extraction call, one short line per signal that is `direct` or `thematic`; otherwise `null`. Rules to put in the prompt:

- Max 30 words, plain, first person from the founder ("I", not "we").
- Mention only facts stated in the evidence quote or source (the deal, the post, the talk). Never invent a shared connection, a compliment about taste, or a claim about the investor's intentions.
- Opening line: reference the signal, then one clause on why a B2B logistics SaaS at seed fits it. No ask for a meeting in the line.
- Nudge line: acknowledge the earlier message, reference the new signal, no guilt or pressure.
- No exclamation marks, no flattery, no filler.

Add to the JSON schema in `docs/signal-sources.md` §7.1: `"opening_line": {"type":"string"}`, `"nudge_line": {"type":"string"}` (both optional). Validate length in zod; drop lines over 40 words.

## 8. Copy deck

Sentence case, contractions, active voice, no terminal punctuation on labels and buttons, no "please", no "successfully".

| Where | Text |
|---|---|
| Status, live | `Live data. Updated {Thu 8:02 IST}. Next run {Mon 8:00}.` |
| Status, failed | `Last run didn't finish. Showing data from {Thu 8:02}.` |
| Headline (n ≥ 2) | `{Seven} investors are worth a message this week` |
| Headline (n = 1) | `One investor is worth a message this week` |
| Headline (n = 0) | `No one stands out this week` with sub `Nothing new and relevant in the last 30 days. Check back after the next update.` |
| Subline | `{Four} more are waiting on a reply and have news you can follow up with.` (omit if 0) |
| Section headings | `Reach out this week` · `Waiting on a reply, with something new to say` · `Not on your list yet` |
| Buttons | `Run now` · `Copy opening line` · `Copy nudge line` · `See evidence` · `Show {n} more` · `Show` · `Hide` |
| Toasts | `Opening line copied` · `Nudge line copied` |
| Freshness | `today` · `yesterday` · `{n} days ago` |
| Confirmation | `Confirmed by 2 sources` · `Unconfirmed, check the source` |
| Fit | `Fits: B2B, logistics, software, seed` · `Partial fit: {gap}` |
| Yours chip | `Yours: yet to reach out` · `Yours: waiting since {n} days` |
| Changes | `Since {Monday}: {n} new signals. {Firm} moved up {k} points. {j} went quiet.` Drop any clause that is zero; if all zero: `No changes since {Monday}.` |
| Parked | `{n} parked. No strong signal this month, so no need to spend time here.` |
| End | `That's everything for this week. Next update {Mon 8:00 IST}.` |
| Run progress | `Checking {source name}` per line, then `Run finished. {n} new signals.` |
| Source failed | `{Source} didn't respond. The rest finished.` |
| Run failed | `The run didn't finish. Showing data from {time}.` |
| Stale (> 5 days) | `This data is {n} days old. Run now to refresh.` |
| Empty list | `Nothing to show yet. Run now to check your investors.` |

## 9. States

| State | Behavior |
|---|---|
| First load | Server-rendered; headline and top rows in the initial HTML. Skeleton only for the right rail. |
| Running | `RunNowButton` dialog shows the per-source checklist. Only one run at a time; if `pipeline_runs` has a row with `finished_at is null` started within 10 minutes, the button says "A run is in progress" (no toast, no retry). |
| Partial failure | Dashboard shows new data; `StatusBar` notes the failed source in the details link to `/runs`. |
| Full failure | Last good data stays visible; `StatusBar` shows the failed-run message. |
| Stale | Notice from §8 appears above the headline. |
| No signals at all | Headline n = 0 variant; the parked list is expanded by default so the page isn't empty. |
| Missing line | `CopyLineButton` falls back to "See evidence". |

## 10. Accessibility and responsive rules

- Text contrast ≥ 4.5:1 (use the `-ink` colors on tints). Non-text indicators ≥ 3:1 or carried by shape/height too.
- Keyboard: every interactive element reachable; visible focus ring `outline: 2px solid var(--ink); outline-offset: 2px`.
- Touch targets ≥ 44 × 44 px on mobile.
- Landmarks: `header` (status), `main`, `aside` (rail), `footer` (end note). One `h1` (the headline), `h2` per section.
- The `PipelineStrip` and `SignalTape` have text alternatives; the page makes sense with them removed.
- Breakpoints: 640 and 1200 only.
- No horizontal scroll at 320 px.

## 11. Do not

- No glows, glassmorphism, or illustrations of robots/sparkles. No "AI-powered" badges. (The container ridges on the map and logo are the only texture.)
- No all-caps labels, no tracked-out eyebrows, no `→` appended to buttons, no emoji.
- No big-number stat tiles as the hero. The headline is a sentence.
- No numbered markers except the rank in *Message today* (a real ranking).
- No raw field names, enum values or scores as headline content.
- No placeholder data: every investor, signal, person and suggestion comes from the views and tables.
- No auto-playing or looping animation.
- No writes to the database from any dashboard code.

## 12. Development fixtures

Until the pipeline has run, build against `fixtures/dashboard.sample.json` (type `DashboardRow[]`) with fictional firms such as "Kestrel Ventures", "Harbor Seed Partners", "Lakeshore Capital", "Northgate Ventures", and a fictional portfolio company "Routely". Use fixtures only behind `NEXT_PUBLIC_USE_FIXTURES=true` in local dev. The deployed site must read real data from the views.

## 13. Acceptance checklist

- [ ] At 390 × 844 and 1440 × 900 (Playwright screenshots), the first screen shows the headline, the pipeline strip and the top reach-out row without scrolling.
- [ ] Five-second test: from a screenshot alone, a reader can name the top investor and say why.
- [ ] Every reach-out and nudge row has at least one source link that opens.
- [ ] Parked list is collapsed by default (unless there are no signals), contains no red, and never hides a reach-out row.
- [ ] No file under `app/` or `components/` imports a write helper; grep for `.insert(`, `.update(`, `.upsert(`, `.delete(`, `.rpc(` returns nothing there.
- [ ] `axe-core` reports 0 serious or critical issues on `/`, `/vc/[id]`, `/runs`.
- [ ] Lighthouse accessibility ≥ 95 and performance ≥ 85 (mobile).
- [ ] Reduced-motion setting disables the tape and row-highlight animations.
- [ ] Copy matches §8 (spot-check headline, buttons, chips, end note).
- [ ] With the latest run marked failed, the page still renders the last good data with the notice.
