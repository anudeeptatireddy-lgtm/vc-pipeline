// Server-only database access (Neon, as vc_runtime). The only paths that
// change `vcs` are the two security-definer functions called below; the
// runtime role has no UPDATE or DELETE on vcs, so a direct write would fail
// (tests/db-guard.test.ts also rejects one in code).
import { q } from "./sql";
import type { RecommendedAction, Vc, VerifiedSignal } from "./types";

export async function loadVcs(): Promise<Vc[]> {
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
}

const IDENTIFIER_KEYS: (keyof VcIdentifiers)[] = [
  "linkedin_url", "x_user_id", "bluesky_handle", "youtube_channel_id", "rss_url", "portfolio_url", "team_url",
  "sec_cik", "website", "partner_name", "partner_confidence", "priority", "region", "needs_review",
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
 * Seeding only: creates rows that don't exist yet. Existing rows are never
 * touched (on conflict do nothing), so Vikram's columns are written exactly once.
 */
export async function insertNewVcs(rows: NewVcRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const inserted = await q(
    `insert into vcs (seed_key, name, firm, thesis, status, last_contact_date, contact_history, personal_notes)
     select seed_key, name, firm, thesis, status, last_contact_date, contact_history, personal_notes
     from jsonb_populate_recordset(null::vcs, $1::jsonb)
     on conflict (seed_key) do nothing
     returning id`,
    [JSON.stringify(rows)],
  );
  return inserted.length;
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

/** vc_profiles is system-owned; upsert per VC. */
export async function upsertVcProfile(p: VcProfile): Promise<void> {
  await q(
    `insert into vc_profiles (vc_id, does_seed, b2b_logistics_thesis, investor_type, typical_check, geo_focus, evidence_urls, profiled_at)
     values ($1, $2, $3, $4, $5, $6, $7, now())
     on conflict (vc_id) do update set
       does_seed = excluded.does_seed, b2b_logistics_thesis = excluded.b2b_logistics_thesis,
       investor_type = excluded.investor_type, typical_check = excluded.typical_check,
       geo_focus = excluded.geo_focus, evidence_urls = excluded.evidence_urls, profiled_at = now()`,
    [p.vc_id, p.does_seed, p.b2b_logistics_thesis, p.investor_type, p.typical_check, p.geo_focus, p.evidence_urls],
  );
}

export type SignalRow = VerifiedSignal & { signal_value: number };

const SIGNAL_COLS = [
  "vc_id", "signal_type", "summary", "source_url", "source_name", "source_tier", "published_date", "evidence_quote",
  "company_name", "round_stage", "sector_fit", "customer_type", "offering_type", "logistics_relevance", "confidence",
  "corroborated_by", "opening_line", "nudge_line", "signal_value",
] as const;

/**
 * Insert new signals; a URL already stored for this VC is left as it is.
 * The first verified classification sticks: Gemini 3 has no temperature
 * control, so re-classifying the same page each run made scores swing
 * (e.g. 64 → 41 on identical evidence).
 */
export async function insertSignals(rows: SignalRow[]): Promise<void> {
  if (rows.length === 0) return;
  const cols = SIGNAL_COLS.join(", ");
  const payload = rows.map((r) => Object.fromEntries(SIGNAL_COLS.map((c) => [c, r[c]])));
  try {
    await q(
      `insert into signals (${cols})
       select ${cols} from jsonb_populate_recordset(null::signals, $1::jsonb)
       on conflict (vc_id, source_url) do nothing`,
      [JSON.stringify(payload)],
    );
  } catch (e) {
    throw new Error(`insertSignals: ${(e as Error).message}`);
  }
}

/** Persist §8.2 triangulation results on stored signals (corroboration and confidence only). */
export async function updateCorroboration(
  rows: { vc_id: string; source_url: string; corroborated_by: string | null; confidence: number; signal_value: number }[],
): Promise<void> {
  if (rows.length === 0) return;
  await q(
    `update signals s set corroborated_by = x.corroborated_by, confidence = x.confidence, signal_value = x.signal_value
     from jsonb_to_recordset($1::jsonb) as x(vc_id uuid, source_url text, corroborated_by text, confidence numeric, signal_value numeric)
     where s.vc_id = x.vc_id and s.source_url = x.source_url`,
    [JSON.stringify(rows)],
  );
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
  await q("insert into portfolio_snapshots (vc_id, kind, entries, entries_hash) values ($1, $2, $3::jsonb, $4)", [
    vcId, kind, JSON.stringify(entries), hash,
  ]);
}

export async function recordScoreHistory(vcId: string, runId: number, score: number, action: RecommendedAction): Promise<void> {
  await q("insert into vc_score_history (vc_id, run_id, follow_up_score, recommended_action) values ($1, $2, $3, $4)", [
    vcId, runId, score, action,
  ]);
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
  const [row] = await q<{ id: number }>("insert into pipeline_runs (trigger) values ($1) returning id", [trigger]);
  return row!.id;
}

export async function finishRun(
  runId: number,
  result: { vcsProcessed: number; errors: RunError[]; usage: Record<string, unknown> },
): Promise<void> {
  await q(
    "update pipeline_runs set finished_at = now(), vcs_processed = $2, errors = $3::jsonb, usage = $4::jsonb where id = $1",
    [runId, result.vcsProcessed, JSON.stringify(result.errors), JSON.stringify(result.usage)],
  );
}
