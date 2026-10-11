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

## 3. Layout

### 3.1 Reading order (desktop ≥ 1200 px: main column + right rail)

```
┌────────────────────────────────────────────────────────────────────┐
│ ● Live data. Updated Thu 8:02 IST. Next run Mon 8:00.   [Run now] │  StatusBar
│                                                                    │
│ Seven investors are worth a message this week          ┌─────────┐ │  Headline
│ Four more are waiting on a reply and have news to use. │ Since   │ │
│ ■■■■■■■■■■□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□□    │ Monday  │ │  PipelineStrip   | ChangesPanel
│ Reach out 7   Nudge 4   Parked 39                      │ ...     │ │
│                                                        └─────────┘ │
│ Reach out this week                                    ┌─────────┐ │
│ ┌────────────────────────────────────────────────────┐ │ Not on  │ │
│ │ 1  Kestrel Ventures  Mara Osei        [6 days ago] │ │ your    │ │  TopPickRow     | SuggestedPanel
│ │    Led the seed round in Routely, ...              │ │ list yet│ │
│ │    ▁▁▁▁█▁▁▁█▁▁▁...   (30-day tape)                 │ └─────────┘ │
│ │    [Inc42↗] [Blog↗] [Confirmed by 2 sources]       │             │
│ │    Fits: B2B, logistics, software, seed            │             │
│ │                          [Copy opening line]       │             │
│ ├────────────────────────────────────────────────────┤             │
│ │ 2  Harbor Seed ...  one-line reason        [See evidence]          │  CompactRow
│ │ 3  ...                                                 │         │
│ │ Show 4 more                                            │         │
│ └────────────────────────────────────────────────────┘             │
│ Waiting on a reply, with something new to say                      │  NudgeList
│ ...                                                                │
│ 39 parked. No strong signal this month.            [Show]         │  ParkedList (collapsed)
│ That's everything for this week. Next update Mon 8:00 IST.         │  EndNote
└────────────────────────────────────────────────────────────────────┘
```

- Main column: `max-width: 760px`, left-aligned, not centered, so the eye has one strong left edge.
- Right rail: `width: 280px`, sticky at `top: 24px`, holds `ChangesPanel` then `SuggestedPanel`.
- Below 1200 px: single column; the rail panels move below `NudgeList` and above `ParkedList`.
- Below 640 px: rows go full-bleed (no side borders), action buttons become full width, the tape appears only on the top pick.

### 3.2 Where each output goes

| Output | Location | Why |
|---|---|---|
| Shortlist count and names | Headline + first rows, top left | First place the eye lands; answers "who" |
| Why-now sentence | First text line of every row, largest body size | People act on a story, not a number |
| Freshness ("6 days ago") | Chip, top right of the row | Says how fast to move |
| 30-day signal tape | Under the sentence (top pick and nudges; compact rows get it small) | Heating up vs dead at a glance |
| Evidence links, confirmation | Directly under the tape | Proof before trust |
| Recommended action | The button label | The verb is where the eye ends |
| Score | Detail page only; it drives sort order | A visible "73" invites arguing instead of acting |
| Vikram's status and last contact | Small lock chip on the row | Marks his data as separate from system data |
| Changes since last run | Right rail (desktop) or below nudges | Answers "what's different?" without competing |
| Suggested investors | Right rail under changes | Discovery, secondary |
| Quiet list | Last, collapsed | Reported, out of the way |
| Run status, Run now | Top bar, small | Builds trust, not the point of the page |

## 4. Components

Extends the list in `docs/components-map.md` §3.3. Names are file names in `components/`.

