# Grading Requirements → Proof → Demo Script

Each requirement from the Problem Statement booklet is paired with the evidence we'll show and the exact step that produces it. Claude Code should build toward these proofs, not just toward the features.

## 1. Requirement-to-proof map

| # | Requirement (from booklet) | Proof we will show | How it is produced | Where it lives |
|---|---|---|---|---|
| R1 | Solution uses **live external data**; works with data at submission time | A pipeline run log listing real source URLs with publish dates within the last 30 days | `pipeline_runs.usage` + `signals` rows with `source_url` and `published_date` | Supabase → `signals`; `/api/run-now` response |
| R2 | **All AI tasks use Gemini Flash**; no Claude API | Code search returns exactly one Gemini entry point and zero Anthropic/OpenAI imports in app code | `lib/gemini.ts` is the only file importing `@google/genai`; a CI check fails on other AI SDK imports | `npm run lint` rule + README |
| R3 | **Deployed on Vercel** with a public URL | Live dashboard URL loads and shows the latest run | Vercel production deployment | Vercel dashboard + URL in README |
| R4 | **GitHub repository link** | Public repo with commit history across all phases | Commits after every build-plan phase | GitHub |
| R5 | **Components Map** submitted | `docs/components-map.md` with table + Mermaid diagram | Generated from module index + §9 diagram | Repo + README link |
| R6 | Twice-weekly scheduled run (implied by brief) | Vercel cron entry in `vercel.json` and a log of at least one cron-triggered run | `pipeline_runs.trigger = 'cron'` | `vercel.json`, Supabase |
| R7 | Supabase table **reflects current state** after each run | Before/after snapshot of `last_signal_date`, `signal_summary`, `follow_up_score`, `recommended_action` | Run pipeline; compare `updated_by_system_at` | Supabase table view |
| R8 | **Must not overwrite manual notes**; only four signal columns updated | Edit `personal_notes` to a marker string → run pipeline → marker unchanged; role-level test shows `permission denied` on protected columns | §DB acceptance SQL | Supabase SQL editor output (screenshot) |
| R9 | Quiet VCs are reported, not silently skipped | Dashboard "Quiet — deprioritize" list contains ≥1 VC with `recommended_action` set and summary explaining no signal | `score.ts` returns "quiet" bucket | Dashboard |
| R10 | Each recommendation says **why** with an observable 30-day signal | Every "reach out" row links ≥1 source URL and a dated one-line summary | `signal_summary` + `signals` join | Dashboard rows |
| R11 | Seed-stage, B2B logistics focus | Dashboard filter/legend shows fit axes; at least one "adjacent" and one "unrelated" example to show the filter works | §4.0 classification stored per signal | Dashboard + `signals` table |
| R12 | Triangulation / verification (high bar in rubric) | At least one signal shown as "upgraded" (D-tier + A/B/C corroboration) and one capped by the conflict rule | `score.ts` writes `corroborated_by` | Dashboard badge + `signals` |

## 2. Pre-demo checklist (run the day before and again the morning of)

- [ ] `vercel --prod` deploys without errors; public URL loads.
- [ ] Cron entry visible in Vercel → Settings → Cron Jobs (production only).
- [ ] `/api/run-now` completes under 280 s and returns counts per source.
- [ ] At least 10 VCs have a "reach out" or "nudge" recommendation with a real, dated source link.
- [ ] At least 3 VCs are "quiet" with explanation text.
- [ ] Manual-columns test passes (see step D4).
- [ ] Gemini budget alert is configured and the usage page shows no runaway calls.
- [ ] `.env` is not committed (`git ls-files | grep .env` returns only `.env.example`).
- [ ] README links: live URL, repo, Components Map, assumptions, and the "why" section.

## 3. Live demo script (about 6 minutes)

**D1 — Problem and promise (30 s).** Open the dashboard. Say: Vikram has 50 VCs; the system tells him who is worth contacting this week and why, from observable activity in the last 30 days.

**D2 — The answer (60 s).** Walk the three lists: *Reach out this week*, *Nudge*, *Quiet*. Pick one "reach out" row and click its source link. Show the publish date is inside 30 days.

**D3 — Live data, live run (90 s).** Click **Run now**. While it runs, explain the tiers: Gemini grounding, Google News RSS, Exa, podcast index, India funding feeds, SEC Form D. When it finishes, show the per-source counts from the run log and one newly added signal.

**D4 — Protection of Vikram's notes (90 s).** This is the strongest proof of judgment:
1. In Supabase, set `personal_notes` on one VC to `DEMO-MARKER-<time>`.
2. Run the SQL test showing the `pipeline_writer` role gets *permission denied* when updating `personal_notes`.
3. Click **Run now** again.
4. Re-read the row: the marker is unchanged, while `signal_summary` and `updated_by_system_at` changed.

**D5 — Fit and judgment (60 s).** Show one *adjacent* signal (consumer delivery) and one *unrelated* signal, each scored lower, with the reason. Then show a verified signal with its date check. Say briefly: the model proposes, the code verifies.

**D6 — Choices and limits (60 s).** From the README "why" section:
- No LinkedIn or Reddit scraping (terms, legal risk, and Reddit's closing API).
- LinkedIn coverage comes through search indexes and a planned capture button.
- Gemini is the only AI; Claude Code was a development tool only.

Close with the Components Map.

## 4. Failure drills (rehearse these)

| Failure | What the demo does |
|---|---|
| A source rate-limits mid-run | Run log shows the error; other sources still produce signals; dashboard shows the last successful run's timestamp. |
| Gemini returns malformed JSON | Zod rejects it; that VC is logged and skipped; the run continues. |
| No new signals this week | Dashboard shows the "quiet" list with the last known signal date, so the page is never empty. |
| Vercel cron didn't fire | Use **Run now**; explain that cron fires only on production and may run a few minutes late on Hobby. |

## 5. Things that must never happen on stage

- Showing `.env` values or the service-role key.
- Showing a signal whose date you didn't check.
- Demoing a run that has never been tested on this deployment.
- Presenting a "reach out" row with no source link.
