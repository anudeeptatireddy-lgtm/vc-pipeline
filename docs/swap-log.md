# VC list swap log (11 Oct 2026)

Rubric-driven swap, applied without an approval gate per the owner's rules. Nothing was deleted: swapped-out rows are **archived** (kept in the database with notes and history, excluded from runs and the dashboard). The 30-day window, off-thesis cap and fit rules were not changed.

## How to undo

```bash
npm run swap:undo
```

That un-archives the rows below, archives the swapped-in rows, and restores `data/vc-seed-list.csv` from the git tag `pre-swap`. A full database copy from before the swap is the Neon branch `pre-swap-backup` (`br-broad-moon-b4l6qz64`).

## The rubric used

No candidate-ranking rubric existed in the docs, so it was derived from the existing scoring rules (`docs/signal-sources.md` §4.3, §4.4, §8.3) and stated here so it can be checked:

- **Hard filters (all required):** a verified, dated B2B logistics/supply-chain **software** round at pre-seed/seed/seed-extension in the last 12 months (fit computed in code: sector fit + B2B + software = direct); the investor **led or co-led** it and is named in the article; **India-accessible** (an India deal in the corpus, or an evidence page that loads and mentions India); not venture-debt-only; not corporate strategic; not already on the list; official website verified by fetching.
- **Score per qualifying deal:** 40 (investment) × 1.5 (direct) × 1.3 (seed) × lead factor (1.0 sole lead, 0.85 co-lead) × recency `exp(-days/180)`. Summed per investor.
- **Corpus:** 64 qualifying deals from 934 articles (Exa, India funding sites first, 12 months, quarterly slices), extracted by Gemini from the article text only, verified in code.