| Component | Behavior |
|---|---|
| `StatusBar` | Green dot + "Live data. Updated {time}. Next run {time}." plus `RunNowButton`. If the last run failed: amber dot, "Last run didn't finish. Showing data from {time}." |
| `Headline` | One sentence from §8. Count words ≤ nine are spelled out ("Seven"), ten and above use digits. |
| `PipelineStrip` | 50 squares (11 px, 3 px gap), colored by bucket, ordered Reach out, Nudge, Parked. Legend below with counts. Each square has an accessible name (`"Kestrel Ventures, reach out"`); click scrolls to and highlights the row (parked squares expand the parked list). |
| `RankedRow` | Two variants. `top` (rank 1): tinted background, full layout from §3.1. `compact` (rank 2+): rank, firm, one-line reason, small tape, one button. Rows list the first 3; "Show N more" expands the rest in place. |
| `SignalTape` | 30 cells, oldest left, today right. Props: `daysAgo: number[]`, `size: 'sm' \| 'md'`, `tone: 'act' \| 'nudge'`. Empty day: 8 px tall, slate-100. Signal day: 16 px tall; ≤10 days old uses the tone color with a 1 px ink outline at 35% alpha; older uses slate-400. Has `role="img"` and `aria-label="Signals on N of the last 30 days; most recent X days ago"`. |
| `FreshnessChip` | "6 days ago", "today", "yesterday". Tone follows age: ≤ 7 days amber tint, 8–14 neutral, > 14 slate. |
| `SourceChips` | Up to three outlined chips (source name + external-link icon, `rel="noopener noreferrer"`, `target="_blank"`). Overflow becomes "+N more" that links to the detail page. |
| `ConfirmationBadge` | Teal tint "Confirmed by 2 sources" when `corroborated`; slate "Unconfirmed, check the source" for tier D with no corroboration; nothing for tier A/B. |
| `FitLine` | Text only. Lists axes that pass: "Fits: B2B, logistics, software, seed". If a signal is adjacent, name the gap: "Partial fit: consumer logistics". |
| `YoursChip` | Lock icon + "Yours: yet to reach out" or "Yours: waiting since 16 days". Neutral grey. Appears wherever Vikram's data appears. |
| `CopyLineButton` | Copies `openingLine` (reach-out rows) or `nudgeLine` (nudge rows) to the clipboard, shows a toast "Opening line copied" / "Nudge line copied". If the line is missing, the button reads "See evidence" and goes to the detail page. No database write. |
| `NudgeList` | Same row anatomy as `compact`, plus the `YoursChip`. Shows 3, "Show N more". |
| `ChangesPanel` | One short paragraph (copy in §8). Names are links to rows. |
| `SuggestedPanel` | Up to 3 rows from `suggested_vcs`: firm, reason, evidence link. Heading "Not on your list yet". |
| `ParkedList` | Collapsed by default. Expanded rows are single-line: firm, last known signal date, "Quiet" tag. Never red. |
| `EndNote` | "That's everything for this week. Next update {time}." |
| `RunNowButton` | Opens a small dialog for the demo passcode, then runs the pipeline. Progress is a checklist of sources with a spinner or check per line, not a bare spinner. Single-run lock (§9). |

`/vc/[id]` (detail page) keeps the structure from `components-map.md` §3.2, with this order: headline reason, `SignalTimeline`, `FirmProfileCard`, then Vikram's notes and contact history (read-only, `[DEMO]` prefix), then the score and its breakdown (type, relevance, stage, recency) for anyone who wants the arithmetic.

## 5. Visual system

Tokens go in `app/globals.css` as CSS variables. Light theme only in v1; names are semantic so a dark theme can be added later.

```css
:root {
  --fog: #EEF1F3;          /* page background */
  --paper: #FFFFFF;        /* row surface */
  --ink: #17243A;          /* text, outlines */
  --ink-2: #4A5666;        /* secondary text */
  --amber: #F2A900;        /* act now (fills only) */
  --amber-100: #FDEFC3;  --amber-ink: #6B4A00;
  --blue: #3B6FB6;         /* nudge */
  --blue-100: #E3EDF8;   --blue-ink: #1F4A82;
  --teal: #1F7A70;         /* verified */
  --teal-100: #DDF1EE;   --teal-ink: #14594F;
  --slate: #8A96A6;        /* parked, empty tape cells */
  --slate-100: #E4E8EC;  --slate-ink: #4A5666;
  --line: rgba(23, 36, 58, 0.14);
  --radius-sm: 6px;  --radius-md: 12px;
}
```

- **Amber is the only loud color.** Use it for the top-pick tint, the freshness chip on recent signals, hot tape cells, and the Reach out squares. Do not use amber for buttons or decoration.
- **Never use red** anywhere for quiet or low-score investors. Red is reserved for genuine errors (failed run), in text only.
- **Text on tinted backgrounds** uses the matching `-ink` color, not black or grey.
- **Fonts** via `next/font/google`: *Barlow Semi Condensed* (500) for the headline, firm names and numbers; *Atkinson Hyperlegible Next* (400, 500; fall back to *Atkinson Hyperlegible* if unavailable) for everything else. Two weights only. Sentence case everywhere; no all-caps labels, no tracked-out eyebrows.
- **Type scale:** headline 28/34 (mobile 24/30), firm name 17/24, reason sentence 16/24, chips and meta 13/18, minimum anywhere 12.
- **Line length:** reason sentences max 70 characters wide (`max-width: 62ch`).
- **Spacing:** 4 px base; row padding 16 px (top pick) / 12 px 16 px (compact); 24 px between sections.
- **Structure:** lists are bordered rows in one rounded container (`1px solid var(--line)`, `--radius-md`, overflow hidden), not separate cards. No shadows, no gradients.
- **Icons:** one outline icon set (Lucide). Used for external link, copy, lock, refresh, chevron.
- **One memorable thing:** the `SignalTape`. Keep everything else quiet.

### Motion

- On first load only, tape cells fade in left to right (about 250 ms total).
- After Run now, rows that changed get a 2 s amber-tint highlight that fades out.
- Everything else is static. Respect `prefers-reduced-motion` (no animation at all).

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

- No gradients, glows, shadows, glassmorphism, or illustrations of robots/sparkles. No "AI-powered" badges.
- No all-caps labels, no tracked-out eyebrows, no `→` appended to buttons, no emoji.
- No big-number stat tiles as the hero. The headline is a sentence.
- No identical rounded cards for every block. Use bordered rows in one container.
- No numbered markers except the rank on reach-out rows (that is a real ranking).
- No raw field names, enum values or scores as headline content.
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
