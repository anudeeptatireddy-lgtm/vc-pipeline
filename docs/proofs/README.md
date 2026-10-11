# Submission proofs

Generated 2026-10-11T16:14:44.093Z by `npm run proofs` against the live Neon database. Each section maps to a row of `docs/demo-script.md` §1.

## R1. Live external data

Latest full run: **#15** (2026-10-11T16:06:27.661Z, 50 VCs, trigger `script`). Per-source raw item counts:
```json
{
  "inc42": 2,
  "youtube": 7,
  "firm-rss": 24,
  "news-rss": 62,
  "sec-form-d": 2,
  "web-search": 196,
  "linkedin-index": 110,
  "portfolio-diff": 0,
  "gemini-grounding": 70
}
```
Ten most recent stored signals (every one has a resolved URL and a publish date inside the 30-day window):
| firm | date | source | tier | url |
|---|---|---|---|---|
| Peak XV Partners (Surge) | 2026-10-11 | news-rss | C | https://www.moneycontrol.com/news/business/ipo/peak-xv-partners-lightspeed-accel-backed-zetwerk-to-launch-ipo-on-october-15-fresh-issue-pegged-at-rs-2-830-crore-14049483.html |
| Elevation Capital | 2026-10-11 | youtube | B | https://www.youtube.com/watch?v=IY-nNDeyW6E |
| Stellaris Venture Partners | 2026-10-10 | gemini-grounding | C | https://indianstartupnews.com/funding/consumer-electronics-brand-lumio-raises-12-million-in-series-a-funding-led-by-blume-ventures |
| Dynamo Ventures | 2026-10-10 | gemini-grounding | C | https://www.santoshsankar.com/the-consumerization-of-ai/ |
| Peak XV Partners (Surge) | 2026-10-10 | linkedin-index | D | https://www.linkedin.com/posts/cnbc-tv18_youngturksreloaded-liftoffnation-rajananandan-activity-7514556212420726784-L6wY |
| Peak XV Partners (Surge) | 2026-10-10 | youtube | B | https://www.youtube.com/watch?v=oPgyVaiDUIY |
| Peak XV Partners (Surge) | 2026-10-10 | youtube | B | https://www.youtube.com/watch?v=a6XsNFt_Wc8 |
| Peak XV Partners (Surge) | 2026-10-10 | youtube | B | https://www.youtube.com/watch?v=O7dw6IV_buA |
| Better Capital | 2026-10-10 | exa | C | https://yespress.io/vaibhav-domkundwar |
| Eclipse Ventures | 2026-10-09 | exa | C | https://www.prnewswire.com/news-releases/oxide-raises-445m-series-d-as-the-company-proves-vision-of-full-stack-cloud-infrastructure-enterprises-can-own-302903159.html |

## R2. All AI is Gemini Flash; no Claude/OpenAI SDK in app code

Files importing `@google/genai`: `lib/gemini.ts`, `scripts/proofs.ts`. Files importing Anthropic/OpenAI SDKs: **0**. ESLint enforces this (`no-restricted-imports` in `eslint.config.mjs`). Model: `gemini-3.7-flash`.

## R3. Deployed on Vercel

https://vc-pipeline-lovat.vercel.app → HTTP 200. Headline: _Five investors are worth a message this week_. Screenshots and Lighthouse: `docs/proofs/ui/`.

## R4. GitHub repository

https://github.com/anudeeptatireddy-lgtm/vc-pipeline (commits after every build-plan phase: `git log --oneline`). Public.
```
3d15b3a Circuit breaker, Gemini items-only fallback, Components Map, UI checks
fb04ef9 Cut Exa to fallback-only; Neon only; no-passcode Run now; fixes
8e09379 Rubric-driven VC swap: 7 out (archived), 7 in; discovery and swap tooling
56a6ef6 Step 0 diagnosis: per-source funnel, per-VC reasons, five pipeline fixes
76b52a8 Note that the over-privileged vc_app role was deleted
c390461 Move the app's database from Supabase to Neon
8f5a2f1 README: deployment and keep-alive notes
c63c8f5 Daily Supabase keep-alive
6f742a7 Run functions in bom1 (Mumbai), next to the Supabase project
88c0776 Phase 7: dashboard
827016e Phase 6: full run, cron auth, triangulation (+ dashboard work in progress)
48ae2ee Phase 5: portfolio page diffing
35e5be5 Phases 3-4: vertical slice and core sources
f58aee1 Phase 2: seed 50 VCs, resolve identifiers, profile firm fit
06e0fa1 Phase 1: Supabase schema, protected write RPCs, read-model views, lib/db.ts
```

