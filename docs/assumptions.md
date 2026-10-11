# Working Assumptions

The brief leaves these open. They were decided up front so the build doesn't stall; each is stated in the README so graders can see the reasoning.

| # | Question | Assumption | Effect on the build |
|---|---|---|---|
| A1 | Can an AI coding assistant help write the code? | Yes. Claude Code is a development tool only; the deployed app uses **Gemini Flash for every AI task** and contains no Anthropic/OpenAI SDK. | `CLAUDE.md` rule 1 enforces this. README states it plainly. |
| A2 | Where is Vikram based? | **India (Bengaluru)**, raising a seed round for a B2B logistics SaaS serving Indian shippers, carriers and 3PLs. | Watchlist ≈ 35 India-focused seed funds + ≈ 15 global logistics specialists that invest in Indian/emerging-market supply chain. Google News uses the India edition by default (with US edition for global funds). India funding RSS and SEBI AIF checks are first-class sources; SEC Form D applies only to US-domiciled funds. Supabase region: Mumbai. |
| A3 | Vikram's manual columns (notes, contact history, status) | Filled with **clearly labelled sample data** (prefix `[DEMO]`). VC names, firms, identifiers and all signals are real and live. | `scripts/seed-vcs.ts` writes demo values once; the pipeline never touches them. |
| A4 | Components Map format | A component table (name, responsibility, tech, inputs/outputs) **plus** the Mermaid architecture diagram, kept in `docs/components-map.md` and linked from the README. | Generated from the module index and §9 diagram in `docs/signal-sources.md`. |
| A5 | Third-party APIs alongside Gemini | Allowed. Gemini (paid key) does all AI work; free tiers/RSS/public filings supply data. No paid data vendors in v1. | Matches the source list and budget in `docs/signal-sources.md` §10. |
| A6 | Currency / check sizes | Show both INR and USD where available (e.g. "₹8 Cr (~$0.95M)"). | Formatting helper in `lib/format.ts`. |
