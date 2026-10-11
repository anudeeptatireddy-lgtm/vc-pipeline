// Triage rules for the dashboard (docs/dashboard-design.md §3): which lane an
// investor sits in, the four fit tags, the deal facts shown under "Why now",
// and the source count in the status pill. Pure functions, unit-tested.
import type { CustomerType, OfferingType, RoundStage, SectorFit, VcStatus } from "./types";

export type Lane = "today" | "follow" | "maybe" | "parked";
export const LANES: Lane[] = ["today", "follow", "maybe", "parked"];
export const LANE_LABEL: Record<Lane, string> = {
  today: "Message today",
  follow: "Waiting on a reply",
  maybe: "Maybe",
  parked: "Parked",
};

export type Tag = "yes" | "part" | "no";
export interface FitTags {
  seed: Tag;
  b2b: Tag;
  logistics: Tag;
  software: Tag;
}

export interface FitInput {
  sector: SectorFit | string;
  customer: CustomerType | string;
  offering: OfferingType | string;
  stage: RoundStage | string;
}

const SEED = ["pre-seed", "seed", "seed-extension"];

/**
 * Four fit tags from the lead signal. "part" means the signal doesn't say
 * (e.g. an essay has no round) or only partly matches; "no" means it clearly doesn't.
 */
export function fitTags(f: FitInput, firmDoesSeed?: string | null): FitTags {
  const stageKnown = !["not-a-deal", "unknown", "debt"].includes(f.stage);
  const seed: Tag = SEED.includes(f.stage)
    ? "yes"
    : stageKnown
      ? "no"
      : firmDoesSeed === "leads_seed" || firmDoesSeed === "participates_seed"
        ? "part"
        : firmDoesSeed === "series_a_plus_only"
          ? "no"
          : "part";
  const b2b: Tag = f.customer === "b2b" ? "yes" : f.customer === "b2b2c" || f.customer === "unknown" ? "part" : "no";
  const logistics: Tag = f.sector === "fit" ? "yes" : f.sector === "partial" ? "part" : "no";
  const software: Tag = f.offering === "software" ? "yes" : ["marketplace", "fintech", "unknown", "not_applicable"].includes(f.offering) ? "part" : "no";
  return { seed, b2b, logistics, software };
}

/** A row can only ask for a message when B2B and logistics are confirmed and nothing is a clear mismatch. */
export function fitConfirmed(t: FitTags): boolean {
  return t.b2b === "yes" && t.logistics === "yes" && t.software !== "no" && t.seed !== "no";
}

export interface LaneInput {
  score: number;
  status: VcStatus | null;
  hasSignal: boolean;
  tags: FitTags | null;
  /** The pipeline's action (§8.4). "Hold" means you contacted them recently, so no nudge yet. */
  action: string;
}

/**
 * Message today: score >= 60, not already waiting, fit confirmed.
 * Waiting on a reply: the pipeline says nudge (you're waiting, score >= 30, last contact
 *   over 14 days ago or score >= 60) and the fit is confirmed.
 * Maybe: score 30 to 59, or a higher score whose fit isn't confirmed.
 * Parked: everything else.
 */
export function laneOf(r: LaneInput): Lane {
  if (!r.hasSignal || r.score < 30) return "parked";
  const ok = !!r.tags && fitConfirmed(r.tags);
  const waiting = r.status === "waiting_for_response";
  if (waiting && ok && /nudge/i.test(r.action)) return "follow";
  if (!waiting && r.score >= 60 && ok) return "today";
  return "maybe";
}

export interface DealFacts {
  company: string | null;
  round: string | null;
  size: string | null;
  role: string | null;
}

const STAGE_LABEL: Record<string, string> = {
  "pre-seed": "Pre-seed", seed: "Seed", "seed-extension": "Seed extension", "series-a": "Series A", "series-b-plus": "Series B or later", debt: "Debt",
};

/** Deal facts for an investment signal. Size and role are read from the summary text only when it states them. */
export function dealFacts(s: { summary: string; company_name: string | null; round_stage: string }): DealFacts {
  const size = s.summary.match(/(?:US\$|\$|₹|£|€|INR\s?|Rs\.?\s?)\s?[\d,.]+(?:\s?(?:million|mn|m|billion|bn|crore|cr|lakh|k))?\b/i)?.[0]?.replace(/\s+/g, " ") ?? null;
  const t = s.summary.toLowerCase();
  const role = /\bco-?led\b/.test(t)
    ? "Co-led"
    : /\bled\b|\bleads\b|\bleading\b/.test(t)
      ? "Led"
      : /\bparticipat|\bjoined\b|\bbacked\b|\binvested\b|\binvests\b/.test(t)
        ? "Joined"
        : null;
  return { company: s.company_name, round: STAGE_LABEL[s.round_stage] ?? null, size, role };
}

/** Every source the pipeline asks (lib/sources). Used for "Checked N of N sources". */
export const ALL_SOURCES = [
  "batch-feeds", "news-rss", "web-search", "linkedin-index", "firm-rss",
  "youtube", "podcast-index", "sec-form-d", "portfolio-diff", "gemini-grounding",
] as const;

/** Sources that answered in a run: a source counts as missed only when it was skipped for the rest of the run. */
export function sourcesChecked(errors: { source?: string; message: string }[] | null | undefined): { checked: number; total: number; missed: string[] } {
  const missed = [...new Set((errors ?? []).filter((e) => e.source && /skipped for the rest of this run/.test(e.message)).map((e) => e.source!))];
  return { checked: ALL_SOURCES.length - missed.length, total: ALL_SOURCES.length, missed };
}
