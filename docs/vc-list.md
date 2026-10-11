# The 50-VC Seed List

File: `data/vc-seed-list.csv` (50 rows). Built from sources read on 11 Oct 2026. It is a **starting list for the seed script to verify and enrich**, not a final truth.

## Mix

| Group | Count | Purpose in the demo |
|---|---|---|
| India (Bengaluru founder, see `assumptions.md` A2) | 31 | Majority, matches Indian funding feeds and SEBI checks |
| Global supply-chain/logistics funds | 19 | Strongest thesis fit; many have podcasts, newsletters, portfolio pages |
| **P1** — direct B2B-logistics seed evidence or dedicated fund | 15 | Expected to produce most "reach out this week" results |
| **P2** — B2B SaaS seed funds, plausible fit | 21 | Mid-scores; show the fit filter working |
| **P3** — context, thematic or off-thesis | 14 | Expected to show up as quiet or adjacent; proves the system doesn't just flag everything |

## What the list does and doesn't contain

- **Evidence per row.** `inclusion_evidence` and `evidence_source` say why each fund is there. Rows built on a single secondary source say so (e.g. Stellaris, Orios, Z47). Treat those as "verify on the firm's own site".
- **Partner names.** Only three are filled (Santosh Sankar, Julian Counihan, Zach Fredericks), because they appeared in sources I read. The rest are blank on purpose; the seed script resolves them (see below). Do not invent names.
- **Websites.** `website_verified = yes` means the domain appeared in a source I read. It does **not** mean it was fetched. Every domain, including the verified ones, must be fetched by the seed script before use. Blank means unknown.
- **Fit flags to confirm.** Stride Ventures looks like a venture-debt fund; Ironspring's seed activity is disputed; A91 appears only as a Series B lead; Edgistify, Hexalog and TOCAL (the companies behind NB Ventures, Enrission and Navyug rows) need a B2B-software check.
- **Missing on purpose.** No LinkedIn-sourced investor lists and no paid databases.

## What `scripts/seed-vcs.ts` must do with this file

1. Read the CSV; upsert firms into `vcs` (system-owned identifier columns only; Vikram's columns get `[DEMO]` sample values).
2. For each row with a blank or unverified `website`: run Exa search + Gemini URL context to find the official site; **fetch it and confirm it returns the firm**; otherwise mark the row `needs_review`.
3. Resolve `partner_name`: Exa `category: "people"` + the firm's `/team` page. Pick the partner whose profile mentions B2B software, supply chain, or logistics; if nothing fits, use the managing partner and set `partner_confidence = low`.
4. Find `portfolio_url`, `team_url`, `rss_url`, `linkedin_url`, and `sec_cik` for US firms.
5. Run `scripts/profile-vcs.ts` (build-plan Phase 2) to fill `vc_profiles`; recompute `does_seed` and `b2b_logistics_thesis` from the firm's own site.
6. Print a report: rows resolved, rows needing review, rows dropped (`series_a_plus_only`, or no B2B/logistics evidence).

Acceptance (from the build plan): at least 35 of 50 end with seed fit confirmed; at least 30 have two or more identifiers.

## Before submission, re-check

- Quiet vs. active mix: 10–15 P1/P2 funds with real activity in the 30 days before the demo, plus a few clearly quiet ones. Re-run the pipeline daily in the last week.
- Replace any row whose firm turned out inactive, with the next candidates from Signal NFX's supply-chain seed list or recent logistics seed rounds.
