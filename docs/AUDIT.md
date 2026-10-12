# VC Pipeline: Hands-on UX & Brief Audit

**App audited:** https://vc-pipeline-lovat.vercel.app/
**Date:** Mon 12 Oct 2026, ~16:45–17:30 IST
**Widths tested:** desktop (1084 and 1440 px), phone (390 px)
**Method:** I used the app as Vikram in Chrome. I worked through all 9 tasks, opened 8 evidence links on the source sites, ran one manual refresh, and stepped through all 19 tour steps.

> **Read this first: scope limits**
> - **The prompt had placeholders.** Product name, login and the safe test record were never filled in. I searched for "test" and checked all 50 rows in the Table. No test record exists.
> - **Tasks 7 and 8 are blocked by the app, not by me.** The app has no way to add a note, edit contact history or mark someone as contacted. Notes are read-only everywhere ("Yours. This page never edits it."). I edited no records.
> - **I pressed "Run now" once** (Mon 17:06 IST). It ran for 179 seconds, found 112 new signals and logged 37 errors. Task 8 asked for a refresh, and this was the only way to test it. It did change the live signal data.
> - **No login.** The app opened straight away with no sign-in.
> - **Labels:** anything I could not see in the browser is marked **[Assumption]** or **[Can't verify]**.

---

## 1. Executive summary

VC Pipeline is much stronger than a typical AI demo. Every recommendation shows a dated source link. The VC detail view is well built: a "why now" card, fit chips, a 30-day activity strip, evidence, who to contact and editable drafts. The run history is open and complete.

It still **does not do Vikram's core job reliably today**. The worst problem is the **"Parked" lane, which is presented as "quiet" but isn't**. 39 of the 41 parked VCs had a signal in the last 30 days, including Prologis Ventures with a logistics-specific quote from 5 Oct. Meanwhile, signals with **nothing to do with logistics sit in "Maybe"**: a 1-minute YouTube short on open-weight AI models, and a pre-seed round in a sales-data tool. So the relevance filter is wrong in both directions.

The second problem is that **Vikram cannot manage his own data at all**. There is no import, no add-VC, no notes, no contact history and no "mark contacted". The note-preservation promise, the one he cares about most, can't be tested from the UI.

The third problem is **trust leakage in the evidence**:
- An AI summary says "co-led" where the source says "led".
- Two evidence links go to a firm's homepage rather than the article, yet still carry a "Date and link checked" badge.
- Signal types are mislabeled: a news-digest item is called an "Essay", and a YouTube short is called an "Interview".
- Data freshness is invisible on desktop: it shows only as an unlabeled green dot.

**Strengths worth protecting:**
1. Evidence-first detail panel with a dated source on every claim.
2. A clear visual split between "Yours" (lock icon) and system data.
3. Run history that logs each source and each error.

---

## 2. Vikram's verdict (Part 1, in his voice)

### First 10 seconds

"Big headline: 'No one needs a first message today.' Okay, so I'm off the hook? Then there's a block of 50 little squares on the right, and I have no idea what they are until I hover. My eye goes to the headline, then the squares, which tell me nothing. Then I finally see a list at the bottom of the screen.

It says one person to follow up with (Primary) and seven 'maybe if you have time'. The tile right under the headline says 'No one scored 60 or more with a confirmed fit.' But when I dig in, Primary scored 61 and matches on all four fit chips. Which is it?

How fresh is this? I can't tell. There's a green dot up top that does nothing when I hover. The only freshness line is at the very bottom of the list: 'Next update Thu 8:00 IST'. That's the *next* update, not the last one.

Who's quiet? There's 'Parked 42', which I assume means quiet. Then I open it and it says 'No strong signal this month', with 'Last signal 9 Oct' right next to the first name. That's three days ago."

### Task-by-task, in my voice

1. **First open.** "I got 'nobody today' in one glance, which I like. But it took me a while to trust it because the 60-point line contradicts the 61 score. The squares and chips are noise. I don't need a heat-map of 50 boxes, 41 of which look identical."
2. **Onboarding.** "Where do I put my list? There's no Import button, no 'Add investor', nothing. Discover even says 'adding one happens outside this page'. Outside where? I'd have to ask you, the engineer, to load my spreadsheet. That's a non-starter for a tool I'm supposed to own."
3. **Monday routine.** "I click Primary. Good: there's a nudge line and a ready-to-edit email. But I scroll a long way past fit chips and a bar chart to reach the evidence, then past five team members to reach my own notes. Then I need two more people and the list gives me 'maybes'. One is Elevation, whose reason is a video about open-weight AI models. Another is Fuel Ventures, which backed a *sales data* tool. Neither has anything to do with logistics. I'd end up with one strong email and two I wouldn't send. Realistically it took me 12–15 minutes, not five."
4. **Verifying.** "Primary checks out: the Lantern seed round is real and dated 5 Oct. But the source says Primary *led* it, and your app says *co-led*. If I write 'congrats on co-leading', I look sloppy. TMV's link dumps me on their homepage and I have to hunt for the article myself. Better Capital's link also goes to the homepage, and the quote isn't on it. You marked both 'Date and link checked'. Checked against what?"
5. **The score.** "The list doesn't show scores. The Table does. To learn *why*, I go to the detail panel, scroll to the bottom and expand 'How the score works'. It shows the same Zero deal twice (3.3 + 3.3), plus 10 because 'two sources agree'. Is that the same story counted twice? And I can't make the arithmetic come out to 61."
6. **Quiet ones.** "The morning summary said '12 went quiet'. Who? It's not a link, and after I hit Run now that line disappeared completely. The Parked list is mostly people with fresh activity. I genuinely can't answer 'who do I leave alone' from this screen."
7. **My own data.** "There's no way to type a note. It says 'Yours. This page never edits it.' Fine, but *I* can't edit it either. So I'm still keeping my spreadsheet, which defeats the point."
8. **Refresh test.** "Run now asks to confirm and warns me it takes about 4 minutes. Good. Then a modal locks the screen for three minutes with spinners and no timer. At the end it shows green ticks next to 'SEC filings didn't respond' and 'Gemini search didn't respond'. A green tick for a failure? And the green dot says 'Checked 10 of 10 sources' when three didn't respond. My demo notes on Primary were unchanged afterwards, but I never got to test my *own* note, because I can't write one."
9. **Run status.** "I only found the run history because the tour told me about a 'pill'. On my laptop it's just a dot. The history is detailed, which I respect. But it reads like a server log ('portfolio-diff portfolio fetch 403'), and every run says 'Finished', even one with 101 errors."

### Verdict

- **Would I use this twice a week instead of my spreadsheet?** *Not yet.* I'd still need the spreadsheet for notes and contact history, and I'd have to re-sort the quiet/maybe lists myself.
- **Would I trust it enough to send an email?** *For Primary, yes, after fixing "co-led".* For most of the Maybe list, no. The reasons are real events, but many aren't relevant to me, and two links don't show the claim.

### My complete complaint list

1. "Parked" is not "quiet". Most parked VCs had fresh activity, and nobody is actually flagged as quiet.
2. "12 went quiet" with no list, and it disappeared after a refresh.
3. Off-topic reasons in my Maybe list (open-weight AI models, a sales-data startup).
4. Logistics-specialist funds are parked (Prologis Ventures, Supply Change Capital, Ironspring, Schematic), and Prologis has a logistics quote from 5 Oct.
5. I can't add a note, log a contact or mark someone as emailed.
6. I can't import my list or add a VC.
7. "Co-led" vs "led": the AI changed a fact.
8. Evidence links that go to a homepage, but still say "link checked".
9. "No one scored 60 or more" while Primary shows 61.
10. I can't see when the data was last updated on my laptop.
11. Run results show green ticks for sources that failed, and "10 of 10 sources" when 3 failed.
12. Scores hidden in the main list, and the explanation doesn't add up.
13. The same deal counted twice in the score.
14. Too much scrolling in the detail panel before the evidence and my notes.
15. The squares at the top waste half my screen on every tab, even the Table.
16. Which person is "mine"? The header says Zach Fredericks; the drafts go to Cassie Young.
17. Team titles out of date (Brian Schechter shown as Partner; the app's own signal says he was promoted to GP on 18 Sept).
18. Email drafts read like a robot: "Given your focus on Enterprise AI at Primary Venture Partners, a B2B logistics SaaS raising seed fits your investment focus."
19. The age in the list ("14d") doesn't match "Last signal 10 Oct" in the Table.
20. Clicking a row in the Table throws me back to Focus.
21. On my phone the Table hides the score and action off to the right.
22. The tour pointed at things that weren't on screen and got stuck waiting for me to click.
23. "Run now" freezes the app for 3 minutes with no timer.
24. Anyone with the link can see my pipeline and notes. There's no login.
25. Ugly black 404 page with no way back.

### What I expected and didn't find

- A **"Contact these 3 today"** shortlist.
- A **"Quiet, skip"** list.
- A **"Last updated"** time at the top.
- **Import CSV**.
- An **editable notes field**.
- A **"Mark as sent"** button.
- **Score badges** in the list.
- **Filter by lane** in the Table.

### What I liked

- Every reason has a date and a link, and "Confirmed by 2 sources" when there are two.
- The fit chips (Seed / B2B / Logistics / Software) answer "is this even my kind of investor?" instantly.
- Ready-to-edit email, follow-up and LinkedIn drafts addressed to the right *partner*, with "Nothing is sent from this page."
- The lock icon and "Yours" label on my notes.
- The Discover tab is genuinely useful. Emerge Capital and Plus Partners are exactly the kind of new names I want. It even warns "We couldn't verify the firm's website."
- Run now asks before it runs, and the other tab shows "A run is in progress".

### Questions I'd ask the engineer

1. What exactly decides "Parked"? Why is Prologis Ventures parked with a 5 Oct logistics quote?
2. Where do I add notes and contact history, and is that the same table the job writes to?
3. Which columns does the run write, exactly? Show me the update query.
4. What does "Date and link checked" check? How did a homepage link pass?
5. Who is "Zach Fredericks" on the Primary card: my contact, or the system's pick?
6. Why does the score count the same Zero deal twice?
7. What happens on Thursday if Gemini times out for every investor? Do I get yesterday's data, or an empty Monday?
8. Who else can open this URL?
9. Is the AI step using Gemini Flash? The run log only says "gemini-grounding".

---

## 3. Task walkthroughs

Notes on these tables:
- "Clicks" counts clicks, key presses and scrolls.
- "Screens" counts distinct views, including external tabs.
- 🟠 marks a moment I hesitated, got confused or backtracked, recorded as it happened.

### Task 1: First open (who to contact this week, without clicking)

| | |
|---|---|
| **Steps** | Load `/`. Read the hero, then the queue on the left. |
| **Clicks / screens** | 0 clicks, 1 screen. The answer ("0 today, 1 follow-up, 7 maybe") is above the fold at 1084 px. |
| **Friction** | 🟠 "No one scored 60 or more with a confirmed fit" vs Primary at 61 with 4/4 fit (61 is only visible in the Table and score panel).<br>🟠 The 50-square grid has no labels until you hover.<br>🟠 Freshness is shown only as a green dot on desktop.<br>The *reason* for each VC is visible as a one-line summary, but scores are not. |
| **Ideal** | 0 clicks. The top of the page reads "Updated Mon 08:24 · next Thu 08:00 · 3 sources failed". Below it, a ranked "Contact this week" list with score, signal type, date and source domain on each row. The grid is removed. |

### Task 2: Onboarding (get ~50 VCs in)

| | |
|---|---|
| **Steps** | Looked for Import / Add / Settings in the nav, search, Discover and the tour. Tried `/import` and `/settings`: both return the default Next.js 404. |
| **Clicks / screens** | Dead end. No path exists. |
| **Friction** | 🟠 Discover says "adding one happens outside this page" without saying where. |
| **Ideal** | About 5 steps: "Import CSV" (drag file) → map columns (firm, partner, notes, last contact) → preview 50 rows with duplicate warnings → Import → "First scan running, about 4 min". Plus "Add investor" (firm + website + partner, 1 form). |

### Task 3: Monday routine (pick 3 VCs and what to say, under 5 minutes)

| | |
|---|---|
| **Steps** | For each candidate: click the row → scroll the detail panel about 3 times past fit chips and the activity chart to Evidence → open the source in a new tab and read it → return → scroll to "What to say" → expand drafts → copy. |
| **Clicks / screens** | About 7 interactions and 2 screens per VC, so about 21 and 6 for three VCs. Realistic time: 12–15 minutes with verification. |
| **Friction** | 🟠 Only 1 strong candidate.<br>🟠 The 2nd and 3rd picks from Maybe (Elevation, Fuel) are off-topic, so I backtracked and inspected 5 Maybe VCs to find 2 usable ones (Dynamo, Blume).<br>🟠 The detail panel is a nested scroller inside a fixed page, so the mouse wheel scrolls the panel while the 45%-tall hero stays put.<br>There is no "mark as sent", so nothing records the decision. |
| **Ideal** | About 6 clicks and 1 screen. Three cards pre-ranked. Each shows the signal, date, source chip with hover preview, and nudge line. "Copy email" and "Mark sent" are on the card. |

### Task 4: Verify recommendations (8 checked, every source link opened)

| VC | App claim | Date in app | What I found at the source | Verdict |
|---|---|---|---|---|
| Primary Venture Partners | "Co-led" Lantern $7.0M seed | 5 Oct | trysignalbase.com (aggregator): "October 5, 2026… led by Primary Venture Partners". The word "co-led" does not appear. | **Real and dated, but the role is misstated.** Secondary source. |
| 8VC | Joined Gallatin AI $50M Series A | 8 Oct | PR Newswire, Oct 08 2026: "backed by… 8VC, Silent Ventures". Military logistics. | **Real, correct.** Series A, not seed. The app shows Seed "does not match", which is right. |
| Blume Ventures | Essay on Procol (procurement, delivery tracking) | 7 Oct | blume.vc, published 7 Oct 2026, written by Blume's marketing/community team, not a partner. | **Real.** Only moderately relevant (procurement, not logistics). |
| Dynamo Ventures | "Essay: Dynamo analyzed Amazon contracting… Kuehne+Nagel" | 28 Sept | "Dynamo Dispatch (2026/09/28)", a weekly news roundup newsletter. | **Real and relevant.** "Essay/analyzed" overstates a curated news item. |
| TMV | Article: shipping is the OS of global commerce | 28 Sept | The link goes to **tmv.vc homepage**. The article is listed there dated **Sep 29, 2026**. | **Real, but the link is not to the article and the date is off by one.** |
| Elevation Capital | "Interview: partners examined open-weight models…" | 11 Oct | A 1:01 YouTube short, "Open AI Models Just Caught Up Again". | **Real, but irrelevant to logistics** and mislabeled as an interview. It should not be in Maybe. |
| Fuel Ventures | Led Doris Labs £450k pre-seed | 8 Oct | soapbox.vc, 8 Oct 2026: Doris Labs unifies *sales* data for GTM teams. | **Real, irrelevant** (sales tooling, pre-seed, UK). |
| Better Capital | Essay citing freight-forwarder tooling | 30 Sept | The link goes to **bettercapital.vc homepage**. The quoted text and date are not on that page. | **Unverifiable from the cited link.** |
| *(bonus)* Prologis Ventures | "William O'Donnell discusses how AI commerce will push logistics operators…", **Parked** | 5 Oct | Not opened. The quoted evidence text reads "Prologis is looking beyond the 'four walls'…" | **[Can't verify] possible attribution to the wrong entity** (Prologis the company vs Prologis Ventures / the named partner). Either way it is a logistics signal that was parked. |

- **Clicks / screens:** about 4 per VC (select, scroll, click source, return), with 1 external tab each.
- 🟠 Friction: the first "Open the full page" click appeared to do nothing for a moment. The URL had changed but the old view was still painted, with no loading indicator.
- **Ideal:** 1 hover or click per VC. An inline source preview shows the quote highlighted, the canonical article URL and the publish date pulled from the page. The badge reads "Quote found on page ✓" or "⚠ Quote not found".

### Task 5: Understand the score

| | |
|---|---|
| **Steps** | Table tab (score column) → click row → scroll the panel to the bottom → expand "How the score works". |
| **Clicks / screens** | About 4 clicks, 2 views. |
| **Friction** | 🟠 The arithmetic: "top three signals (34.6 + 3.3 + 3.3), plus 10 because two sources agree, times the firm fit (1.26)" gives 64.5 if the 10 is added before multiplying, and 61.9 if after. The text implies the first; the score is 61.<br>🟠 Two of the "top three" are the same Zero deal from two outlets.<br>🟠 The rule "60 or more = message today" sits right next to a 61 that isn't "message today".<br>🟠 Discover uses a different "rubric score" where Emerge Capital scores 102. |
| **Ideal** | 0 clicks. Each list row shows a score badge such as "61 / 100 · Follow-up". Hovering shows the three contributing signals (deduplicated), the fit multiplier and the lane threshold. |

### Task 6: Find the quiet ones

| | |
|---|---|
| **Steps** | Click the "Parked" chip (filters the queue) or open Board → Parked column. |
| **Clicks / screens** | 1 click, 1 view. |
| **Friction** | 🟠 The header says "No strong signal this month", but the rows say "Last signal 9 Oct", "8 Oct"… Only BEENEXT and Tech Square Ventures show "None found".<br>🟠 "12 went quiet" in the morning summary is plain text, not a list. After my manual run the summary read "Since Monday: 112 new signals. Susa Ventures moved up 15 points." The quiet count was gone.<br>When filtered to Parked, the detail panel still showed Primary (not parked). |
| **Ideal** | 0 clicks. A separate "Quiet, don't chase (n)" section listing VCs with no signal in 30 days, each showing the date of its last signal, and a "Low fit this week" group listed separately from it. |

### Task 7: Manage my own data (add note, update history, mark contacted)

- **Steps:** I looked in the detail panel, the full page, the Table "Your status" column and the right-click menu. Notes are read-only text with "Yours. This page never edits it."
- **Result:** dead end. There is no edit, no status change and no "mark contacted". All notes are labeled [DEMO].
- **Ideal:** 3 clicks. "Add note" opens an inline textarea and autosaves with a "Saved · only you edit this" toast. "Log contact" picks a date and channel. "Mark sent" sets status to "Waiting" with today's date.

### Task 8: Refresh and note-preservation test

| | |
|---|---|
| **Steps** | No test record exists and notes can't be edited, so I could not write "AUDIT NOTE 123". I recorded Primary's demo notes, then pressed Run now → confirmed ("Checks all 50 investors… about 4 minutes") → waited → Close → re-read Primary. |
| **Clicks / screens** | 3 clicks, 179 s of blocked UI. |
| **Result** | Primary's notes were unchanged: "[DEMO] Leads seed rounds. Want them as lead, not follow-on / History: [DEMO] 2026-09-06: intro via an angel… / Last contact: 6 Sept". The signal side updated: the Maybe count went from 7 to 8 with Susa Ventures added, Parked went from 42 to 41, and 8VC's "$50M" became "$50 million". **This does not prove note preservation.** The notes are demo data that may live in a column or table the job never touches. **[Can't verify]** |
| **Friction** | 🟠 The modal showed ✓ next to "SEC filings didn't respond", "Portfolio pages didn't respond" and "Gemini search didn't respond".<br>🟠 The pill on mobile then said "Checked 10 of 10 sources".<br>The run log shows 37 errors. |
| **Ideal** | A non-blocking toast: "Refreshing 50 investors… 1:12 / ~3:00", with a per-source progress bar. When done: "Updated 17:09 · 112 new signals · 3 sources failed (details) · your notes untouched". |

### Task 9: Run status

| | |
|---|---|
| **Steps** | 🟠 I hovered the green dot (no tooltip). I found it only via tour step 17 and the accessible name "Open run history". Click → `/runs`. |
| **Clicks / screens** | 1 click if you already know; in practice about 3 minutes of discovery. |
| **What I learned** | The schedule is stated as Monday and Thursday at 08:00 IST. The only scheduled run in history is **Mon 8:24 IST** (24 minutes late), and every other run is "Script" (developer runs on Sunday). Every run's Result reads "Finished", including runs with 101 and 62 errors. `portfolio-diff` returns 0 in every run, with "portfolio fetch 403" errors. YouTube hit 429 rate limits. Gemini timed out repeatedly ("grounded call timed out; classified collected items only"). |
| **Ideal** | A labeled header pill, "Updated Mon 08:24 · Next Thu 08:00". Run history shows Success / Partial / Failed badges, plain-English errors ("Couldn't read 3 firm portfolio pages: blocked by the site"), and dev runs hidden by default. |

---

## 4. The ideal product and the gap

**Job to be done:** "Twice a week, in five minutes, tell me the three VCs worth emailing today, with a verifiable reason, and who to ignore, without touching my notes."

**Primary moment:** Monday or Thursday, about 08:30. Coffee, laptop, 5 minutes, decide on 3 emails.

### Ideal main screen, top to bottom

1. **Status strip, one line.** "Updated Mon 08:24 IST · next run Thu 08:00 · 10/10 sources OK" (or "⚠ 3 sources failed"). The amber state means "data is older than 4 days".
2. **"Contact this week (3)"**, ranked cards. Each card shows:
   - Firm and partner
   - Score badge "61"
   - Lane tag ("Follow-up" or "First message")
   - Signal-type icon and label (Deal / Essay / Talk / Interview)
   - The one-line signal in plain fact form
   - Date as "5 Oct (7 days ago)"
   - Source domain chip
   - The nudge line
   - Buttons: **Copy email** and **Mark sent**
3. **"Maybe, if you have time"**, collapsed to 5, relevance-gated (logistics, supply chain or B2B infra only).
4. **"Quiet, don't chase (n)"**. VCs with no qualifying signal in 30 days, shown as one compact list with "last heard: 2 Aug".
5. **"Low fit this week" and "All investors"** behind tabs.
6. **System and user data visibly separated** in every row: system-written fields in a tinted "Auto · updated Mon 08:24" zone, and "Your notes" in a white "Yours" zone with an edit pencil.

### Ideal secondary screens

- **VC detail** in this order: Why now (fact, date, source with quote preview) → What to say (nudge + drafts) → Your notes & contact log (editable) → Fit → Other signals (deduplicated) → Team → Score breakdown.
- **Import:** CSV with column mapping and dedupe preview; manual add form.
- **Run history:** status badges, plain-language errors, failed-source impact ("12 investors may be missing YouTube signals"), dev runs hidden.

### Deliberately leave out

- The 50-tile grid.
- A Board view that duplicates Focus.
- Raw source and log jargon.
- Any automatic sending.
- Editing of system columns by the user, and editing of user columns by the system.

### The gap

- **The detail panel is already close to ideal**, and so are the drafts and the evidence-with-date pattern. The gap is in triage:
  - Lanes mix "quiet" with "low fit".
  - The relevance gate lets non-logistics signals through and parks logistics ones.
  - Scores and freshness are hidden.
- **Data ownership is half-built.** It is displayed as "Yours", but nothing is editable.
- **There is no onboarding path at all.**

---

## 5. Brief compliance checklist

| Requirement | Status | Evidence |
|---|---|---|
| Identifies who to contact this week, with reasons | **Partially met** | 1 Follow-up and 8 Maybe, each with a one-line reason and a source. "Message today" is empty even though Primary scores 61 with 4/4 fit, and 2 of the 8 Maybe reasons are off-topic (Elevation, Fuel). |
| Reasons are observable signals from the past 30 days | **Partially met** | All 8 checked are within 30 days and 6 matched their source. Problems: Better Capital can't be verified from its link; TMV links to a homepage and is 1 day off; Primary's role is changed from "led" to "co-led". |
| Signal types: writing, interviews/talks, investments, events | **Partially met** | Seen: Deal, Essay, Interview, Talk, News, Team change. Mislabeled: a YouTube short as "Interview", a news digest as "Essay". The `portfolio-diff` source (portfolio pages) returned 0 with 403 errors in every logged run, so new investments rely on news and search only. |
| Explicitly flags quiet VCs | **Not met** | "Parked" says "No strong signal this month", but 39 of 41 parked VCs have a signal dated 15 Sept–11 Oct. "12 went quiet" is not listed anywhere and disappeared after a manual run. |
| Twice-weekly run (scheduled and/or manual) | **Partially met** | Mon/Thu 08:00 IST stated. One scheduled run seen (Mon 08:24). Run now works (179 s). A Thursday run can't be verified yet. |
| Supabase reflects current state after each run | **Can't verify from browser** | The UI changed after the run (lane counts, new Maybe entry), which is consistent with the table being updated. |
| Updates only the four signal-derived columns | **Can't verify from browser** | The UI shows many more system fields (fit chips, team, drafts, firm profile, lane), so the system writes more than four fields somewhere. Whether they share a table with user columns is unknown. |
| Never overwrites notes or contact history | **Can't verify (weak positive)** | Primary's [DEMO] notes and "Last contact 6 Sept" were identical before and after my run. A true test was impossible because notes can't be written in the UI. |
| Live external data, works with real data now | **Met** | All sources resolved to live 2026 pages. Investor names and team pages are real. User data is explicitly [DEMO]. |
| AI tasks use Gemini Flash | **Can't verify from browser** | The run log names "gemini-grounding" but never the model. |
| Deployed and publicly accessible | **Met (with risk)** | Live on Vercel with no login, so anyone with the URL sees the pipeline and notes. |

---

## 6. Findings (deduplicated)

Severity levels:
- **Critical:** breaks the core promise, blocks a task, risks data loss, or shows fake or stale signals.
- **High:** significant friction in the five-minute routine.
- **Medium:** noticeable annoyance.
- **Low:** polish.

### F1. "Parked" is not "quiet". Quiet VCs are never flagged.

- **Where:** Focus → Parked section and chip; Board → Parked column; hero line "12 went quiet".
- **Problem:** The Parked copy says "No strong signal this month, so no need to spend time here." But 39 of 41 parked VCs show a "Last signal" within 30 days (e.g. Inflection Point 9 Oct, Lightspeed India 8 Oct). Only BEENEXT and Tech Square show "None found". "12 went quiet" is unlinked text and vanished after a manual run.
- **Why it matters to Vikram:** The brief's second promise is unmet. He can't tell "silent" from "active but off-topic", so he either wastes time or skips live leads.
- **Raised by:** Both. **Dimension:** Data presentation; Copy; IA. **Severity:** Critical. **Effort:** Medium.
- **Recommendation:** Split Parked into two groups.
  - **"Quiet: no signal in 30 days"**: `last_signal_date` is null or older than 30 days. Each row shows "Last heard: {date}" or "Nothing found".
  - **"Active, low fit this week"**: has signals but score is under the Maybe threshold. Each row shows the top signal and its score.

  Make "{n} went quiet" in the hero a link that filters to the quiet group. Store the quiet-since date per VC so the count survives manual runs.

### F2. The relevance gate is wrong in both directions

- **Where:** Lane assignment and scoring; Focus → "Maybe"; Prologis Ventures detail.
- **Problem:**
  - In Maybe with off-topic signals: Elevation Capital (1-minute YouTube short on open-weight AI models, score 37) and Fuel Ventures (sales-data startup, pre-seed, UK, score 34).
  - Parked with a logistics signal: Prologis Ventures, with "AI commerce will push logistics operators to look beyond warehouse walls…" on 5 Oct, and the copy "No B2B logistics signal strong enough in the last 30 days."
  - Other logistics specialists parked with low scores: Supply Change Capital 5, Ironspring 5, Schematic 11, Prologis 11.
- **Why it matters:** The core output ("who is worth contacting") can't be trusted, and an off-topic email makes Vikram look like he didn't do his homework.
- **Raised by:** Both. **Dimension:** Data presentation; Trust. **Severity:** Critical. **Effort:** Medium.
- **Recommendation:**
  - Require a `logistics_relevance` classification (Gemini, with the quote as input) of at least "related" before a signal can contribute more than 5 points or place a VC in Maybe or above.
  - Store and show the relevance label on each signal: "Logistics ✓", "Adjacent", "Off-topic".
  - Add a per-firm "thesis prior" boost for funds whose stated thesis is logistics or supply chain.
  - Re-run on the Prologis, Supply Change, Ironspring and Schematic cases as regression tests.

### F3. There is no way to edit notes or contact history, or to mark someone contacted

- **Where:** Detail panel → "Your notes"; full VC page; Table → "Your status".
- **Problem:** Notes are read-only, and there is no "mark contacted" or status change anywhere. The note-preservation test (brief item 4) can't be performed by the user.
- **Why it matters:** Vikram must keep his spreadsheet, so the tool adds work instead of replacing it. He also can't confirm the dealbreaker promise himself.
- **Raised by:** Both. **Dimension:** Workflow; Data ownership. **Severity:** Critical. **Effort:** Medium.
- **Recommendation:** In "Your notes" add:
  - An inline-editable **Notes** textarea with autosave and a "Saved" indicator.
  - A **Contact log**: list plus "Log contact" (date, channel, one line).
  - A **Status** dropdown: Yet to reach out / Waiting / In conversation / Passed.
  - A **"Mark sent"** button on each draft, which sets Status to Waiting and `last_contact` to today.

  Write these through a separate API route that can only update the user columns. Show "Only you edit this. Scans never touch it." under the field.

### F4. There is no onboarding: no import and no add-investor

- **Where:** Global nav (missing); Discover → "adding one happens outside this page"; `/import`, `/settings` (404).
- **Problem:** A first-time user has no path to load their ~50 VCs.
- **Why it matters:** Task 2 is blocked, and the product can't be used without engineer help.
- **Raised by:** Both. **Dimension:** Workflow; IA. **Severity:** Critical. **Effort:** High.
- **Recommendation:**
  - Add an **"Investors" menu** with **Import CSV** (upload → column mapping for firm, website, partner, notes, last contact → dedupe preview → import → automatic first scan) and **Add investor** (firm, website, partner).
  - Add **"Add to my list"** on each Discover card.
  - Show an empty state on Focus when there are 0 investors: "Import your investor list to get your first Monday shortlist."

### F5. AI summaries change facts and mislabel signal types

- **Where:** Primary card ("co-led", "Their role: Co-led"), its email drafts and nudge line; Elevation ("Interview"); Dynamo ("Essay… analyzed").
- **Problem:**
  - The source says "led by Primary Venture Partners". The app says "co-led" in the headline, the role field, the email and the LinkedIn note, while its own nudge line says "Primary led".
  - A 1-minute YouTube short is labeled "Interview".
  - A weekly news-roundup item is labeled "Essay: Dynamo Ventures analyzed".
- **Why it matters:** One wrong fact in a cold email kills credibility, and Vikram will stop trusting all summaries.
- **Raised by:** Both. **Dimension:** Trust; Copy. **Severity:** Critical. **Effort:** Medium.
- **Recommendation:**
  - Extract `role` (led / co-led / participated) only by string-matching the evidence quote. If no explicit term is present, show "Role: not stated" and do not use a role verb in drafts.
  - Derive signal type from source metadata (YouTube short → "Video", newsletter → "Newsletter mention") rather than from the LLM.
  - Generate drafts and nudge lines from the same normalized fields so they can't disagree.

### F6. "Date and link checked" passes on links that don't show the claim

- **Where:** Evidence block → badge. TMV (link to tmv.vc homepage); Better Capital (link to bettercapital.vc homepage, quote not present).
- **Problem:** The badge implies verification, but the link goes to a homepage. TMV's date is off by one (app 28 Sept, site Sep 29). Primary's link is a third-party aggregator rather than the original announcement.
- **Why it matters:** This is the exact trust signal Vikram relies on, and it is false in 2 of 8 checks.
- **Raised by:** Both. **Dimension:** Trust. **Severity:** Critical. **Effort:** Medium.
- **Recommendation:**
  - Before marking "checked", fetch the URL and confirm two things: the evidence quote appears on the page, and the URL path is not `/`.
  - If either fails, show an amber "⚠ Quote not found at link" and exclude the signal from scoring.
  - Prefer the canonical article URL: follow "View source" on aggregators.
  - Rename the badge to "Quote found on page · 5 Oct".

### F7. There is no authentication, so the pipeline and personal notes are public

- **Where:** The whole app.
- **Problem:** The app loads with no sign-in. Once notes are real, anyone with the URL sees Vikram's fundraising pipeline and private notes. **[Assumption]** If the Supabase anon key permits writes, they could also edit or wipe data.
- **Why it matters:** This is a confidentiality and data-loss risk, and it's what lets a stranger overwrite his notes.
- **Raised by:** Designer. **Dimension:** Trust; Data ownership. **Severity:** Critical. **Effort:** Medium.
- **Recommendation:** Add Supabase Auth (magic link) and gate all routes. Enable RLS so that `user_notes` and `contact_log` are readable and writable only by the owner, and the scan's service role can update signal columns only.

### F8. The "no one scored 60" headline contradicts the visible 61

- **Where:** Focus → "Message today" empty state; Table → Primary score 61; "How the score works".
- **Problem:** The empty state says "No one scored 60 or more with a confirmed fit this week." Primary scores 61 with 4/4 fit chips. It sits in Follow-up because Vikram is waiting on a reply, but the copy doesn't say so.
- **Why it matters:** It undermines the headline answer on first open.
- **Raised by:** Both. **Dimension:** Copy. **Severity:** High. **Effort:** Low.
- **Recommendation:** Change the empty-state copy to "No *new* investors scored 60+ this week. Primary (61) is in Follow-up because you're already waiting on them."

### F9. Freshness is invisible on desktop and misreported after failures

- **Where:** Header green dot (desktop); "Checked 10 of 10 sources. Updated Mon 17:09 IST" (shown only at phone width); "Next update Thu 8:00 IST" at the bottom of the queue.
- **Problem:** On desktop the status pill is a bare dot with no tooltip. After a run where 3 sources "didn't respond", the pill still says "10 of 10 sources".
- **Why it matters:** Vikram can't tell whether he's acting on today's or last week's data.
- **Raised by:** Both. **Dimension:** Trust; Feedback. **Severity:** High. **Effort:** Low.
- **Recommendation:**
  - Always render the pill text at widths of 768 px and above: "Updated Mon 08:24 IST · Next Thu 08:00".
  - Count a source as answered only if it returned without error. Show "7 of 10 sources" in amber when any failed.
  - Turn the pill red when the last successful scheduled run is older than 4 days.

### F10. Run results hide failures (green ticks, always "Finished", raw errors)

- **Where:** Run now modal; `/runs` table.
- **Problem:**
  - The modal shows ✓ beside "SEC filings didn't respond".
  - Every run's Result is "Finished", even with 101 errors.
  - Errors are raw strings ("portfolio-diff portfolio fetch 403", "youtube search 429").
  - `portfolio-diff` has returned 0 in every run, a silent outage of the portfolio-page investment source.
- **Why it matters:** Vikram can't tell when a run has failed. Missing data looks like a "quiet" VC, which feeds F1.
- **Raised by:** Both. **Dimension:** Feedback; Copy. **Severity:** High. **Effort:** Low–Medium.
- **Recommendation:**
  - In the modal, use ⚠ (amber) for sources that failed.
  - Add a Result status column on `/runs`: "Complete" / "Partial (3 sources failed)" / "Failed".
  - Map errors to plain language: "Couldn't read 3 firm portfolio pages (site blocked us)", "YouTube rate-limited; 23 investors not checked on YouTube".
  - Alert, via banner or email, when a source returns 0 for 2 runs in a row.
  - Mark VCs affected by failed sources: "Not fully checked this run".

### F11. The score is hidden and doesn't reconcile; duplicates inflate it

- **Where:** Focus and Board rows (no score); detail → "How the score works" (collapsed, at the very bottom); Discover "rubric score 102".
- **Problem:**
  - The score only appears in the Table and the collapsed panel.
  - Primary's breakdown lists the same Zero deal twice (3.3 + 3.3), plus 10 "because two sources agree".
  - The stated formula gives 64.5, not 61.
  - Discover uses a different scale (102).
- **Why it matters:** Vikram can't compare VCs at a glance or trust the ranking.
- **Raised by:** Both. **Dimension:** Data presentation. **Severity:** High. **Effort:** Low–Medium.
- **Recommendation:**
  - Show a score badge ("61") on every Focus and Board row.
  - Deduplicate signals by (company, round), or by URL cluster for non-deal signals, before scoring.
  - Rewrite the explanation as a literal equation with the real numbers: "(34.6 + 3.3 + 3.3) × 1.26 + 10 = 61.9 → 61".
  - Normalize the Discover score to 0–100 or rename it "Logistics deal points".
  - Move "How the score works" up, directly under the "why now" card, collapsed to one line.

### F12. Duplicate signals in lists

- **Where:** Full VC page → "Every signal on record" (Primary: WSJ 21 Sept ×2, Zero 15 Sept ×2); the activity strip.
- **Problem:** The same event appears as separate signals.
- **Why it matters:** Noise, inflated "Other activity this month (6)" counts, and inflated scores.
- **Raised by:** Designer. **Dimension:** Data presentation. **Severity:** Medium. **Effort:** Low.
- **Recommendation:** Cluster signals with the same event and date into one item, shown as "Confirmed by 2 sources: wsj.com · pulse2.com", the pattern already used for 8VC.

### F13. The hero and the 50-tile grid take about half the screen on every tab

- **Where:** Focus, Board and Table: the headline, 5×10 grid and lane chips.
- **Problem:** About 45% of the viewport at 1084 × 771 is a headline and an unlabeled grid, of which 41 tiles look identical. It is repeated on Board and Table, pushing the table below the fold. On phone, the whole first screen is the hero.
- **Why it matters:** It delays the actual list. It is decorative rather than decision-useful.
- **Raised by:** Both. **Dimension:** Cognitive load; Visual hierarchy. **Severity:** High. **Effort:** Low.
- **Recommendation:**
  - Remove the grid.
  - Collapse the hero to one 48 px line: "1 follow-up · 8 maybe · 41 quiet/low-fit — Updated Mon 08:24".
  - Keep the lane chips as filters.
  - Show the hero only on Focus; on Board and Table start with the content.

### F14. The "since last run" summary is fragile and highlights the wrong things

- **Where:** Hero line "Since Sunday: 86 new signals. LDV Capital moved up 14 points. 12 went quiet."
- **Problem:**
  - It spotlights LDV Capital (now 15, Parked).
  - "12 went quiet" isn't actionable.
  - After a manual run the baseline reset to "Since Monday" and the quiet count disappeared.
- **Why it matters:** The one "what changed" line points at irrelevant movement and loses information.
- **Raised by:** Both. **Dimension:** Data presentation; Copy. **Severity:** Medium. **Effort:** Low.
- **Recommendation:**
  - Compute the diff against the previous *scheduled* run, not the last run of any kind.
  - Only spotlight movers that crossed a lane boundary ("Susa Ventures moved into Maybe").
  - Make every count a link that filters the list.

### F15. The Monday routine doesn't fit in 5 minutes

- **Where:** Focus queue → detail panel order.
- **Problem:** The order is Why now → Fit → Activity chart → Evidence → Other activity → What to say → 5 team members with expanded drafts → Firm → Score → Your notes. Notes come last, after about 4 scrolls in a nested scroll container. There is no "today's 3" shortlist and no way to record the decision.
- **Why it matters:** It took about 12–15 minutes to pick 3 VCs, and nothing was saved.
- **Raised by:** Both. **Dimension:** Workflow; Cognitive load. **Severity:** High. **Effort:** Medium.
- **Recommendation:**
  - Reorder the panel: Why now (with inline source preview) → What to say + Copy email + Mark sent → Your notes & last contact → Fit → Other activity → People → Firm → Score.
  - Collapse "People" to the top 2, with "Show 3 more".
  - Add a "Today's picks" tray. Pressing `p` on a row pins it; the tray shows the 3 pinned VCs with copy buttons.

### F16. Contact identity is unclear and team data is stale

- **Where:** Detail header "Zach Fredericks · Global (US-based)"; "Who to contact" list; Brian Schechter's title.
- **Problem:**
  - The header names one person while the drafts are addressed to Cassie Young. Nothing says whether Zach is Vikram's existing contact.
  - Brian Schechter is listed as "Partner, Infrastructure" although the app's own signal (18 Sept) says he was promoted to General Partner.
- **Why it matters:** Vikram may email the wrong person, or bypass his warm contact.
- **Raised by:** Both. **Dimension:** Copy; Data ownership. **Severity:** High. **Effort:** Low.
- **Recommendation:**
  - Label the header field "Your contact: Zach Fredericks" with the "Yours" lock styling.
  - In "Who to contact", pin Vikram's contact first, tagged "Your contact".
  - Apply team-change signals to titles, or show "⚠ Title may be outdated (promoted 18 Sept)".

### F17. Drafts are clunky and not clearly marked as AI-written

- **Where:** "Who to contact" → Email, Follow-up and LinkedIn drafts.
- **Problem:**
  - The grammar is broken: "Given your focus on Enterprise AI at Primary Venture Partners, a B2B logistics SaaS raising seed fits your investment focus."
  - The draft opens by repeating the deal headline verbatim.
  - The AI caveat ("Check it before you send") appears only under the nudge line, not under the drafts.
- **Why it matters:** The drafts need heavy editing, which cuts into the time saved.
- **Raised by:** Both. **Dimension:** Copy; Trust. **Severity:** Medium. **Effort:** Low.
- **Recommendation:**
  - Use this template: "Hi {first}, saw Primary led Lantern's $7M seed on 5 Oct, distributor demand forecasting, which is close to what we're building for Indian shippers and 3PLs…"
  - Lint the output for repeated firm names and dangling clauses.
  - Add a "✦ AI draft · check facts" label on every draft card.

### F18. The same row shows different dates in different views

- **Where:** Focus row "Dynamo Ventures · 14d" vs Table "Last signal 10 Oct"; also TMV, Blume.
- **Problem:** Focus shows the age of the *headline* signal, while the Table shows the *newest* signal. Neither is labeled.
- **Why it matters:** It looks like a data bug and erodes trust.
- **Raised by:** Designer. **Dimension:** Consistency. **Severity:** Medium. **Effort:** Low.
- **Recommendation:** In Focus, render the age as "Signal: 28 Sept (14d)". In the Table, rename the column "Newest activity" and add a "Reason signal" column with the date.

### F19. Table interactions are limited

- **Where:** Table view.
- **Problem:**
  - Rows are `<button>`s, not links, so there is no open-in-new-tab.
  - Clicking a row navigates to Focus, so you lose your place in the Table.
  - There is no lane or status filter, only name search.
  - There is no signal-summary column.
- **Why it matters:** Bulk review of all 50 is slow.
- **Raised by:** Designer. **Dimension:** Interaction. **Severity:** Medium. **Effort:** Low.
- **Recommendation:**
  - Make the firm cell an `<a href="/vc/{id}">`.
  - Open the detail in a right-side drawer over the Table instead of switching views.
  - Add lane and status multi-select filters next to the search.
  - Add a truncated "Reason" column with a tooltip.

### F20. Search is name-only

- **Where:** Search (`/`).
- **Problem:** "logistics" returns "No investor matches that." There is no search across signal text or notes.
- **Why it matters:** Vikram can't find "who talked about cold chain".
- **Raised by:** Designer. **Dimension:** Interaction. **Severity:** Low. **Effort:** Medium.
- **Recommendation:** Index signal summaries and notes. Group results as "Investors" and "Signals mentioning 'logistics'".

### F21. The demo tour is page-blind and gets stuck

- **Where:** Demo (19 steps).
- **Problem:**
  - Started from Discover, steps 1–4 described elements that weren't on screen (the grid and queue).
  - Step 4 requires "Click it" and stalls.
  - The Board step's spotlight frame was misaligned.
  - Step 1 refers to "the pill", which on desktop is an unlabeled dot.
  - Step 12 promises "Your notes stay yours" while offering no way to write them.
- **Raised by:** Designer. **Dimension:** Consistency; Feedback. **Severity:** Low. **Effort:** Low.
- **Recommendation:** On Demo start, navigate to `/` first. Make each step navigate to its own view. Recompute the spotlight rect after navigation and scroll. Fix the pill copy once F9 ships.

### F22. Run now blocks the whole app for about 3 minutes

- **Where:** Run now → progress modal.
- **Problem:** A modal with spinners and no elapsed time, no ETA and no cancel. The app is unusable until it's done. (A second tab did correctly show "A run is in progress".)
- **Raised by:** Both. **Dimension:** Perceived performance. **Severity:** Medium. **Effort:** Low.
- **Recommendation:** Replace the modal with a dismissible bottom-right progress toast ("Checking 50 investors · 1:12 / ~3:00 · 6 of 8 sources done"), and keep the app usable. On completion show "Updated · 112 new signals · View changes".

### F23. The run-history entry point is undiscoverable and the page is noisy

- **Where:** Header green dot → `/runs`.
- **Problem:**
  - There is no label or tooltip.
  - The history is dominated by "Script" developer runs.
  - Source names are internal jargon: inc42, firm-rss, linkedin-index, gemini-grounding, portfolio-diff.
- **Raised by:** Both. **Dimension:** IA; Copy. **Severity:** Medium. **Effort:** Low.
- **Recommendation:**
  - Merge the dot into the labeled freshness pill from F9 and link it to `/runs`.
  - Hide "Script" runs behind a "Show developer runs" toggle.
  - Rename the sources: "News", "Firm blogs", "LinkedIn", "AI web check", "Portfolio pages".

### F24. Mobile issues

- **Where:** 390 px width.
- **Problem:**
  - The first screen is entirely hero and grid; the queue starts on the second screen.
  - The Table scrolls horizontally inside a wrapper with no sticky first column, so Score, Status, Last signal and Action are off-screen.
  - The detail view hides the tab nav (only "Back to list").
  - Positive: there is no page-level horizontal scroll.
- **Raised by:** Designer. **Dimension:** Visual hierarchy; Interaction. **Severity:** Medium. **Effort:** Low–Medium.
- **Recommendation:**
  - At under 640 px, hide the grid and show the queue first.
  - Render the Table as stacked cards (Firm · Score · Lane · Reason · Date).
  - Keep a compact tab bar on the detail view.

### F25. Board duplicates Focus

- **Where:** Board tab.
- **Problem:** The same lanes as Focus in columns, with no drag, no extra data, and Parked truncated to 8 ("34 more in the Table view").
- **Raised by:** Designer. **Dimension:** IA; Cognitive load. **Severity:** Low. **Effort:** Low.
- **Recommendation:** Remove Board, or repurpose it as a relationship-stage pipeline (Yet to reach out → Waiting → In conversation → Passed) driven by the user-owned status from F3.

### F26. Amber is overloaded

- **Where:** "Message today" lane, "Fresh" labels, recent-activity bars, focus ring, active-tab underline.
- **Problem:** Amber means "act today", "recent" and "focused" all at once. With Message today empty, amber still appears everywhere.
- **Raised by:** Designer. **Dimension:** Visual design; Accessibility. **Severity:** Low. **Effort:** Low.
- **Recommendation:** Reserve amber for "Message today". Use a neutral or teal "New" tag for freshness, a white or blue focus ring, and a neutral tab underline.

### F27. The detail layout is inconsistent across VCs

- **Where:** Prologis Ventures detail.
- **Problem:** There is no "Does it fit you?" section, which other VCs have.
- **Raised by:** Designer. **Dimension:** Consistency. **Severity:** Low. **Effort:** Low.
- **Recommendation:** Always render the fit chips. Use a "Not assessed" state when data is missing.

### F28. The full-page vs panel split is confusing, with no loading feedback

- **Where:** "Open the full page" link.
- **Problem:** The full page is nearly identical to the panel; it only adds "Every signal on record". After the click the old view stayed painted with no loading indicator.
- **Raised by:** Designer. **Dimension:** Perceived performance; IA. **Severity:** Low. **Effort:** Low.
- **Recommendation:** Put "Every signal on record" in the panel as a collapsible section and drop the separate page, or add a route-transition progress bar.

### F29. The 404 is the unbranded Next.js default

- **Where:** Any bad URL (e.g. `/vc/<bad-id>`, `/import`).
- **Problem:** A black screen with no nav and no way back.
- **Raised by:** Designer. **Dimension:** Feedback. **Severity:** Low. **Effort:** Low.
- **Recommendation:** Add `app/not-found.tsx` using the app shell, with the message "That investor isn't on your list" and a "Back to this week" button.

### F30. Visual polish

- **Where:** Focus queue rows; money formatting.
- **Problem:**
  - Each row has about 50 px of empty space to the left of the firm name, an apparently empty avatar slot.
  - Amounts change format between runs ("$50M" → "$50 million").
  - Dates mix "Sept" and "Sep" and have no year.
- **Raised by:** Designer. **Dimension:** Visual design; Consistency. **Severity:** Low. **Effort:** Low.
- **Recommendation:** Remove the empty slot or fill it with the firm logo. Format amounts in one place ("$50M", "£450k"). Use one date format ("5 Oct" plus "(7d ago)"), adding the year for anything not in the current year.

### F31. Muted text contrast is likely low

- **Where:** Ages ("14d"), "30 days ago / Today", helper text, Parked dates.
- **Problem:** Small grey-on-navy text. **[Visual estimate, not measured]** It is likely below WCAG AA 4.5:1.
- **Raised by:** Designer. **Dimension:** Accessibility. **Severity:** Low. **Effort:** Low.
- **Recommendation:** Raise the muted text token to at least 4.5:1 against the card background and check it with a contrast tool. Positives: the focus ring is clearly visible, and the lane chips carry text, not just colour.

### F32. The system/user data boundary is only half-drawn

- **Where:** The detail panel overall; Table columns.
- **Problem:** "Your notes" has a lock and "Yours". But system-written fields (summary, score, lane, action) are not labeled as auto-generated, and the Table mixes "Your status" next to system "Action" with identical styling.
- **Why it matters:** Vikram can't tell at a glance what the scan may change.
- **Raised by:** Designer. **Dimension:** Data ownership. **Severity:** Medium. **Effort:** Low.
- **Recommendation:**
  - Tag system fields with a small "Auto · {run time}" caption and a tinted background.
  - Tag user fields with the lock icon.
  - In the Table, group the columns under two header bands, "From latest scan" and "Yours".

### F33. Discover has no action

- **Where:** Discover cards.
- **Problem:** Good suggestions, but no "Add to list" and no "Dismiss".
- **Raised by:** Both. **Dimension:** Workflow. **Severity:** Low. **Effort:** Low (once F4 exists).
- **Recommendation:** Add "Add to my list" and "Not interested" buttons. Hide dismissed firms on future runs.

### F34. The scheduled run fires late

- **Where:** `/runs` → Mon run at 8:24 IST vs the promised 08:00.
- **Problem:** A 24-minute lag. **[Assumption]** Vercel Cron jitter or a cold start.
- **Raised by:** Designer. **Dimension:** Feedback. **Severity:** Low. **Effort:** Low.
- **Recommendation:** Schedule the cron for 07:30 IST so data is ready by 08:00, and show the actual completion time in the pill.

---

## 7. Prioritized roadmap

**Fix first: every Critical finding**

1. F1: split Parked into Quiet and Low-fit.
2. F2: relevance gate.
3. F5: no fact drift in role or type.
4. F6: real link verification.
5. F3: editable notes, contact log and "Mark sent".
6. F7: auth + RLS.
7. F4: Import CSV and Add investor.

**Quick wins (high impact, low effort)**

- F8: fix the "no one scored 60" copy.
- F9: visible "Updated…" pill and honest source count.
- F10: ⚠ for failed sources; Partial/Failed run status.
- F11: score badge on rows; deduplicated breakdown.
- F13: remove the grid; shrink the hero.
- F16: "Your contact" label.
- F18: label which date is shown.
- F32: "Auto" vs "Yours" tagging.

**Big bets (high impact, higher effort)**

- F15: "Today's picks" tray, reordered detail panel and inline source preview.
- F2 (deeper): logistics relevance classifier with regression tests.
- F4: full import flow with dedupe.
- F10 (deeper): source-health alerts and "not fully checked" markers per VC.

**Polish**

F12, F14, F17, F19–F31 (excluding those listed above), F33, F34.

### Top 5 changes for trust and twice-weekly use

1. **Honest lanes:** "Contact this week" (relevance-gated), "Maybe", and a true "Quiet: no signal in 30 days" list (F1, F2).
2. **Verifiable evidence:** quote-on-page check, canonical article links, no role or type drift, inline preview (F5, F6).
3. **Editable notes, contact log and "Mark sent"**, behind auth, with a visible "scans never touch this" guarantee (F3, F7, F32).
4. **Visible freshness and honest run health** in the header (F9, F10).
5. **A five-minute Monday layout:** no grid, score badges, panel reordered to evidence → message → notes, and a "Today's 3" tray (F11, F13, F15).

---

## 8. What's working well (keep and extend)

- **Evidence-first "Why now" card.** Company, round, size, role and announced date as structured fields, plus one sentence saying *why it's in this lane*. Extend this pattern to non-deal signals (title, outlet, date, speaker).
- **"Confirmed by 2 sources"** (8VC). Strong trust pattern; use it for deduplication everywhere (F12).
- **Fit chips** (Seed / B2B / Logistics / Software, with matches / partial / no). An instant answer to "is this my kind of investor?"
- **People ranked by decision power, from the firm's own team page,** with role-aware drafts and the explicit "Nothing is sent from this page."
- **The "Yours" lock on notes,** and the global note "Your status, notes and contact history are [DEMO] sample data. Investor names, signals and links are live." That is honest labeling.
- **Run now asks to confirm and estimates the duration**, and other tabs show "A run is in progress".
- **A transparent run history** with per-source counts and errors. Keep it; just translate it (F10, F23).
- **Discover** surfaces real, relevant new investors and warns when a firm can't be verified.
- **Keyboard support:** `/` search, `j`/`k` navigation, `c` to copy, and a visible focus ring.
- **Plain-language lane names** ("Message today", "Follow up", "Maybe, if you have time"). This is the right voice; extend it to errors and source names.

---

## 9. Things to verify outside the browser

1. **Update scope:** in the scan job, confirm the Supabase `update()` / `upsert()` payload contains only `last_signal_date`, `signal_summary`, `follow_up_score` and `recommended_action`, plus any system-only columns. Watch for `upsert` on the full row object, which nulls out omitted user columns. The UI shows many more system fields (lane, fit, drafts, team), so check where they live.
2. **Notes isolation:** are `notes`, `contact_history` and `last_contact` in the same table as the signal columns? Add a DB trigger or column-level privileges so the service role used by the scan *cannot* update them. Write a test: seed "AUDIT NOTE 123" → run the scan → assert unchanged.
3. **RLS and auth:** with no login in the UI, check whether the anon key can read or write the VC table. **This is urgent once notes are real.**
4. **Cron:** `vercel.json` crons. Mon and Thu 08:00 IST is `30 2 * * 1,4` UTC. Confirm the Thursday entry exists. Check whether the 24-minute lag is cold start or function duration, and whether 193–242 s exceeds your plan's `maxDuration` (one Sunday run logged "8 skipped for time").
5. **Gemini model:** confirm the model string is a Gemini Flash variant ("gemini-grounding" in logs doesn't say), and what happens on timeout ("classified collected items only").
6. **30-day window:** is `signal_date` the *publish* date parsed from the page, or the crawl date? TMV was off by one day. Is the window enforced at query time and at scoring time?
7. **Link verification logic:** what "Date and link checked" actually tests. It passed homepage URLs (TMV, Better Capital).
8. **Dedup key** for signals (Zero ×2, WSJ ×2) and its effect on the "+10, two sources agree" bonus.
9. **Score formula:** reconcile the code with the UI text (64.5 vs 61.9 vs the displayed 61).
10. **Failed-run handling:** if all of Gemini times out, are scores recomputed from partial data, which would silently demote VCs to Parked? Is the previous state kept? Is anyone alerted?
11. **`portfolio-diff`:** 0 results and 403s in every logged run. It is likely blocked by bot protection, so the "new investment" signal type depends on news only.
12. **Diff baseline:** why a manual run reset "Since Sunday… 12 went quiet" to "Since Monday", and where "went quiet" is stored.
13. **Lane logic:** why Primary (61, 4/4 fit) is excluded from "Message today": probably the status override "waiting for a reply". Confirm it's intentional and matches the empty-state copy.
