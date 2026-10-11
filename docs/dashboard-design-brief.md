# Dashboard Design Brief and Superdesign Prompt

**Relationship to other files.** `docs/dashboard-design.md` is the build spec and wins on anything visual or about wording. This file does two things only: records the design rationale, and holds the self-contained prompt to paste into Superdesign (which cannot see the repo). If the two ever disagree, fix this file.

## 1. Rationale in one page

Vikram is tired, short on time, sensitive to rejection, and wary of AI inventing things. The design leans on a few ideas:

| Principle | How the spec applies it |
|---|---|
| Answer first, then explain | Headline sentence plus top pick answer "who" and "why now" in five seconds |
| Stories beat numbers | The reason sentence is the largest body text; the score is hidden from the list |
| Heating up vs dead at a glance | The 30-day signal tape, the page's one memorable element |
| One loud color | Amber means "act now"; everything else is quiet |
| Calm for the ignored | Parked investors are collapsed, grey, never red: permission to skip |
| Trust through proof | Source chips next to every claim, "Confirmed by 2 sources" badge |
| Ownership | Lock chip marks Vikram's own data as separate from system data |
| Low effort to act | "Copy opening line" puts the next step one tap away |

## 2. Options worth considering (not in the spec yet)

1. **Show the evidence quote under the opening line** before he copies it, so he can verify the model didn't stretch the facts.
2. **"Contacted" tick (v2).** Logging contact is Vikram's own data; if added, it needs its own narrow RPC, separate from `update_vc_signals`.
3. **Weekly rhythm cue.** The end note already says when the next update lands; consider showing "Last checked 3 of 3 sources" for those who want reassurance.
4. **Print/PDF view of the top five** for founders who work from paper or share with a co-founder.

## 3. Superdesign prompt

Paste into superdesign.dev, or run it through the Superdesign skill from Claude Code. All content is fictional placeholder data.

```
Design a responsive web dashboard (desktop 1440 and mobile 390) for a first-time startup founder who is raising a Seed round. Sentence-led, calm, editorial. Not a typical SaaS dashboard.

PRODUCT
Vikram's B2B logistics SaaS in India is raising a Seed round. He tracks about 50 VCs. Twice a week, before he starts emailing, this page tells him which investors are worth contacting right now and why, based on public activity in the last 30 days (an essay, a podcast, a new deal, a conference talk). The page is read-only; it never edits his own notes.

THE PERSON
Tired, short on time, sensitive to rejection, wary of AI inventing things. He needs five answers, in order: Who should I contact? Why now? What do I say? Is this real? Who can I ignore? The first two must be clear within five seconds, with no scrolling or clicking.

LAYOUT (desktop)
- Top status bar: green dot, "Live data. Updated Thu 8:02 IST. Next run Mon 8:00." and a small "Run now" button on the right.
- Headline (H1, one sentence, not stat tiles): "Seven investors are worth a message this week". Subline: "Four more are waiting on a reply and have news you can follow up with."
- Pipeline strip: 50 small squares (11 px, 3 px gap) coloured by bucket: Reach out (amber), Nudge (blue), Parked (slate), with a legend and counts underneath.
- Main column, max 760 px, left-aligned (one strong left edge). Section "Reach out this week": one container with bordered rows, not separate cards.
  - Rank 1 is the top pick: tinted background, rank number, firm name and partner, a freshness chip top right ("6 days ago"), then a one-sentence reason as the largest body text ("Led the seed round in Routely, a freight procurement tool for mid-size shippers"), then a 30-day "signal tape" (30 thin cells, oldest left, today right; empty days short and pale slate, signal days tall, recent ones amber), then outlined source chips ("Inc42 ↗", "Firm blog ↗") with a teal "Confirmed by 2 sources" badge, then the line "Fits: B2B, logistics, software, seed", then a lock chip "Yours: yet to reach out", and a button "Copy opening line".
  - Ranks 2-3 are compact rows: rank, firm, one-line reason, a small tape, one button "See evidence". A "Show 4 more" control expands the rest in place.
- Section "Waiting on a reply, with something new to say": three compact rows, each with a lock chip "Yours: waiting since 16 days" and a button "Copy nudge line".
- A collapsed row: "39 parked. No strong signal this month, so no need to spend time here." with a "Show" control. Expanded rows are single-line: firm, last known signal date, a neutral "Quiet" tag. Never red.
- Closing line: "That's everything for this week. Next update Mon 8:00 IST."
- Right rail, 280 px, sticky: a short paragraph "Since Monday: 4 new signals. Kestrel Ventures moved up 12 points. 2 went quiet." then "Not on your list yet" with up to 3 rows (firm, reason, evidence link).
- Below 1200 px: single column, rail panels move below the nudge list. Below 640 px: rows full-bleed, buttons full width, tape only on the top pick.

VISUAL SYSTEM
- Colours: page #EEF1F3, rows #FFFFFF, ink #17243A, secondary text #4A5666. Amber #F2A900 is the only loud colour (top-pick tint #FDEFC3, hot tape cells, freshness chip, Reach out squares); never use it for buttons. Blue #3B6FB6 for nudge. Teal #1F7A70 for verified. Slate #8A96A6 for parked and empty tape cells. Never use red except for a genuine error, text only. Text on tints uses the darker matching ink colour.
- Fonts: Barlow Semi Condensed 500 for the headline, firm names and numbers; Atkinson Hyperlegible Next 400/500 for everything else. Sentence case everywhere.
- Type scale: headline 28/34 (mobile 24/30), firm name 17/24, reason 16/24, chips and meta 13/18.
- Bordered rows in one rounded container (1 px line, 12 px radius). One outline icon set (Lucide): link, copy, lock, refresh, chevron.
- The signal tape is the one memorable element. Keep everything else quiet.

DO NOT
No gradients, glows, shadows, glassmorphism, robot or sparkle imagery, "AI-powered" badges, emoji, all-caps labels, big-number stat tiles, identical rounded cards for every block, numbered markers other than the real rank, scores as headline content, or looping animation.

STATES (design each)
Running: a dialog with a per-source checklist ("Checking Google News", "Checking Inc42", ...). Failed run: amber dot and "Last run didn't finish. Showing data from Thu 8:02." Stale: a notice above the headline, "This data is 6 days old. Run now to refresh." Quiet week: headline "No one stands out this week" with the parked list expanded.

SAMPLE DATA (fictional)
Kestrel Ventures (Mara Osei), Harbor Seed Partners, Lakeshore Capital, Northgate Ventures; portfolio company Routely. All dates within the last 30 days.

DELIVERABLES
Three variations of the desktop home that keep this spec but differ in how the pipeline strip and the top pick are arranged. Take the best through mobile and the states above. Output responsive HTML and CSS with named design tokens so a developer can port it to Next.js.
```

## 4. After the design is chosen

1. Keep the chosen design and tokens in the repo (Superdesign saves files under `.superdesign/`).
2. Build Phase 7 against it, using `docs/dashboard-design.md` for components, copy and states.
3. Where the mockup and the spec differ, decide once and update `dashboard-design.md` so Claude Code has a single source of truth.
