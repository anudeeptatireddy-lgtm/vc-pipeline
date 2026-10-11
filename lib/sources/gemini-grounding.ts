// Gemini grounding + URL context + structured output (docs/signal-sources.md
// §1.1, §7.1, §7.2; opening/nudge rules from docs/dashboard-design.md §7).
// Classifies the collected items and searches for anything they missed.
import { z } from "zod";
import type { VcProfile } from "../db";
import { geminiJson } from "../gemini";
import {
  CUSTOMER_TYPES, OFFERING_TYPES, ROUND_STAGES, SECTOR_FITS, SIGNAL_TYPES, type RawItem, type Vc,
} from "../types";

export const ModelSignal = z.object({
  signal_type: z.enum(SIGNAL_TYPES),
  title: z.string().optional(),
  summary_one_line: z.string(),
  source_url: z.string(),
  published_date: z.string().optional().describe("YYYY-MM-DD as stated on the page; empty if unknown"),
  evidence_quote: z.string().optional().describe("<=25 words copied from the page proving the claim"),
  company_name: z.string().optional(),
  round_stage: z.enum(ROUND_STAGES),
  sector_fit: z.enum(SECTOR_FITS),
  customer_type: z.enum(CUSTOMER_TYPES),
  offering_type: z.enum(OFFERING_TYPES),
  check_size: z.string().optional(),
  opening_line: z.string().optional().describe("<=30 words, only facts from the evidence; empty unless direct or thematic"),
  nudge_line: z.string().optional().describe("<=30 words follow-up referencing the new signal; empty unless direct or thematic"),
  confidence: z.number().min(0).max(1),
});
export type ModelSignal = z.infer<typeof ModelSignal>;

export const Extraction = z.object({
  vc_id: z.string(),
  is_same_person_or_firm: z.boolean(),
  signals: z.array(ModelSignal),
});

const LOGISTICS = /logistic|freight|supply.?chain|shipp|carrier|3pl|warehouse|fleet|truck|cargo|trucking|last.?mile|ftl|ltl|tms|wms|procure|customs|forwarder|fulfil/i;

/** Cheap pre-filter: keep items that name the VC or touch logistics; cap the prompt size. */
export function preFilter(items: RawItem[], vc: Vc, max = 25): RawItem[] {
  const firmWord = vc.firm.replace(/\(.*?\)/g, "").split(/\s+/)[0]!.toLowerCase();
  const surname = vc.partner_name?.split(/\s+/).pop()?.toLowerCase();
  const score = (i: RawItem) => {
    const t = `${i.title} ${i.snippet ?? ""}`.toLowerCase();
    return (t.includes(firmWord) ? 2 : 0) + (surname && t.includes(surname) ? 2 : 0) + (LOGISTICS.test(t) ? 1 : 0);
  };
  return items
    .map((i) => ({ i, s: score(i) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map((x) => x.i);
}

export function buildPrompt(vc: Vc, profile: VcProfile | null, items: RawItem[], today: Date): string {
  const list = items
    .map(
      (it, n) =>
        `${n + 1}. ${it.title}\n   url: ${it.url}\n   date: ${it.publishedAt ?? "unknown"}\n   snippet: ${(it.snippet ?? "").replace(/\s+/g, " ").slice(0, 300)}`,
    )
    .join("\n");
  const partner = vc.partner_name ?? "(unknown partner)";
  return `You are a research analyst for a founder raising a SEED round for a B2B logistics SaaS in India.

FOUNDER CONTEXT
- B2B logistics SaaS (software for shippers, carriers, 3PLs), raising Seed. Most valuable: evidence this investor is actively
  backing or thinking about B2B logistics SOFTWARE at pre-seed/seed.
- Still report unrelated activity (it shows the investor is active), but classify it honestly.

INVESTOR
- vc_id: ${vc.id}
- Partner: ${partner}
- Firm: ${vc.firm}
- Known profile URLs: ${[vc.website, vc.linkedin_url, vc.rss_url].filter(Boolean).join(" ") || "none"}
- Stated thesis: ${profile ? `${profile.b2b_logistics_thesis} logistics thesis; ${profile.does_seed}; ${profile.geo_focus ?? ""}` : vc.thesis ?? "unknown"}

CANDIDATE ITEMS (already collected from search, feeds and filings)
${list || "(none)"}

TASK
1. Use Google Search and URL context to find anything else from the LAST 30 DAYS
   (today is ${today.toISOString().slice(0, 10)}) by this partner or firm. Run 2–3 focused searches, for example:
   - "${partner}" "${vc.firm}" (logistics OR freight OR "supply chain") (SaaS OR software)
   - "${vc.firm}" (seed OR pre-seed) (logistics OR freight OR "supply chain") software
   - "${vc.firm}" invests OR leads OR "fund" (last 30 days)
2. For each item, confirm it is about THIS partner/firm (not a namesake). Set is_same_person_or_firm accordingly.
3. For each signal, classify separately:
   sector_fit: fit = logistics/freight/supply-chain operations;
               partial = manufacturing, mobility, industrial, general B2B SaaS; none = other
   customer_type: b2b = sells to shippers, carriers, brokers, 3PLs, forwarders, fleets,
                  warehouses or enterprise ops teams; b2c = sells to consumers
                  (delivery apps, quick commerce, ride-hailing, e-bike rental)
   offering_type: software = SaaS/data/AI tools; hardware = drones, robots, vehicles,
                  devices; asset_heavy = owns fleets/warehouses; marketplace/services/fintech
                  as named; not_applicable for essays/podcasts/events without a company
   round_stage: the stage of the deal mentioned; "not-a-deal" for essays, talks, posts
   An essay or talk about B2B logistics software counts as sector_fit=fit,
   customer_type=b2b, offering_type=software.
4. Copy a short evidence quote from the source.
5. Only for signals that are about B2B logistics (sector_fit=fit), write:
   opening_line: max 30 words, first person from the founder ("I", not "we"). Reference the signal, then one clause on
     why a B2B logistics SaaS at seed fits it. No ask for a meeting.
   nudge_line: max 30 words. Acknowledge the earlier message, reference the new signal, no guilt or pressure.
   Mention only facts stated in the evidence. Never invent a shared connection, a compliment about taste, or a claim
   about the investor's intentions. No exclamation marks, no flattery, no filler. Otherwise leave both empty.

RULES
- Only include items with a real source URL. Prefer the original article URL over aggregator links.
- If you cannot find a publish date on the page, leave published_date empty. Do not guess.
- If nothing qualifies, return an empty signals array. That is a valid, useful answer.
- Output JSON only, matching the schema.`;
}

export async function extractSignals(vc: Vc, profile: VcProfile | null, items: RawItem[], today: Date, timeoutMs = 110_000) {
  const { data } = await geminiJson(buildPrompt(vc, profile, preFilter(items, vc), today), Extraction, {
    search: true,
    urlContext: true,
    timeoutMs,
  });
  return data;
}
