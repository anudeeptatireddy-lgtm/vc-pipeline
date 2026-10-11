// Shared types. Column names match supabase/migrations (docs/signal-sources.md §DB).

export type VcStatus = "waiting_for_response" | "yet_to_reach_out";

export interface Vc {
  id: string;
  // Vikram-owned: read-only to the system
  name: string;
  firm: string;
  thesis: string | null;
  status: VcStatus | null;
  last_contact_date: string | null;
  contact_history: string | null;
  personal_notes: string | null;
  // System-owned signal columns (written only via update_vc_signals)
  last_signal_date: string | null;
  signal_summary: string | null;
  follow_up_score: number | null;
  recommended_action: RecommendedAction | null;
  // System-owned identifiers
  linkedin_url: string | null;
  x_user_id: string | null;
  bluesky_handle: string | null;
  youtube_channel_id: string | null;
  rss_url: string | null;
  portfolio_url: string | null;
  team_url: string | null;
  sec_cik: string | null;
  // docs/components-map.md §3.6
  partner_name: string | null;
  priority: string | null;
  region: string | null;
  needs_review: boolean | null;
  // Seeding (migration seed_identifiers)
  seed_key: string | null;
  website: string | null;
  partner_confidence: "high" | "low" | null;
  updated_by_system_at: string | null;
}

export type SourceTier = "A" | "B" | "C" | "D";

export interface RawItem {
  url: string; // may be a redirect; verify.ts resolves it
  title: string;
  snippet?: string;
  publishedAt?: string; // ISO if the source provides it
  source: string; // e.g. "exa"
  sourceTier: SourceTier;
  publisher?: string; // publisher homepage, when the url is an aggregator link
}

export interface SignalSource {
  name: string;
  enabled: (vc: Vc) => boolean;
  fetchForVc?: (vc: Vc, since: Date) => Promise<RawItem[]>;
  fetchBatch?: (since: Date) => Promise<RawItem[]>; // once per run, matched to VCs after
}

// Enums from docs/signal-sources.md §7.1
export const SIGNAL_TYPES = [
  "investment", "writing", "interview", "event", "fund_close", "team_change", "social_post", "other",
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export const ROUND_STAGES = [
  "pre-seed", "seed", "seed-extension", "series-a", "series-b-plus", "debt", "not-a-deal", "unknown",
] as const;
export type RoundStage = (typeof ROUND_STAGES)[number];

export const SECTOR_FITS = ["fit", "partial", "none"] as const;
export type SectorFit = (typeof SECTOR_FITS)[number];

export const CUSTOMER_TYPES = ["b2b", "b2b2c", "b2c", "unknown"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const OFFERING_TYPES = [
  "software", "marketplace", "services", "fintech", "hardware", "asset_heavy", "not_applicable", "unknown",
] as const;
export type OfferingType = (typeof OFFERING_TYPES)[number];

export type LogisticsRelevance = "direct" | "adjacent" | "thematic" | "unrelated";

/** A signal that passed lib/verify.ts: resolved URL, publish date within 30 days. */
export interface VerifiedSignal {
  vc_id: string;
  signal_type: SignalType;
  summary: string;
  source_url: string; // resolved, non-redirect
  source_name: string;
  source_tier: SourceTier;
  published_date: string; // YYYY-MM-DD, computed in code
  evidence_quote: string | null;
  company_name: string | null;
  round_stage: RoundStage;
  sector_fit: SectorFit;
  customer_type: CustomerType;
  offering_type: OfferingType;
  logistics_relevance: LogisticsRelevance; // derived in lib/score.ts
  confidence: number;
  opening_line: string | null;
  nudge_line: string | null;
  corroborated_by: string | null;
}

// docs/components-map.md §3.4: the only valid recommended_action values, shared by score.ts and the UI.
export const RECOMMENDED_ACTIONS = {
  reachOut: "Reach out this week",
  reachOutLower: "Reach out if capacity allows",
  nudge: "Nudge now",
  nudgeLower: "Light nudge",
  hold: "Hold",
  quiet: "Quiet: deprioritize this week",
} as const;
export type RecommendedAction = (typeof RECOMMENDED_ACTIONS)[keyof typeof RECOMMENDED_ACTIONS];

// docs/dashboard-design.md §6: Hold and Quiet both land in "parked".
export type Bucket = "reach_out" | "nudge" | "parked";

export const ACTION_BUCKET: Record<RecommendedAction, Bucket> = {
  [RECOMMENDED_ACTIONS.reachOut]: "reach_out",
  [RECOMMENDED_ACTIONS.reachOutLower]: "reach_out",
  [RECOMMENDED_ACTIONS.nudge]: "nudge",
  [RECOMMENDED_ACTIONS.nudgeLower]: "nudge",
  [RECOMMENDED_ACTIONS.hold]: "parked",
  [RECOMMENDED_ACTIONS.quiet]: "parked",
};
