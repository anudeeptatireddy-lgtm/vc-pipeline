// Server-only database access (Neon, as vc_runtime). The only paths that
// change `vcs` are the two security-definer functions called below, and new
// rows come from seed_new_vcs; the runtime role has no INSERT, UPDATE or DELETE
// on vcs. Every other write is built from the allowlists in lib/ownership.ts.
import { insertFromJsonSql, insertSql, pickColumns, SYSTEM_WRITE_COLUMNS, updateSql, VCS_SEED_COLUMNS } from "./ownership";
import { q } from "./sql";
import type { RecommendedAction, Vc, VerifiedSignal } from "./types";

/** Active VCs only: archived rows are excluded from runs and the dashboard. */
export async function loadVcs(): Promise<Vc[]> {
  return q<Vc>("select * from vcs where not archived order by firm");
}

/** Every row, archived included (seeding, swaps, exports). */
export async function loadAllVcs(): Promise<Vc[]> {
  return q<Vc>("select * from vcs order by firm");
}

export interface VcSignalUpdate {
  lastSignalDate: string | null; // null keeps the previous date (quiet week)
  signalSummary: string;
  followUpScore: number;
  recommendedAction: RecommendedAction;
}

/** The ONLY function that writes signal columns on `vcs`. */
export async function writeVcSignals(vcId: string, u: VcSignalUpdate): Promise<void> {
  try {
    await q("select update_vc_signals($1, $2, $3, $4, $5)", [
      vcId, u.lastSignalDate, u.signalSummary, u.followUpScore, u.recommendedAction,
    ]);
  } catch (e) {
    throw new Error(`update_vc_signals(${vcId}): ${(e as Error).message}`);
  }
}

export interface VcIdentifiers {
  linkedin_url?: string;
  x_user_id?: string;
  bluesky_handle?: string;
  youtube_channel_id?: string;
  rss_url?: string;
  portfolio_url?: string;
  team_url?: string;
  sec_cik?: string;
  website?: string;
  partner_name?: string;
  partner_confidence?: "high" | "low";
  priority?: string;
  region?: string;
  needs_review?: boolean;
  archived?: boolean;
  archived_reason?: string;
}

const IDENTIFIER_KEYS: (keyof VcIdentifiers)[] = [
  "linkedin_url", "x_user_id", "bluesky_handle", "youtube_channel_id", "rss_url", "portfolio_url", "team_url",
  "sec_cik", "website", "partner_name", "partner_confidence", "priority", "region", "needs_review",
  "archived", "archived_reason",
];

/** Seeding only (scripts/seed-vcs.ts). Omitted fields keep their current value. */
export async function writeVcIdentifiers(vcId: string, ids: VcIdentifiers): Promise<void> {
  const keys = IDENTIFIER_KEYS.filter((k) => ids[k] !== undefined && ids[k] !== "");
  const args = keys.map((k, i) => `p_${k} => $${i + 2}`); // keys come from the whitelist above
  try {
    await q(`select update_vc_identifiers(${["p_id => $1", ...args].join(", ")})`, [vcId, ...keys.map((k) => ids[k])]);
  } catch (e) {
    throw new Error(`update_vc_identifiers(${vcId}): ${(e as Error).message}`);
  }
}

export interface NewVcRow {
  seed_key: string;
  name: string;
  firm: string;
  thesis: string | null;
  status: string;
  last_contact_date: string | null;
  contact_history: string | null;
  personal_notes: string;
}

/**
 * Seeding only: creates rows that don't exist yet, through seed_new_vcs (the
 * runtime role has no INSERT on vcs). Existing rows are never touched (on
 * conflict do nothing), so Vikram's columns are written exactly once.
 */
export async function insertNewVcs(rows: NewVcRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const payload = rows.map((r) => Object.fromEntries(VCS_SEED_COLUMNS.map((c) => [c, r[c] ?? null])));
  const [res] = await q<{ n: number }>("select public.seed_new_vcs($1::jsonb) as n", [JSON.stringify(payload)]);
  return res?.n ?? 0;
}

export interface VcProfile {
  vc_id: string;
  does_seed: "leads_seed" | "participates_seed" | "series_a_plus_only" | "unknown";
  b2b_logistics_thesis: "core" | "explicit" | "portfolio_only" | "none";
  investor_type: "seed_fund" | "multi_stage" | "cvc_strategic" | "angel_syndicate" | "accelerator";
  typical_check: string | null;
  geo_focus: string | null;
  evidence_urls: string[];
}

export async function loadVcProfiles(): Promise<VcProfile[]> {
  return q<VcProfile>("select * from vc_profiles");
}

const PROFILE_COLS = ["vc_id", "does_seed", "b2b_logistics_thesis", "investor_type", "typical_check", "geo_focus", "evidence_urls", "profiled_at"] as const;

/** vc_profiles is system-owned; upsert per VC. */
export async function upsertVcProfile(p: VcProfile): Promise<void> {
  await q(insertSql("vc_profiles", PROFILE_COLS, { conflict: ["vc_id"], update: PROFILE_COLS.filter((c) => c !== "vc_id") }), [
    p.vc_id, p.does_seed, p.b2b_logistics_thesis, p.investor_type, p.typical_check, p.geo_focus, p.evidence_urls, new Date().toISOString(),
  ]);
}

