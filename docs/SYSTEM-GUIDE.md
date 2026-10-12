# VC Pipeline Intelligence: the complete guide

How the whole tool works, end to end: what it is for, where every piece of data comes from, how it is checked and scored, how the database protects the founder's own notes, what each part of the dashboard does, how it runs on its own, and how to operate it.

- **Live site:** https://vc-pipeline-lovat.vercel.app (public, no login)
- **Code:** https://github.com/anudeeptatireddy-lgtm/vc-pipeline
- **Database:** Neon Postgres, project `vc-pipline` (`noisy-surf-05848493`), AWS us-east-2
- **Companion docs:** [`components-map.md`](components-map.md) (component map and the submission image), [`dashboard-design.md`](dashboard-design.md) (visual and copy spec), [`signal-sources.md`](signal-sources.md) (per-source detail and the scoring source of truth), [`swap-log.md`](swap-log.md) (how the investor list was changed), [`proofs/README.md`](proofs/README.md) (evidence for each grading requirement), [`assumptions.md`](assumptions.md)

*Figures marked "live" were read from the database on 12 Oct 2026, after the first scheduled Monday run.*

---

## Contents

1. [What it does, in one minute](#1-what-it-does-in-one-minute)
2. [The person it serves](#2-the-person-it-serves)
3. [The system at a glance](#3-the-system-at-a-glance)
4. [A run, step by step](#4-a-run-step-by-step)
5. [Where the data comes from](#5-where-the-data-comes-from)
6. [Verification: nothing is trusted from the model](#6-verification-nothing-is-trusted-from-the-model)
7. [Classification with Gemini](#7-classification-with-gemini)
8. [Source tiers and triangulation](#8-source-tiers-and-triangulation)
9. [Scoring](#9-scoring)
10. [Recommended action and the four lanes](#10-recommended-action-and-the-four-lanes)
11. [Who to contact and drafted messages](#11-who-to-contact-and-drafted-messages)
12. [The database](#12-the-database)
13. [Protecting the founder's own columns](#13-protecting-the-founders-own-columns)
14. [The dashboard, screen by screen](#14-the-dashboard-screen-by-screen)
15. [Schedules, Run now and daily upkeep](#15-schedules-run-now-and-daily-upkeep)
16. [Building and maintaining the investor list](#16-building-and-maintaining-the-investor-list)
17. [Reliability: how it keeps working](#17-reliability-how-it-keeps-working)
18. [Cost and quotas](#18-cost-and-quotas)
19. [Security, privacy and ethics](#19-security-privacy-and-ethics)
20. [Accessibility and design system](#20-accessibility-and-design-system)
21. [Testing and proofs](#21-testing-and-proofs)
22. [Deployment and environment](#22-deployment-and-environment)
23. [Operating it: commands and routines](#23-operating-it-commands-and-routines)
24. [Repository map](#24-repository-map)
25. [Decisions that differ from the original docs](#25-decisions-that-differ-from-the-original-docs)
26. [Known limits and honest caveats](#26-known-limits-and-honest-caveats)
27. [Glossary](#27-glossary)

---

## 1. What it does, in one minute

Twice a week, the tool checks 50 venture investors on a founder's list for public activity in the last 30 days: deals they led, funds they closed, essays, podcasts, talks, LinkedIn posts, portfolio-page changes and SEC filings. Every item is verified in code (real link, real date, actually about that investor), classified by Gemini for how well it fits the founder's company, and scored. The result is written back to the founder's investor table in Postgres and shown on a dashboard that answers, in order:

1. **Who should I contact?** The *Message today* lane, ranked.
2. **Why now?** The dated public signal, with deal facts.
3. **What do I say?** An opening or nudge line, plus a drafted email, LinkedIn note and follow-up for the right person at the firm.
4. **Is this real?** Every claim links to its source, with the date and link checked.
5. **Who can I ignore?** The parked list, folded away.

Everything the AI does goes through one model (Gemini 3.7 Flash). The dashboard never writes to the database. The founder's own notes, status and contact history are never touched by the system, enforced by database permissions rather than by good intentions.

## 2. The person it serves

**Vikram** (a fictional founder, per `assumptions.md` A3) is two months into raising a **seed round for a B2B logistics SaaS** in Bengaluru. He opens the dashboard twice a week before he starts emailing. He is short on time and sensitive to rejection, so the product is built around one idea: *spend your outreach on the few investors who are active, on-thesis and reachable right now, and say something specific.*

His fit lens is strict, and the whole scoring system follows it:

| Axis | What counts as a match |
|---|---|
| **Customer** | B2B (businesses buy it), not consumers |
| **Sector** | Logistics or supply chain |
| **Offering** | Software, not hardware or asset-heavy operations |
| **Stage** | Pre-seed, seed or seed extension |

Consumer logistics, warehouse robotics and Series A+ deals are still tracked, but they count for much less.

**What's real and what's demo:** the investors, their websites and partners, every signal, link, date, score, recommendation, person and draft are **real, live data**. Only Vikram's own columns (status, notes, contact history, last contact date) are `[DEMO]` sample values, because he is fictional.

## 3. The system at a glance

![Components Map](components-map.png)

```
 Vercel Cron (Mon & Thu 08:00 IST) ─┐
 Run now button (dashboard) ────────┼─▶ /api/run-pipeline ─▶ lib/run.ts
                                    │        │
                                    │        ├─ batch feeds once (Inc42, YourStory, trade press)
                                    │        └─ 25 investors in parallel, 140 s budget:
                                    │             sources ─▶ verify ─▶ Gemini classify ─▶ vote
                                    │             ─▶ triangulate ─▶ score ─▶ update_vc_signals()
                                    │
 Vercel Cron daily (11:30 IST) ─────┴─▶ /api/keepalive ─▶ Neon ping ─▶ contacts + drafts upkeep

 Neon Postgres ─▶ read-only SQL views ─▶ lib/queries.ts + lib/triage.ts ─▶ dashboard (Next.js)
```

**Live numbers (12 Oct 2026):**

| Measure | Value |
|---|---|
| Active investors / archived | 50 / 8 |
| Signals stored / in the last 30 days | 332 / 328 |
| Source tiers of stored signals | A 2 · B 76 · C 184 · D 70 |
| People found at firms | 163 (80 decision-makers, 50 partners, 14 principals, 4 associates, 15 other) |
| People with LinkedIn / with a published personal email | 89 / 16 |
| Firms with a published firm email / with a pitch form | 24 / 15 |
| Drafted messages | 200 |
| Portfolio snapshots | 165 |
| Suggested investors (Discover) | 18 |
| Pipeline runs logged | 19 |
| First scheduled run (Mon 12 Oct, 08:24 IST) | 50 investors in 193 s, 86 new signals, 48 Gemini calls, 100 Tavily searches, 0 Exa calls ($0) |

## 4. A run, step by step

What happens when the Monday cron fires (`lib/run.ts`, `lib/pipeline.ts`):

1. **Authenticate.** Vercel calls `GET /api/run-pipeline` with `Authorization: Bearer <CRON_SECRET>`. Anything else gets a 401.
2. **Lock.** If another run started less than 10 minutes ago and hasn't finished, this one stops (`RunLockedError`). One run at a time, always.
3. **Open the run log.** A `pipeline_runs` row is created with the trigger (`cron`, `manual` or `script`).
4. **Load context.** All active (non-archived) investors with their identifiers (website, partner name, LinkedIn, RSS, YouTube, portfolio URL, SEC CIK), firm profiles and Vikram's status.
5. **Batch feeds once.** Inc42, YourStory and logistics trade-press RSS are fetched once per run and matched to investors by name afterwards, instead of 50 times.
6. **Fan out.** Investors are processed 25 at a time. No new investor starts after 140 seconds, so the whole run ends inside Vercel's 300-second limit (a full run takes about 190–240 s).
7. **Per investor:**
   1. Every source adapter runs, each one isolated: a failing source is recorded and skipped; it never stops the investor or the run.
   2. **Circuit breaker:** if a source answers 401, 403, 429 or 432 (bad key, blocked, out of quota), it is skipped for the rest of the run, instead of failing 50 times.
   3. **Gemini grounding** gets the collected items plus Google Search and URL context, classifies them and looks for anything missed. Capped at 90 s; if it times out, an items-only call (40 s cap) classifies what was already collected.
   4. **Verification** (section 6) resolves each link, finds the real publish date, enforces the 30-day window, checks the page is about this investor, and de-duplicates.
   5. **Majority vote** stabilises each page's classification across runs (section 7).
   6. **Triangulation** upgrades, confirms or down-weights signals that agree or conflict (section 8).
   7. **Scoring** produces the 0–100 score, the one-sentence summary and the recommended action (sections 9–10).
   8. **Protected write:** `update_vc_signals()` sets exactly four columns on `vcs`. A row goes to `vc_score_history`.
8. **Close the run log** with duration, per-source counts, new signals, errors, Gemini tokens and search usage, and per-investor diagnostics (what each source found, what was rejected and why).
9. **Dashboard.** Pages read fresh data on every request (`force-dynamic`), so the next page load shows the new results.

## 5. Where the data comes from

All sources are public pages or official APIs. Each lives in `lib/sources/` and implements the same `SignalSource` interface.

| Source | What it finds | How | Cost / limits | Notes |
|---|---|---|---|---|
| **Gemini grounding** (`gemini-grounding.ts`) | Anything public the other sources missed; classification of everything | Gemini 3.7 Flash with Google Search + URL context + JSON schema | Gemini API; ~48 calls per full run | 90 s cap, 40 s items-only fallback |
| **Bing News RSS** (`news-rss.ts`) | News mentioning the firm or partner | One RSS query per investor; the real publisher URL is taken from the `url=` parameter | Free, no key | Replaces Google News RSS, which `robots.txt` disallows. OR-queries return nothing on Bing, so queries are single terms |
| **Web search** (`exa.ts`, reported as `web-search`; `lib/search.ts`) | Articles and posts by the firm or partner in the window | **Tavily first**; Exa only if Tavily fails or hits the cap, with small requests (5 results, 300 characters) | Tavily free tier, capped at 950/month in code (counted from `pipeline_runs`); about 100 per full run | Exa cost about $1.70 per run when it was primary |
| **LinkedIn via search index** (`linkedin-index.ts`) | Partner posts and firm updates | Search index results for `linkedin.com/posts` only; **never fetches linkedin.com** | Part of web search | Post dates are decoded from the activity ID in the URL (`lib/linkedin-date.ts`) |
| **Firm blog / Substack / Medium RSS** (`rss-feed.ts`) | Essays and announcements | The firm's own feed | Free | Always sent to Gemini, since own-feed items rarely repeat the firm's name |
| **YouTube Data API** (`youtube.ts`) | Talks, interviews, channel uploads | `playlistItems.list` for the channel (1 unit) + one capped `search.list` for the partner (100 units) | ~100 searches/day free | YouTube channel RSS is disallowed by `robots.txt` |
| **Podcast Index** (`podcast-index.ts`) | Podcast appearances by the partner | Search by person; SHA-1 signed auth | Free | |
| **SEC Form D** (`sec-form-d.ts`) | US fund raises (fresh capital to deploy) | EDGAR full-text search | Free; descriptive User-Agent required | US funds only |
| **Batch feeds** (`batch-feeds.ts`) | India funding news and logistics trade media | Inc42, YourStory, trade-press RSS, once per run | Free | Matched to investors by name |
| **Portfolio page diff** (`portfolio-diff.ts`, `lib/portfolio.ts`) | New portfolio companies (often before any press) | Snapshot the portfolio page, hash it, diff company lists (links, or image alt text on logo walls; Jina Reader for JS pages) | Free | Needs the same company in **two consecutive runs** before it counts (debounce). Produces tier-A signals because we fetched the evidence ourselves |

## 6. Verification: nothing is trusted from the model

`lib/verify.ts` decides whether a candidate becomes a stored signal. The model can suggest; code decides.

1. **A real URL.** It must be `http(s)`. Redirect and aggregator links (news redirectors, link shorteners) are followed up to 6 hops to the publisher's own URL. If it can't be resolved, the item is rejected (`unresolved redirect`).
2. **A real publish date,** taken from the first source that has one:
   1. the page's own metadata (`article:published_time`, `datePublished` in JSON-LD, `<time datetime>` and similar),
   2. the RSS item date,
   3. the LinkedIn activity ID in the URL,
   4. the model's reported date, only as a last resort when none of the above exist.
3. **Inside the window.** The date must be within the last 30 days, or the item is rejected (for example, `outside 30-day window (2024-10-16)`).
4. **About this investor.** The fetched page (its text, title and description; for JavaScript-only pages also the headline and evidence quote) must name the firm or the partner's surname. Otherwise: `page doesn't mention the firm or partner`.
5. **De-duplication.** Duplicates are removed by canonical URL, then by (company, signal type) within 7 days. The most confident copy is kept, and a copy from a different source is recorded in `corroborated_by` instead of being thrown away.

Every rejection is counted per source and sampled into the run's diagnostics, so `npm run diagnose` can show exactly why an investor didn't reach 60.

## 7. Classification with Gemini

Gemini is the **only** AI in the application (`lib/gemini.ts` is the single entry point; an ESLint rule blocks the Anthropic and OpenAI SDKs). It returns structured JSON validated with zod. For each signal it reports four **fit axes**, never a score:

| Field | Values |
|---|---|
| `sector_fit` | `fit`, `partial`, `none` |
| `customer_type` | `b2b`, `b2b2c`, `b2c`, `unknown` |
| `offering_type` | `software`, `marketplace`, `services`, `fintech`, `hardware`, `asset_heavy`, `not_applicable`, `unknown` |
| `round_stage` | `pre-seed`, `seed`, `seed-extension`, `series-a`, `series-b-plus`, `debt`, `not-a-deal`, `unknown` |

It also returns the signal type (`investment`, `fund_close`, `writing`, `interview`, `event`, `team_change`, `social_post`, `other`), a one-sentence summary, an evidence quote from the page, the company name, and an opening line and a nudge line written from that evidence.

**Majority vote** (`lib/classify.ts`): Gemini 3 has no temperature control, so the same article can be called `fit` on Monday and `partial` on Thursday. Each run adds one vote per page to `signals.classification_votes`; the stored classification is the verdict with the most votes (ties keep the current one). Scores stop flip-flopping between runs.

## 8. Source tiers and triangulation

**Tiers** (`lib/sources/tiers.ts`) set each signal's base confidence:

| Tier | Meaning | Confidence |
|---|---|---|
| A | The firm's own site, filings, or evidence we fetched ourselves (portfolio diff) | 0.95 |
| B | Established press and trade media | 0.85 |
| C | Other reputable sites, newsletters, podcasts, YouTube | 0.75 |
| D | Weak or unknown sources, social posts via search index | 0.55 |

**Triangulation** (`lib/triangulate.ts`, `signal-sources.md` §8.2) runs over the 30-day window before scoring:

- **Upgrade:** a D-tier signal plus any A/B/C signal about the same company within 14 days is treated as B-tier, confirmed.
- **Confirmation:** two different sources on the same company (for example, portfolio diff + press, or Form D + news) mark each other as corroborated. The dashboard shows *Confirmed by 2 sources*.
- **Conflict:** an uncorroborated D-tier "investment" whose company is absent from a portfolio page we've snapshotted at least twice has its confidence capped at 0.5.

## 9. Scoring

All scoring rules live in one file, `lib/score.ts`, with unit tests (`tests/score.test.ts`).

### 9.1 Logistics relevance (from the four axes)

| Sector | Customer and offering | Relevance | Multiplier |
|---|---|---|---|
| fit | B2B + software | **direct** | 1.5 |
| fit | one axis partial (e.g. marketplace, B2B2C), or one unknown and the other a clear fit | **thematic** | 1.2 |
| fit | consumer, or hardware / asset-heavy | **adjacent** | 0.6 |
| partial | B2B + software | **adjacent** | 0.6 |
| partial or none | anything else | **unrelated** | 0.15 |

### 9.2 Stage multiplier

Pre-seed, seed, seed extension **1.3** · Series A **1.0** · Series B+ or debt **0.5** · not a deal or unknown **1.0**.

### 9.3 Signal type weight

Investment **40** · fund close **35** · writing **25** · interview **22** · event **18** · team change **15** · social post **12** · other **10**.

### 9.4 Value of one signal

```
signal_value = type_weight × relevance_multiplier × stage_multiplier × confidence × e^(−days_ago / 14)
```

A two-week-old item is worth about 37% of a fresh one; a month-old item about 12%.

### 9.5 Firm fit (from the firm profile)

`firm_fit = seed behaviour × logistics thesis × investor type`, where:

- Seed behaviour: leads seed **1.15** · joins seed **1.0** · Series A+ only **0.5** · unknown **0.9**
- Logistics thesis: core (dedicated supply-chain fund) **1.2** · explicit **1.1** · portfolio only **1.0** · none **0.7**
- Investor type: seed fund **1.0** · multi-stage **0.9** · angel network **0.9** · accelerator **1.0** · corporate venture arm **0.6**

### 9.6 Follow-up score (0–100)

```
raw   = sum of the top 3 signal values in the last 30 days
        + 10 if two independent sources agree
score = min(100, round(raw × firm_fit))
if nothing in the window is direct or thematic: score = min(score, 45)   ← off-thesis cap
```

**Worked example (illustrative):** a seed fund that leads seed rounds with an explicit logistics thesis (firm fit 1.15 × 1.1 × 1.0 = 1.265) led a seed round in a B2B logistics software company 5 days ago, reported by a B-tier outlet:
40 × 1.5 × 1.3 × 0.85 × e^(−5/14) ≈ 46.4. A second outlet confirms it (+10), and a 12-day-old essay on freight software adds 25 × 1.5 × 1.0 × 0.75 × e^(−12/14) ≈ 12.0. Raw = 68.4; × 1.265 = **87**: *Message today*.

## 10. Recommended action and the four lanes

### 10.1 What the pipeline stores (`recommended_action`, `lib/score.ts`)

| Score | Vikram yet to reach out | Vikram waiting for a reply |
|---|---|---|
| ≥ 60 | Reach out this week | Nudge now |
| 30–59 | Reach out if capacity allows | Light nudge (last contact > 14 days ago) or Hold (contacted recently) |
| < 30 | Quiet: deprioritize this week | Hold |

### 10.2 What the dashboard shows (`lib/triage.ts`)

The dashboard adds a **fit check** from the lead signal's four tags, then sorts every investor into one lane:

| Lane | Rule |
|---|---|
| **Message today** | Score ≥ 60, not already waiting, fit confirmed |
| **Waiting on a reply, with something new to say** | Waiting for a reply, the pipeline says *Nudge now* or *Light nudge*, fit confirmed |
| **Maybe, if you have time** | Score 30–59; or ≥ 60 without a confirmed fit; or waiting but contacted recently |
| **Parked** | Score < 30, or no signal in 30 days |

**Fit tags:** each of Seed, B2B, Logistics and Software is *filled* (matches), *half* (partly, or not stated) or *hollow* (doesn't match). For example, an essay has no round, so Seed is half if the firm does seed rounds. **Fit confirmed** means B2B and Logistics are filled and neither Seed nor Software is hollow.

Only *Message today* counts in the headline. After the 12 Oct scheduled run the honest answer was "No one needs a first message today": one follow-up (Primary Venture Partners, 61), seven maybes (8VC 56, Blume 55, Dynamo 52, TMV 48, Elevation 37, Fuel 34, Better Capital 30) and 42 parked.

## 11. Who to contact and drafted messages

### 11.1 Finding the people (`lib/contacts-refresh.ts`, `lib/contacts.ts`)

For each firm:

1. Read the homepage and up to two **team pages** (the stored team URL, links found on the homepage, then `/team`, `/people`, `/our-team`, `/about`…). A `/team` link that redirects to a portfolio company is skipped. JavaScript-rendered pages are read through Jina Reader.
2. Gemini lists the people named on those pages with titles, stated focus and a short bio. **A name is kept only if every part of it appears on the fetched page**, and only investment-team members (partners, principals, associates) are kept.
3. **Point-of-contact level** from the title: decision-maker (managing partner, general partner, founder), partner, principal (incl. VP, director, head of), associate, other.
4. **Ranking:** relevant decision-makers first (focus mentions logistics, supply chain, B2B, SaaS, mobility…), then partners, by level. Up to 5 people per firm.
5. **Links:** LinkedIn and X links are matched to a person only when the link sits in the same card as exactly one name. If the top person has no LinkedIn, **one** Tavily search per firm looks for it.
6. **Emails:** only addresses the firm publishes (mailto links or visible text) **on its own domain**. Portfolio companies' emails on the same page are ignored. A published address matching the person's name is shown as theirs; generic inboxes (`hello@`, `pitch@`) are shown as firm routes. Emails hidden by Cloudflare's email protection are **not decoded**; the dashboard links to the page instead.
7. **Firm routes:** pitch form (on the firm's domain or a known form host), published firm emails, contact page.

Live: 163 people, 89 with LinkedIn, 16 with a published personal email, 24 firms with a published firm email, 15 pitch forms.

### 11.2 Writing the drafts (`lib/messages.ts`)

For the top 2 people at each firm, Gemini writes an **email**, a **LinkedIn connection note** and, when Vikram is waiting for a reply, a **follow-up**, using only:

- the person's title, focus and bio from the firm's site,
- the firm's best dated signal (summary, date, source, fit, evidence quote),
- `data/founder.json` (company, one-liner, city, round, traction, ask).

Every draft is checked in code before it is stored, and regenerated once if it fails:

- no exclamation marks; no flattery ("big fan", "admire", "impressive"…);
- LinkedIn note ≤ 300 characters; email ≤ 160 words; subject ≤ 12 words; follow-up ≤ 80 words;
- unknown founder facts stay as visible `[placeholders]` (for example `[Company]`, `[traction]`) and are never invented.

Nothing is ever sent by the system. The dashboard offers **Copy**, **Open in email** (opens the viewer's own mail app pre-filled, only when an address is published) and **Open LinkedIn**.

To personalise the drafts, fill in `data/founder.json` and run `npm run contacts`.

## 12. The database

Neon Postgres (serverless driver `@neondatabase/serverless`; type parsers are passed per query because the client-level option is ignored by `.query()`).

### 12.1 Tables

| Table | Holds | Written by |
|---|---|---|
| `vcs` | One row per investor: Vikram's columns, identifiers, the four signal columns, archive flag | Seed script (insert), `update_vc_signals`, `update_vc_identifiers` |
| `signals` | Every verified signal with fit axes, tier, confidence, evidence, value, votes, lines | Pipeline |
| `vc_profiles` | Firm fit profile: seed behaviour, thesis, investor type, cheque, geography | Profile script |
| `portfolio_snapshots` | Portfolio page snapshots for diffing | Pipeline |
| `pipeline_runs` | Run log: trigger, timing, counts, usage, errors, diagnostics | Pipeline |
| `vc_score_history` | Score and action per investor per run | Pipeline |
| `suggested_vcs` | Investors not on the list, with rubric score, deal count, founder-facing summary and caveat, evidence | Suggestion script |
| `vc_contacts` | People at each firm: title, POC level, focus, bio, rank, links, published email | Contacts discovery |
| `vc_channels` | Firm routes: pitch form, firm emails and where they were found, X, contact page | Contacts discovery |
| `vc_messages` | Drafts per person: email, LinkedIn note, follow-up, and the signal they were written from | Message drafting |
| `schema_migrations` | Which migration files have been applied | `npm run db:migrate` |

### 12.2 Read model (views)

| View | Purpose |
|---|---|
| `v_dashboard_vcs` | Investor + Vikram's columns + score + action + firm profile + 30-day signal count (archived excluded) |
| `v_signal_feed` | Signals joined to the firm |
| `v_top_signal` | Lead signal per investor (highest `signal_value`, then newest) with opening and nudge lines |
| `v_signal_tape` | Days-ago of each signal in the window |
| `v_vc_sources` | Source links in the window |
| `v_score_changes` | Score now vs the previous run |
| `v_last_run` | Latest run |

### 12.3 Migrations (`db/migrations/`)

| File | Adds |
|---|---|
| `0001_init.sql` | Tables, protected functions, views |
| `0002_runtime_role.sql` | `vc_runtime` grants (see section 13) |
| `0003_archive.sql` | Archive flag on `vcs` (set only through `update_vc_identifiers`) |
| `0004_classification_votes.sql` | Majority-vote store on `signals` |
| `0005_contacts.sql` | `vc_contacts`, `vc_channels`, `vc_messages` |
| `0006_contact_url.sql` | Contact page and "email hidden from bots" on `vc_channels` |
| `0007_suggested_score.sql` | Rubric score, deal count, summary and caveat on `suggested_vcs` |

## 13. Protecting the founder's own columns

The assignment's hardest rule: **the system must never overwrite Vikram's manual columns** (`status`, `last_contact_date`, `contact_history`, `personal_notes`, and the rest of his data). This is enforced by the database itself:

| Role | Can do | Used for |
|---|---|---|
| `neondb_owner` | Everything | Migrations only; never deployed to Vercel |
| `pipeline_writer` (NOLOGIN) | Column-level UPDATE on system columns only | Owns the two `security definer` functions |
| `vc_runtime` (the app's login) | SELECT; INSERT new investors; write pipeline tables; **no UPDATE or DELETE on `vcs`** | Everything the app and scripts do |

- `update_vc_signals(id, last_signal_date, signal_summary, follow_up_score, recommended_action)` can change only those four columns.
- `update_vc_identifiers(...)` can change only identifier columns and the archive flag.
- Because `vc_runtime` has no UPDATE on `vcs`, even a bug in the app cannot touch Vikram's notes.
- `npm run check:manual` runs the pipeline and then proves every investor's manual columns are byte-for-byte unchanged (it fails if no investor was processed, so it can't pass vacuously). `npm run proofs` also tries forbidden writes as `vc_runtime` and records that the database refuses them.

Why `vc_runtime` was made with SQL: Neon roles created through its API join `neon_superuser` and get full privileges, which would break this guarantee. The API-made role was deleted.

## 14. The dashboard, screen by screen

Built with Next.js 16 (App Router). Pages are server-rendered from `lib/queries.ts`; interactive parts are client components in `components/triage/`. It is read-only. View and selection live in the URL (`/?view=table`, `/?vc=<id>`), so links and the back button work.

### 14.1 Top bar (every page)

- **Pipeline** logo (home).
- **Tabs:** Focus, Board, Table, Discover.
- **Status pill:** "Checked 9 of 10 sources. Updated Mon 8:27 IST". It counts a source as missed only when it was skipped for the run, and refers to the last *full* run, not a one-investor test. Calm wording if a run is in progress or didn't finish. Links to Run history.
- **Search** (`/` or Cmd+K): find any investor by firm or partner; arrows, Enter, Esc.
- **Demo:** the guided tour (14.8).
- **Theme toggle:** light or dark.
- **Run now** (15.2).

On phones the tabs wrap under the bar, Demo and Run now become icon buttons, and the status line moves under the bar.

### 14.2 Briefing band

- **Headline:** one sentence that counts only *Message today* ("Two investors are worth a message today." / "No one needs a first message today.").
- **Subline:** follow-ups with news, and how many maybes.
- **Since last run:** new signals, the biggest mover (clickable), and how many went quiet.
- **Yard map:** one square per investor, 10 columns, sorted by lane then score. Amber = message today, blue = follow up (with a notch), grey = maybe, dark = parked (flat). Click to open, hover or focus to see the name, arrow keys to move (one tab stop for the whole map). The squares drop in once on load, the page's only load animation.
- **Legend chips:** counts per lane; click to filter the queue, Board and Table.

### 14.3 Focus view

**Queue (left):** *Message today* (ranked), *Waiting on a reply, with something new to say*, *Maybe, if you have time*, then *Parked* (collapsed). Each item shows the firm, one line (deal facts like "Co-led Lantern · Seed · $7.0 million", or "Essay: …") and freshness ("Fresh · 4d"). `j`/`k` move through it.

**Workspace (right, sticky):** everything about the selected investor:

1. Name, partner, region; **Yours** chip (lock icon: "Yours: waiting for 35 days"); lane tag.
2. **Why now:** the lead signal's sentence, then deal facts (company, round, size, their role, date announced) or, for essays, talks and podcasts, the type, date and outlet. A last line says why it sits in this lane ("The fit isn't confirmed on Seed…").
3. **Does it fit you?** The four tags, filled, half or hollow, each with text for screen readers.
4. **Activity in the last 30 days:** the 30-day tape (tall bars = days with activity, amber = last week).
5. **Evidence:** the lead signal and items reporting the same thing, de-duplicated by link and by site, each with "Date and link checked" and the quote. "Confirmed by 2 sources" when true. Everything else from the month is under "Other activity this month".
6. **What to say:** the opening line (or nudge line if waiting) with **Copy** (`c`).
7. **Who to contact:** firm routes, then each person with title, POC level, focus, LinkedIn / X / email / team-page links, and **Show drafts** (email, LinkedIn note, follow-up, with Copy / Open in email / Open LinkedIn). Loaded from `/api/vc/[id]/contacts` when the investor opens.
8. **The firm:** seed behaviour, typical cheque, where they invest, logistics thesis, type.
9. **How the score works** (folded): the formula in words and the top three signal values.
10. **Your notes** (locked): Vikram's notes, history and last contact. "Yours. This page never edits it."
11. Link to the full page.

**On phones** the workspace opens as a full-screen sheet with a **Back to list** button. Focus moves to it, and Esc or Back returns to the list.

### 14.4 Board view

Four columns, one per lane, with a tile per investor (Parked shows 8 and points to Table). Click a tile to open it in Focus.

### 14.5 Table view

All 50 investors: firm and partner, region, lane, score, your status, last signal, action. Sort by any column (with `aria-sort`), filter by name, combined with the lane chips.

### 14.6 Discover view ("Not on your list yet")

Investors who backed B2B logistics software at seed in the last year but aren't on the list, ranked by the same rubric used to build the list (section 16): rubric score, deal count, "Strong match" at 70+, a summary written for the founder ("Led the pre-seed round in 5U AI, AI digital workers handling administrative freight workflows…"), the one thing to know first ("No India deals or India mandate found, so expect to explain why an Indian company fits"), and evidence links.

### 14.7 Full investor page and Run history

- `/vc/[id]`: the same workspace at full width, plus **every signal on record** with type, outlet, date, summary and quote.
- `/runs`: every run with start time, trigger (Schedule, Run now, Script), result and duration, investors processed, new signals, per-source counts and errors.

### 14.8 Demo tour

The **Demo** button starts a 19-step guided tour on the real page: the status, the headline, the yard map, the queue, then (after it clicks the first investor) why now, fit tags, tape, evidence, the line, who to contact, the drafts (it opens them), your notes, then Board, Table and Discover (it switches tabs), search, Run history, the theme (it flips it and restores it at the end) and Run now. Each step dims the page, outlines the element, and shows a ripple where it clicks. Next, Back, the arrow keys and Esc work. If a section has nothing to show that week, its step is skipped.

### 14.9 Theme

Dark follows the system setting by default. The toggle stores the choice in `localStorage`, and a tiny script in `<head>` applies it before the first paint, so the page never flashes the wrong theme.

## 15. Schedules, Run now and daily upkeep

### 15.1 Schedules (`vercel.json`)

| Cron | When | Does |
|---|---|---|
| `30 2 * * 1,4` → `/api/run-pipeline` | Monday and Thursday 08:00 IST | Full pipeline run |
| `0 6 * * *` → `/api/keepalive` | Daily 11:30 IST | One Neon query, then upkeep (15.3) |

All functions run in Vercel region `cle1` (next to Neon in us-east-2) with a 300-second limit, and all cron routes require `CRON_SECRET`.

### 15.2 Run now

The button on the dashboard opens a confirmation dialog and runs the same pipeline through a server action (`app/actions.ts`). There is **no passcode** (the owner's decision, so the professor can use it). It is protected instead by:

- **single-run lock:** if a run is already in progress, it says so;
- **3-hour cooldown:** "Data was refreshed 42 minutes ago. Try again in 138 minutes."

Progress is shown as a checklist of sources, then the number of new signals and which sources didn't respond. `CRON_SECRET` never reaches the browser.

### 15.3 Daily upkeep (`lib/maintenance.ts`)

Within about 230 seconds after the keep-alive ping:

1. **Re-draft** messages whose firm's best signal has changed since they were written (reach-out and nudge firms first), so drafts always cite the latest news.
2. **Re-discover** contacts for up to 10 firms not refreshed in 30 days, so the whole list's team data refreshes monthly.

The daily query also keeps the Neon database active.

## 16. Building and maintaining the investor list

- **Seeding** (`npm run seed`): `data/vc-seed-list.csv` → `vcs`, resolving websites, partners, LinkedIn, RSS, YouTube, portfolio URL and SEC CIK (idempotent).
- **Profiling** (`npm run profile`): Gemini reads each firm's site to fill `vc_profiles`.
- **Diagnosis:** the first diagnosis showed the low number of reach-out rows was mostly a *list* problem (several funds rarely do B2B logistics seed deals), not just a pipeline problem.
- **Rubric swaps** (`docs/swap-log.md`): candidate investors are ranked by summing, per qualifying deal, `40 × 1.5 (direct) × 1.3 (seed) × lead factor (1.0 sole lead, 0.85 co-lead) × e^(−days/180)`. Hard filters: a verified B2B logistics software round at pre-seed/seed in the last 12 months, led or co-led and named, India-accessible, not debt-only or corporate, not already listed, website verified.
  - **Round 1:** 7 out, 7 in.
  - **Round 2:** discovery over a year of Inc42 and Entrackr weekly funding roundups (72 roundups) found only 2 qualifying deals and 1 new fund. Turbostart (pre-Series A) out, BEENEXT in.
  - Rows are **archived, never deleted**, can be undone per round (`npm run swap:undo -- --plan …`), and new rows get `[DEMO]` founder values. A `pre-swap` git tag marks the state before.
- **Suggestions** (`scripts/suggest-from-lookup.ts`): the best candidates that didn't qualify (for example no India deal yet) go to `suggested_vcs` with their rubric score and founder copy, shown in Discover.
- **Export** (`npm run export:list`): `data/vc-list-export.xlsx` with active and archived rows.

## 17. Reliability: how it keeps working

| Risk | Protection |
|---|---|
| One source fails | Wrapped per source; logged; the investor is scored from everything else |
| A source's key is bad or quota is gone | Circuit breaker skips it for the rest of the run (401/403/429/432) |
| Gemini is slow | 90 s cap on the grounded call, then a 40 s items-only fallback |
| The run gets too long | 25 in parallel; no new investor after 140 s; ends well inside 300 s |
| Two runs at once | Single-run lock (10-minute window) |
| Someone spams Run now | 3-hour cooldown |
| Classification flip-flops | Majority vote per page |
| Portfolio page glitch looks like a new deal | Two-run debounce |
| A run fails | The dashboard keeps showing the last good data with a calm notice; never a blank page |
| Database goes idle | Daily keep-alive query |
| Tavily runs out | Capped at 950/month; Exa takes over with small requests |

## 18. Cost and quotas

| Service | Use | Cost |
|---|---|---|
| Vercel Hobby | Hosting, crons, functions | Free |
| Neon | Postgres | Free tier |
| Gemini 3.7 Flash | ~48 calls per full run (~190k input, ~29k output tokens) plus contacts and drafts | Pay-as-you-go, small |
| Tavily | ~100 searches per full run; ~8 runs a month, ~800 of the 1,000 free | Free (capped at 950 in code) |
| Exa | Fallback only | $0 since the switch (was ~$1.70 per run) |
| Bing News RSS, firm feeds, SEC, Podcast Index, Jina | Sources | Free |
| YouTube Data API | ~100 searches a day | Free quota |

## 19. Security, privacy and ethics

- **Secrets stay on the server.** No key has a `NEXT_PUBLIC_` prefix. The browser gets HTML and the contacts JSON only. Owner database URLs are used only for migrations.
- **Legitimate access only.** Public pages and official APIs; `robots.txt` respected (which is why Bing News replaces Google News RSS and the YouTube API replaces channel RSS); a descriptive User-Agent; at most one fetch per page per run; no logged-in automation of LinkedIn or X, no cookie scrapers, no proxies, no CAPTCHA solving. LinkedIn is only seen through a search index.
- **Contact data is only what firms publish.** Names verified on the firm's page; emails only on the firm's own domain; hidden emails not decoded; nothing sent automatically.
- **Public URL caveat.** There is no login because the founder data is demo data. A real multi-founder product would need authentication and per-founder row security.

## 20. Accessibility and design system

- **Tokens** are CSS variables in `app/globals.css`, defined for light and dark (`--bg`, `--surface`, `--ink`, `--ink2`, `--amber`, `--blue`, `--teal`, `--maybe`, `--park`…). The background is on `<html>` and `<body>`, so it fills the window at any height.
- **Fonts:** Barlow Semi Condensed for headings and firm names; Atkinson Hyperlegible Next for body text.
- **WCAG AA in both themes:** axe-core finds 0 violations on every view (Focus, Board, Table, Discover, investor page, Run history) at 390 and 1440 px, light and dark.
- **Never colour alone:** lanes have text labels and shapes (notched and flat squares), fit tags are filled, half or hollow with text, and the tape has a text description.
- **Keyboard:** every action is reachable; `j`/`k`/`c`/`/`/Esc shortcuts; one tab stop for the map; focus moves into and out of the phone sheet; proper heading order.
- **Motion:** one load animation (the map); `prefers-reduced-motion` turns all animation off.

## 21. Testing and proofs

| Check | Command | What it covers |
|---|---|---|
| Unit tests (92) | `npm test` | Scoring, relevance, stage, firm fit, triangulation, verification, dedupe, LinkedIn dates, sources, classification votes, portfolio parsing, contacts, draft rules, lanes, fit tags, deal facts, status pill, copy, run state; uses saved fixtures, no live calls |
| Database guard test | `npm test` | No app file issues UPDATE/DELETE on `vcs` |
| Types and lint | `npm run typecheck`, `npm run lint` | Strict TypeScript; ESLint blocks non-Gemini AI SDKs |
| Manual-columns proof | `npm run check:manual` | Pipeline run leaves every manual column unchanged |
| Requirement proofs | `npm run proofs` | Regenerates `docs/proofs/README.md` (R1–R12), incl. refused writes as `vc_runtime` |
| UI checks | `npm run ui:check -- <url>` | Screenshots, above-the-fold check, axe-core, reduced motion, Lighthouse |
| Review screenshots | `npx tsx scripts/ui-screens.ts <url> <dir> <label>` | 1440×900 and 1920×1080 (dark, light), 390×844 (dark); before/after in `docs/proofs/redesign/` |
| Diagnosis | `npm run diagnose` | Per-source funnel and a per-investor "why not 60" table |

## 22. Deployment and environment

- **Hosting:** Vercel (Hobby), project `vc-pipeline`, region `cle1`. Every push to `main` deploys to production; other branches get private preview links.
- **Database:** Neon project `vc-pipline`. The Neon–Vercel integration also creates a database branch for preview deployments.
- **Environment variables** (server-side only):

| Variable | Purpose |
|---|---|
| `APP_DATABASE_URL` | App's login as `vc_runtime` (production and preview) |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Owner URLs, for migrations |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini |
| `TAVILY_API_KEY`, `EXA_API_KEY` | Web search |
| `YOUTUBE_API_KEY` | YouTube Data API |
| `PODCASTINDEX_API_KEY`, `PODCASTINDEX_API_SECRET` | Podcast Index (quote the secret in env files; it contains `#`) |
| `SEC_USER_AGENT` | Required by SEC EDGAR |
| `JINA_API_KEY` | Jina Reader for JavaScript pages (optional) |
| `CRON_SECRET` | Protects the cron and run routes |

## 23. Operating it: commands and routines

```bash
npm install
cp .env.example .env.local        # fill in the keys
npm run db:migrate                # apply db/migrations to Neon (owner role)
npm run seed                      # load and resolve the investor list
npm run profile                   # firm profiles (Gemini)
npm run run-one -- --all          # one full pipeline run, locally
npm run dev                       # dashboard on http://localhost:3000
```

| Command | Does |
|---|---|
| `npm run run-one -- vc01 vc12` / `-- --all` | Pipeline for some or all investors; `--break=<source>` forces a source to fail |
| `npm run diagnose [-- <runId>]` | Why each investor did or didn't reach 60 |
| `npm run check:manual` | Prove manual columns unchanged |
| `npm run proofs` | Regenerate the proofs page |
| `npm run contacts [-- vc01 …]` | Find people and draft messages |
| `npm run reverse-lookup` / `npm run roundup-lookup` | Discover active B2B logistics seed investors |
| `npm run swap:apply` / `npm run swap:undo` | Apply or undo a rubric swap |
| `npm run export:list` | Excel export of the list |
| `npm run keepalive` | Ping Neon manually |
| `python3 docs/tools/make-components-map.py` | Regenerate the Components Map image |

**Routines:** check `/runs` after Monday and Thursday mornings; fill in `data/founder.json` before real outreach and run `npm run contacts`; re-run `npm run proofs` before a demo; follow `docs/demo-script.md` for the presentation.

## 24. Repository map

```
app/
  page.tsx                      dashboard home (triage)
  vc/[id]/page.tsx              one investor, full page
  runs/page.tsx                 run history
  actions.ts                    Run now server action
  layout.tsx                    fonts, theme script, demo tour
  globals.css                   tokens and styles
  api/run-pipeline/route.ts     scheduled run
  api/run-now/route.ts          manual run for scripts
  api/keepalive/route.ts        daily ping + upkeep
  api/vc/[id]/contacts/route.ts who to contact (JSON)
components/
  triage/                       TopBar, Briefing, Triage, Workspace, WhoToContact, InvestorPage, labels
  RunNowButton.tsx  ThemeToggle.tsx  DemoTour.tsx
lib/
  run.ts pipeline.ts            orchestration, circuit breaker, diagnostics
  sources/*                     one file per source + tiers + registry
  search.ts exa.ts              Tavily-first web search
  gemini.ts                     the only AI entry point
  verify.ts linkedin-date.ts    verification
  classify.ts triangulate.ts    voting and corroboration
  score.ts                      fit, scoring, action
  portfolio.ts                  portfolio parsing
  contacts.ts contacts-refresh.ts messages.ts maintenance.ts
  queries.ts triage.ts status.ts  dashboard read model
  db.ts sql.ts keepalive.ts auth.ts http.ts format.ts rubric.ts types.ts
db/migrations/                  0001–0007
scripts/                        seed, profile, run-one, diagnose, proofs, swaps, contacts, exports, UI checks
tests/                          vitest suites + fixtures
data/                           seed list, founder.json, swap plans, candidates, exports
docs/                           this guide, components map, design spec, sources, swap log, proofs
```

## 25. Decisions that differ from the original docs

| Docs said | Built | Why |
|---|---|---|
| Supabase | Neon Postgres only | Owner's decision (11 Oct 2026); app role made in SQL to keep the no-UPDATE guarantee |
| Google News RSS | Bing News RSS | Google's `robots.txt` disallows `/rss/search` |
| YouTube channel RSS | YouTube Data API | YouTube's `robots.txt` disallows `/feeds/` |
| Exa as the main search | Tavily first, Exa fallback | Cost: Tavily's free tier covers the schedule |
| Passcode on Run now | No passcode; lock + cooldown | The professor must be able to use it |
| Single-column reach-out list | Triage layout (Focus, Board, Table, Discover) with a workspace | Faster to scan and act; keeps evidence and contacts next to the decision |
| Reach out at 30–59 counted as "worth a message" | Only ≥ 60 with a confirmed fit counts | Honest headline; 30–59 shown as *Maybe* |
| Concurrency 6 | 25, with a 140 s budget | Grounded Gemini calls take ~55 s median |

## 26. Known limits and honest caveats

- **Portfolio diffing covers 33 of 50 funds:** 17 portfolio pages are JavaScript-only, bot-blocked or missing.
- **YouTube's free quota** (~100 searches a day) can run out during heavy manual testing; it resets daily and the circuit breaker handles it.
- **Model date fallback:** the model's reported date is used only when the page, the feed and the LinkedIn ID give none, and it still has to pass the 30-day window.
- **Deal size and role** come from the signal's sentence only; when it doesn't say, they're left out rather than guessed.
- **Contacts depend on firms' team pages.** Some firms list few people or hide emails; LinkedIn is found for 89 of 163 people.
- **Drafts need the founder's facts.** Until `data/founder.json` is filled in, drafts contain `[Company]` and `[traction]` placeholders on purpose.
- **List quality limits results.** Few funds lead B2B logistics software seed rounds in any given month, so weeks with zero *Message today* are expected and shown honestly.
- **Two unverifiable funds kept** (Picus, Wavemaker): their evidence pages block bots; one fund (Chiratae) failed the re-check but was kept for lack of a qualifying replacement (see `swap-log.md`).

## 27. Glossary

| Term | Meaning |
|---|---|
| **Signal** | One verified, dated, linked public item about an investor |
| **Lead signal** | The investor's highest-value signal in the window; drives *Why now* and the line |
| **Window** | The last 30 days |
| **Fit axes / tags** | Sector, customer, offering, stage (model output) shown as Seed, B2B, Logistics, Software |
| **Relevance** | direct, thematic, adjacent, unrelated (computed from the axes) |
| **Tier** | A–D source reliability, sets base confidence |
| **Corroborated** | Two independent sources report the same thing |
| **Firm fit** | Multiplier from the firm's seed behaviour, thesis and type |
| **Lane** | Message today, Waiting on a reply, Maybe, Parked |
| **POC level** | Point-of-contact seniority: decision-maker, partner, principal, associate |
| **Archived** | Removed from the active list by a swap, kept in the database and reversible |
| **`vc_runtime`** | The app's database login; cannot update or delete investor rows |
| **`[DEMO]`** | Prefix on the fictional founder's own data |
