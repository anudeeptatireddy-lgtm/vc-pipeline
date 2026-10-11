// Fit, scoring and recommended action: the single place for these rules
// (CLAUDE.md rule 7; docs/signal-sources.md §4.3–§4.5, §8.3, §8.4).
import type { VcProfile } from "./db";
import {
  RECOMMENDED_ACTIONS,
  type CustomerType,
  type LogisticsRelevance,
  type OfferingType,
  type RecommendedAction,
  type RoundStage,
  type SectorFit,
  type SignalType,
  type VcStatus,
} from "./types";

// ---------- §4.3 relevance ----------

type Axis = "fit" | "partial" | "none" | "unknown";

function customerAxis(c: CustomerType): Axis {
  return c === "b2b" ? "fit" : c === "b2b2c" ? "partial" : c === "b2c" ? "none" : "unknown";
}

function offeringAxis(o: OfferingType): Axis {
  if (o === "software") return "fit";
  if (o === "marketplace" || o === "services" || o === "fintech") return "partial";
  if (o === "hardware" || o === "asset_heavy") return "none";
  return "unknown"; // unknown, not_applicable
}

export function logisticsRelevance(sector: SectorFit, customer: CustomerType, offering: OfferingType): LogisticsRelevance {
  const c = customerAxis(customer);
  const o = offeringAxis(offering);
  if (sector === "fit") {
    if (c === "none" || o === "none") return "adjacent";
    if (c === "fit" && o === "fit") return "direct";
    // One axis partial, or one axis unknown with the other a clear fit.
    if ((c === "fit" || c === "partial") && (o === "fit" || o === "partial")) return "thematic";
    if ((c === "fit" && o === "unknown") || (c === "unknown" && o === "fit")) return "thematic";
    return "adjacent";
  }
  if (sector === "partial") return c === "fit" && o === "fit" ? "adjacent" : "unrelated";
  return "unrelated";
}

export const RELEVANCE_MULT: Record<LogisticsRelevance, number> = {
  direct: 1.5,
  thematic: 1.2,
  adjacent: 0.6,
  unrelated: 0.15,
};

// ---------- §4.4 stage ----------

export function stageMultiplier(stage: RoundStage): number {
  switch (stage) {
    case "pre-seed":
    case "seed":
    case "seed-extension":
      return 1.3;
    case "series-a":
      return 1.0;
    case "series-b-plus":
    case "debt":
      return 0.5;
    default:
      return 1.0; // unknown, not-a-deal
  }
}

// ---------- §4.5 firm fit ----------

const DOES_SEED: Record<VcProfile["does_seed"], number> = {
  leads_seed: 1.15, participates_seed: 1.0, series_a_plus_only: 0.5, unknown: 0.9,
};
const THESIS: Record<VcProfile["b2b_logistics_thesis"], number> = {
  core: 1.2, explicit: 1.1, portfolio_only: 1.0, none: 0.7,
};
const INVESTOR_TYPE: Record<VcProfile["investor_type"], number> = {
  seed_fund: 1.0, multi_stage: 0.9, cvc_strategic: 0.6, angel_syndicate: 0.9, accelerator: 1.0,
};

export function firmFit(p: Pick<VcProfile, "does_seed" | "b2b_logistics_thesis" | "investor_type"> | null): number {
  if (!p) return DOES_SEED.unknown;
  return DOES_SEED[p.does_seed] * THESIS[p.b2b_logistics_thesis] * INVESTOR_TYPE[p.investor_type];
}

// ---------- §8.3 score ----------

export const TYPE_WEIGHT: Record<SignalType, number> = {
  investment: 40, fund_close: 35, writing: 25, interview: 22, event: 18, team_change: 15, social_post: 12, other: 10,
};

export interface ScorableSignal {
  signal_type: SignalType;
  logistics_relevance: LogisticsRelevance;
  round_stage: RoundStage;
  confidence: number;
  published_date: string; // YYYY-MM-DD
  source_name: string;
  company_name: string | null;
  summary: string;
  corroborated_by: string | null;
}

export function daysAgo(date: string, today: Date): number {
  const d = Date.parse(`${date}T00:00:00Z`);
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.max(0, Math.round((t - d) / 86_400_000));
}

export function signalValue(s: ScorableSignal, today: Date): number {
  return (
    TYPE_WEIGHT[s.signal_type] *
    RELEVANCE_MULT[s.logistics_relevance] *
    stageMultiplier(s.round_stage) *
    s.confidence *
    Math.exp(-daysAgo(s.published_date, today) / 14)
  );
}

/** ≥2 independent sources agree: the same company (or a corroboration link) from two different sources. */
export function sourcesAgree(signals: ScorableSignal[]): boolean {
  if (signals.some((s) => s.corroborated_by)) return true;
  const byCompany = new Map<string, Set<string>>();
  for (const s of signals) {
    if (!s.company_name) continue;
    const k = s.company_name.trim().toLowerCase();
    const set = byCompany.get(k) ?? new Set<string>();
    set.add(s.source_name);
    byCompany.set(k, set);
  }
  return [...byCompany.values()].some((set) => set.size >= 2);
}

export const OFF_THESIS_CAP = 45;

export function followUpScore(signals: ScorableSignal[], fit: number, today: Date): number {
  if (signals.length === 0) return 0;
  const values = signals.map((s) => signalValue(s, today)).sort((a, b) => b - a);
  const raw = values.slice(0, 3).reduce((a, b) => a + b, 0) + (sourcesAgree(signals) ? 10 : 0);
  let score = Math.min(100, Math.round(raw * fit));
  const onThesis = signals.some((s) => s.logistics_relevance === "direct" || s.logistics_relevance === "thematic");
  if (!onThesis) score = Math.min(score, OFF_THESIS_CAP);
  return score;
}

// ---------- §8.4 action ----------

export function recommendedAction(
  score: number,
  status: VcStatus | null,
  lastContactDate: string | null,
  today: Date,
): RecommendedAction {
  const waiting = status === "waiting_for_response";
  if (score >= 60) return waiting ? RECOMMENDED_ACTIONS.nudge : RECOMMENDED_ACTIONS.reachOut;
  if (score >= 30) {
    if (!waiting) return RECOMMENDED_ACTIONS.reachOutLower;
    const stale = !lastContactDate || daysAgo(lastContactDate, today) > 14;
    return stale ? RECOMMENDED_ACTIONS.nudgeLower : RECOMMENDED_ACTIONS.hold;
  }
  return waiting ? RECOMMENDED_ACTIONS.hold : RECOMMENDED_ACTIONS.quiet;
}

// ---------- summary ----------

function ago(n: number): string {
  return n === 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`;
}

/** Leads with the best direct/thematic signal (§8.4). */
export function signalSummary(signals: ScorableSignal[], today: Date): string {
  if (signals.length === 0) return "No public activity found in the last 30 days";
  const ranked = [...signals].sort((a, b) => signalValue(b, today) - signalValue(a, today));
  const best = ranked.find((s) => s.logistics_relevance === "direct" || s.logistics_relevance === "thematic");
  const strip = (t: string) => t.replace(/[.\s]+$/, "");
  if (best) return `${strip(best.summary)}, ${ago(daysAgo(best.published_date, today))}`;
  const latest = [...signals].sort((a, b) => b.published_date.localeCompare(a.published_date))[0]!;
  return `Active, but no B2B logistics signal (last: ${strip(latest.summary)}, ${ago(daysAgo(latest.published_date, today))})`;
}