export type SignalRow = VerifiedSignal & { signal_value: number; classification_votes?: Record<string, number> };

const SIGNAL_COLS = SYSTEM_WRITE_COLUMNS.signals;

/**
 * Insert new signals; a URL already stored for this VC is left as it is here.
 * Re-classifications of stored pages go through majority voting instead
 * (lib/classify.ts + updateClassification), so one random flip can't swing a score.
 */
export async function insertSignals(rows: SignalRow[]): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map((r) => pickColumns("signals", r as unknown as Record<string, unknown>, SIGNAL_COLS));
  try {
    await q(insertFromJsonSql("signals", SIGNAL_COLS, { conflict: ["vc_id", "source_url"], doNothing: true }), [JSON.stringify(payload)]);
  } catch (e) {
    throw new Error(`insertSignals: ${(e as Error).message}`);
  }
}

export interface StoredClassification {
  source_url: string;
  sector_fit: string;
  customer_type: string;
  offering_type: string;
  round_stage: string;
  classification_votes: Record<string, number>;
}

/** Existing classifications for these URLs (for majority voting). */
export async function loadClassifications(vcId: string, urls: string[]): Promise<StoredClassification[]> {
  if (urls.length === 0) return [];
  return q<StoredClassification>(
    `select source_url, sector_fit, customer_type, offering_type, round_stage, classification_votes
     from signals where vc_id = $1 and source_url = any($2::text[])`,
    [vcId, urls],
  );
}

/** Record a new vote and, if the majority changed, the new classification. */
export async function updateClassification(
  vcId: string,
  sourceUrl: string,
  c: { sector_fit: string; customer_type: string; offering_type: string; round_stage: string; logistics_relevance: string; signal_value: number },
  votes: Record<string, number>,
  changed: boolean,
): Promise<void> {
  if (changed) {
    await q(
      updateSql("signals", ["sector_fit", "customer_type", "offering_type", "round_stage", "logistics_relevance", "signal_value", "classification_votes"], ["vc_id", "source_url"]),
      [c.sector_fit, c.customer_type, c.offering_type, c.round_stage, c.logistics_relevance, c.signal_value, JSON.stringify(votes), vcId, sourceUrl],
    );
  } else {
    await q(updateSql("signals", ["classification_votes"], ["vc_id", "source_url"]), [JSON.stringify(votes), vcId, sourceUrl]);
  }
}

/** Persist §8.2 triangulation results on stored signals (corroboration and confidence only). */
export async function updateCorroboration(
  rows: { vc_id: string; source_url: string; corroborated_by: string | null; confidence: number; signal_value: number }[],
): Promise<void> {
  const sql = updateSql("signals", ["corroborated_by", "confidence", "signal_value"], ["vc_id", "source_url"]);
  for (const r of rows) await q(sql, [r.corroborated_by, r.confidence, r.signal_value, r.vc_id, r.source_url]);
}

/** All stored signals for a VC published on or after `since` (YYYY-MM-DD). */
export async function loadRecentSignals(vcId: string, since: string): Promise<SignalRow[]> {
  return q<SignalRow>("select * from signals where vc_id = $1 and published_date >= $2", [vcId, since]);
}

export interface Snapshot {
  entries: { name: string; domain?: string }[];
  entries_hash: string;
  captured_at: string;
}

/** Most recent snapshots for a VC, oldest → newest. */
export async function loadSnapshots(vcId: string, kind: "portfolio" | "team", limit = 3): Promise<Snapshot[]> {
  const rows = await q<Snapshot>(
    `select entries, entries_hash, captured_at from portfolio_snapshots
     where vc_id = $1 and kind = $2 order by captured_at desc limit $3`,
    [vcId, kind, limit],
  );
  return rows.reverse();
}

export async function insertSnapshot(vcId: string, kind: "portfolio" | "team", entries: Snapshot["entries"], hash: string) {
  await q(insertSql("portfolio_snapshots", ["vc_id", "kind", "entries", "entries_hash"]), [vcId, kind, JSON.stringify(entries), hash]);
}

export async function recordScoreHistory(vcId: string, runId: number, score: number, action: RecommendedAction): Promise<void> {
  await q(insertSql("vc_score_history", ["vc_id", "run_id", "follow_up_score", "recommended_action"]), [vcId, runId, score, action]);
}

export interface RunError {
  vcId?: string;
  source?: string;
  message: string;
}

/** True if another run started in the last 10 minutes and hasn't finished. */
export async function isRunActive(): Promise<boolean> {
  const rows = await q(
    "select 1 from pipeline_runs where finished_at is null and started_at >= now() - interval '10 minutes' limit 1",
  );
  return rows.length > 0;
}

export async function startRun(trigger: "cron" | "manual" | "script"): Promise<number> {
  const [row] = await q<{ id: number }>(insertSql("pipeline_runs", ["trigger"], { returning: "id" }), [trigger]);
  return row!.id;
}

export async function finishRun(
  runId: number,
  result: { vcsProcessed: number; errors: RunError[]; usage: Record<string, unknown> },
): Promise<void> {
  await q(updateSql("pipeline_runs", ["finished_at", "vcs_processed", "errors", "usage"], ["id"]), [
    new Date().toISOString(), result.vcsProcessed, JSON.stringify(result.errors), JSON.stringify(result.usage), runId,
  ]);
}