Swap size = min(rows that can't produce reach-out rows by design, qualifying candidates, 15) = **7**. Only 7 candidates passed every filter, so the swap is 7 rows, not 15; the rubric was not lowered to fill slots.

## Rows out (archived)

| Seed key | Firm | Reason |
|---|---|---|
| vc09 | Stride Ventures | venture debt |
| vc41 | A91 Partners | Series A+ only (profile) |
| vc45 | India Quotient | no verified website |
| vc50 | Maersk Growth | no verified website |
| vc25 | Moving Capital | no verified website |
| vc34 | Venture Highway | no verified website |
| vc06 | Enrission India Capital | no verified website |

## Rows in

| Firm | Rubric score | Qualifying deal(s) (role, stage, date) | Evidence |
|---|---|---|---|
| YourNest Venture Capital ([site](https://yournest.in)) | 42.4 | CargoFL: logistics technology platform to optimize freight and supply chain operations (led, seed, 2026-06-24) | [link](https://vctavern.com/cargofl-secures-rs-6-75-cr-in-seed-funding-round-led-by-yournest-venture-capital/) |
| Picus Capital ([site](https://www.picuscap.com)) | 42.4 | Compri: AI-powered procurement software for industrial companies (led, seed, 2026-06-24) | [link](https://seedtable.com/companies/compri/funding-rounds/seed-2026-06) [link](https://dealroom.co/news/135833-compri-raises-3-2m-seed-to-build-ai-powered-procurement-teams/) |
| Chiratae Ventures ([site](https://www.chiratae.com)) | 40.6 | ContraVault AI: AI-powered procurement intelligence and tender bidding software (led, seed-extension, 2026-06-16) | [link](https://inc42.com/buzz/exclusive-ai-startup-contravault-raises-3-1-mn-to-expand-in-the-us/) [link](https://startupbydoc.com/contravault-ai-raises-3-1-million-to-transform-procurement-intelligence/) |
| Turbostart ([site](https://turbostart.co)) | 25.3 | Lawyered: legal infrastructure and proactive compliance platform for mobility and logistics (co-led, seed-extension, 2026-04-21) | [link](https://entrepreneur.economictimes.indiatimes.com/amp/news/funding/lawyered-secures-25-million-pre-series-a-funding-to-revolutionize-legal-solutions-for-indias-mobility-sector/130410540) |
| Wavemaker Partners ([site](https://wavemaker.vc)) | 23.7 | Confluxe: Platform providing market entry strategy, digital commerce, merchandising, and supply chain operations (led, pre-seed, 2026-03-11) | [link](https://yourstory.com/2026/03/former-myntra-hm-executives-launch-retail-tech-platform-confluxe-16-mln-pre-seed-funding) [link](https://entrepreneur.economictimes.indiatimes.com/news/funding/confluxe-secures-16-million-in-pre-seed-funding-from-wavemaker-partners-and-kriscore-capital/129501041) |
| Pentathlon Ventures ([site](https://pentathlon.vc)) | 21.9 | SuperProcure: Unified TMS and freight lifecycle management software (led, pre-seed, 2026-02-25) | [link](https://app.fundz.net/fundings/superprocure-funding-round-85ffce) |
| 100Unicorns ([site](https://100unicorns.in)) | 16 | 1Buy.AI: AI-powered electronics component procurement, bill of materials optimisation, and inventory liquidation (co-led, seed, 2026-01-29) | [link](https://inc42.com/buzz/1buy-ai-nets-inr-33-cr-to-help-enterprises-procure-electronics-components/) [link](https://india.entrepreneur.com/news-and-trends/procurement-platform-1buyai-secures-inr-325-cr-seed/502280) |

## Quiet funds kept on purpose

Real funds with B2B-logistics investments in the last 12 months but nothing on-thesis in the last 30 days, kept so the Quiet bucket is real:

- **Orios Venture Partners**: Real logistics investor (latest: Xindus 2026-08-04; NowPurchase 2026-04-02) but no B2B-logistics signal in the last 30 days
- **Mela Ventures**: Real logistics investor (latest: Tessol 2025-10-27) but no B2B-logistics signal in the last 30 days
- **NB Ventures**: Real logistics investor (latest: Edgistify 2026-01-12) but no B2B-logistics signal in the last 30 days
- **Nexus Venture Partners**: Real logistics investor (latest: Freehand 2026-07-29) but no B2B-logistics signal in the last 30 days
- **Z47 (Matrix Partners India)**: Real logistics investor (latest: Wootzwork 2026-02-26) but no B2B-logistics signal in the last 30 days
- **Inflection Point Ventures**: Real logistics investor (latest: DAAKit 2026-04-09; OORJAA 2026-08-27) but no B2B-logistics signal in the last 30 days

## Flagged but not swapped (no qualifying replacement)

These had no logistics investment found in a 12-month check, but there were no more qualifying candidates. They stay until the next discovery run finds replacements:

- LDV Capital: no logistics activity found in 12 months
- Prologis Ventures: no logistics activity found in 12 months
- pi Ventures: no logistics activity found in 12 months
- Better Capital: no logistics activity found in 12 months
- Elevation Capital: no logistics activity found in 12 months
- Fuel Ventures: no logistics activity found in 12 months
- Kalaari Capital: no logistics activity found in 12 months
- Mu Ventures: no logistics activity found in 12 months
- Overlay Capital: no logistics activity found in 12 months
- Prime Venture Partners: no logistics activity found in 12 months
- Tech Square Ventures: no logistics activity found in 12 months
- Info Edge Ventures: no logistics activity found in 12 months
- Ironspring Ventures: no logistics activity found in 12 months
- LetsVenture: no logistics activity found in 12 months
- Navyug Global: no logistics activity found in 12 months
- Peak XV Partners (Surge): no logistics activity found in 12 months
- Stellaris Venture Partners: no logistics activity found in 12 months

## Near misses (in `suggested_vcs`, shown under "Not on your list yet")

- **Vehra Ventures Private Limited** (score 73.5): no verified website
- **HighLeaf Consulting LLP** (score 55.4): no verified website
- **Emerge Venture Partners LLP** (score 102.5): not India-accessible (no India deal or verifiable India mandate)
- **Plus Partners** (score 73.1): not India-accessible (no India deal or verifiable India mandate)
- **Corazon Capital** (score 67.7): not India-accessible (no India deal or verifiable India mandate)
- **UP.Partners** (score 65.1): not India-accessible (no India deal or verifiable India mandate)
- **Speedinvest** (score 42.2): not India-accessible (no India deal or verifiable India mandate)
- **Alchemist Accelerator** (score 64.4): not India-accessible (no India deal or verifiable India mandate)

## What I'm unsure about

- **The 12-month activity check can miss deals.** One Exa search per fund plus Gemini reading the results. A "none" result is a search miss as often as true inactivity, which is why those 17 funds were *not* archived.
- **Some swap-in deals are at the edge of "logistics software".** Compri (industrial procurement), ContraVault AI (procurement intelligence), 1Buy.AI (electronics component procurement), Lawyered (compliance for fleets) and Confluxe (market-entry platform) passed the fit test in code from Gemini's axes, but a human might call some of them adjacent.
- **Turbostart's only qualifying deal may not be seed.** The Lawyered headline says "pre-Series A"; Gemini extracted "seed-extension". If the headline is right, Turbostart fails the stage filter and should be swapped back out (`npm run swap:undo`, then remove it from `data/swap-plan.json` and re-apply).
- **Wavemaker Partners' profile says Southeast Asia and US.** It passed the India filter on its Confluxe deal; its India mandate is thin.
- **Enrission India Capital was archived for "no verified website" although it has logistics deals** (Hexalog, StackBOX). It's a rule outcome; un-archive it if a website is found.
- **Vehra Ventures and HighLeaf** led India logistics seed rounds (QuikApp, FreightFox) but have no verifiable website, so they're suggestions, not list rows.

## Files

- `data/reverse-lookup.json`: every qualifying deal and ranked investor
- `data/candidates.json`: hard-filter results per candidate
- `data/swap-out-check.json`: 12-month logistics activity per listed fund
- `data/swap-plan.json`: the exact swap applied
- `data/vc-list-export.xlsx`: active and archived lists