## R5. Components Map

`docs/components-map.md` (tables + Mermaid) and `docs/components-map.png`.

## R6. Twice-weekly scheduled run

`vercel.json` crons: `/api/run-pipeline` at `30 2 * * 1,4` (Mon and Thu 08:00 IST) and `/api/keepalive` daily. Cron-triggered runs logged:
_(none)_
_No cron run yet: the first one is scheduled for Mon 12 Oct 2026 08:00 IST. Re-run `npm run proofs` after it._

## R7. Database reflects current state after each run (before/after)

Before (run #16):
| firm | last_signal_date | score | action | summary | updated_by_system_at |
|---|---|---|---|---|---|
| 8VC | 2026-10-08 | 59 | Light nudge | Gallatin AI, an AI-native military logistics software company co-found | 2026-10-11T16:08:32.013Z |
| Blume Ventures | 2026-10-08 | 58 | Reach out if capacity allows | Blume Ventures published a case study detailing how portfolio company  | 2026-10-11T16:07:19.183Z |
| Dynamo Ventures | 2026-10-10 | 55 | Reach out if capacity allows | Dynamo Ventures analyzed Amazon contracting long-term warehousing and  | 2026-10-11T16:08:34.856Z |
After:
| firm | last_signal_date | score | action | summary | updated_by_system_at |
|---|---|---|---|---|---|
| 8VC | 2026-10-08 | 59 | Light nudge | Gallatin AI, an AI-native military logistics software company co-found | 2026-10-11T16:15:46.980Z |
| Blume Ventures | 2026-10-08 | 58 | Reach out if capacity allows | Blume Ventures published a case study detailing how portfolio company  | 2026-10-11T16:15:51.213Z |
| Dynamo Ventures | 2026-10-10 | 55 | Reach out if capacity allows | Dynamo Ventures analyzed Amazon contracting long-term warehousing and  | 2026-10-11T16:17:05.227Z |

## R8. Vikram's manual columns are never overwritten

| check | result |
|---|---|
| App role (vc_runtime): UPDATE personal_notes | denied: permission denied for table vcs |
| App role (vc_runtime): UPDATE follow_up_score directly | denied: permission denied for table vcs |
| App role (vc_runtime): DELETE a VC | denied: permission denied for table vcs |
| Function owner (pipeline_writer): UPDATE personal_notes | denied: permission denied for table vcs |
Also: `npm run check:manual` snapshots every manual column on all rows, runs the pipeline, and compares (last result: PASS).

## R9. Quiet VCs are reported, not skipped

| firm | score | action | summary |
|---|---|---|---|
| 100Unicorns | 13 | Quiet: deprioritize this week | Active, but no B2B logistics signal (last: A social post highlighted Dr Apoorva  |
| 100X.VC | 1 | Quiet: deprioritize this week | Active, but no B2B logistics signal (last: An investor guide outlines 100X.VC's  |
| Ankur Capital | 2 | Quiet: deprioritize this week | Active, but no B2B logistics signal (last: A third-party profile outlining Ankur |
| Antler India | 7 | Quiet: deprioritize this week | Profile highlighting Antler-backed Steadi, an AI platform addressing freight spe |
| Eclipse Ventures | 21 | Quiet: deprioritize this week | Active, but no B2B logistics signal (last: Lior Susan discusses why robotics, AI |
| Info Edge Ventures | 12 | Quiet: deprioritize this week | Active, but no B2B logistics signal (last: Biographical video feature covering I |
| LDV Capital | 1 | Quiet: deprioritize this week | Active, but no B2B logistics signal (last: OpenAI reportedly acquired LDV Capita |
| Lightspeed India | 26 | Quiet: deprioritize this week | Active, but no B2B logistics signal (last: Lightspeed India co-led an INR 36 cro |

## R10. Every recommendation says why, with a 30-day source

| firm | action | date | url |
|---|---|---|---|
| Primary Venture Partners | Nudge now | 2026-10-05 | https://www.trysignalbase.com/news/funding/lantern-secures-7m-seed-funding |
| 8VC | Light nudge | 2026-10-08 | https://www.axios.com/2026/10/08/gallatin-seriesa-8vc-contested-logistics-army |
| Blume Ventures | Reach out if capacity allows | 2026-10-07 | https://blume.vc/commentaries/how-procol-took-procurement-from-whatsapp-to-ai-agents |
| Dynamo Ventures | Reach out if capacity allows | 2026-09-28 | https://dynamo.substack.com/p/dynamo-dispatch-20260928 |
| Elevation Capital | Light nudge | 2026-10-11 | https://www.youtube.com/watch?v=IY-nNDeyW6E |
| Fuel Ventures | Reach out if capacity allows | 2026-10-08 | https://www.uktechnews.info/2026/10/07/meetdoris-t-a-doris-secures-454287-in-pre-seed-funding-led-by-fuel-ventures-and-manchester-angels |
| Better Capital | Reach out if capacity allows | 2026-09-30 | https://www.bettercapital.vc |
| Inflection Point Ventures | Reach out if capacity allows | 2026-10-01 | https://entrepreneur.economictimes.indiatimes.com/news/funding/zaperon-raises-7-crore-seed-round-led-by-inflection-point-ventures/134613468 |
Live link check from `npm run ui:check`: Blume Ventures 200, Dynamo Ventures 200, Fuel Ventures 200, Primary Venture Partners 200, 8VC 403, Elevation Capital 200 (403 = the site blocks bots; opens in a browser).

## R11. Seed-stage B2B logistics focus (direct / adjacent / unrelated)

| relevance | firm | sector_fit | customer_type | offering_type | round_stage | summary |
|---|---|---|---|---|---|---|
| adjacent | Elevation Capital | partial | b2b | software | not-a-deal | Elevation Capital partners examined the impact of improving open-weigh |
| direct | 8VC | fit | b2b | software | series-a | Gallatin AI, an AI-native military logistics software company co-found |
| thematic | Navyug Global | fit | b2b | not_applicable | not-a-deal | Nikhil Chandan shared insights on how logistics, air freight, and ocea |
| unrelated | Peak XV Partners (Surge) | partial | b2b | marketplace | not-a-deal | Peak XV portfolio company Zetwerk announced the launch of its initial  |

## R12. Triangulation

| firm | source_name | tier | corroborated_by | confidence | summary |
|---|---|---|---|---|---|
| Inflection Point Ventures | exa | D | youtube | 0.85 | Inflection Point Ventures co-founder Ankur Mittal discussed angel inve |
| Orios Venture Partners | gemini-grounding | C | exa | 0.731 | Rehan Yar Khan represented Orios Venture Partners as a featured speake |
| Accel India | youtube | B | exa | 0.829 | Subrata Mitra discussed Accel's recent IPO exits and expanded interest |
| Inflection Point Ventures | youtube | B | exa | 0.829 | Accenture Associate Director Utkarsh Jain shares his angel investment  |
| Accel India | exa | B | youtube | 0.829 | Subrata Mitra published a note reflecting on portfolio company Moneyvi |
Upgrades (tier D confirmed by another source → B-level confidence 0.85) appear above. Conflict caps in live data: **0**. The cap rule is covered by `tests/triangulate.test.ts` ("caps an uncorroborated social 'investment' missing from a twice-snapshotted portfolio"); no live case has occurred yet, and none was fabricated.
