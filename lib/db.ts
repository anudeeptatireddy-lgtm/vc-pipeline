// Server-only Supabase access. The only path that writes to `vcs` is the two
// RPCs below; never call .insert/.update/.upsert on "vcs" anywhere else
// (tests/db-guard.test.ts enforces this).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RecommendedAction, Vc, VerifiedSignal } from "./types";

let client: SupabaseClient | undefined;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export async function loadVcs(): Promise<Vc[]> {
  const { data, error } = await db().from("vcs").select("*").order("firm");
  if (error) throw new Error(`loadVcs: ${error.message}`);
  return data as Vc[];
}

export interface VcSignalUpdate {
  lastSignalDate: string | null; // null keeps the previous date (quiet week)
  signalSummary: string;
  followUpScore: number;
  recommendedAction: RecommendedAction;
}

/** The ONLY function that writes signal columns on `vcs`. */
export async function writeVcSignals(vcId: string, u: VcSignalUpdate): Promise<void> {
  const { error } = await db().rpc("update_vc_signals", {
    p_id: vcId,
    p_last_signal_date: u.lastSignalDate,
    p_signal_summary: u.signalSummary,
    p_follow_up_score: u.followUpScore,
    p_recommended_action: u.recommendedAction,
  });
  if (error) throw new Error(`update_vc_signals(${vcId}): ${error.message}`);
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
}

/** Seeding only (scripts/seed-vcs.ts). Omitted fields keep their current value. */
export async function writeVcIdentifiers(vcId: string, ids: VcIdentifiers): Promise<void> {
  const params: Record<string, string> = { p_id: vcId };
  for (const [k, v] of Object.entries(ids)) if (v) params[`p_${k}`] = v;
  const { error } = await db().rpc("update_vc_identifiers", params);
  if (error) throw new Error(`update_vc_identifiers(${vcId}): ${error.message}`);
}

export type SignalRow = VerifiedSignal & { signal_value: number };

/** Upsert on (vc_id, source_url) so re-runs don't duplicate evidence. */
export async function insertSignals(rows: SignalRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await db().from("signals").upsert(rows, { onConflict: "vc_id,source_url" });
  if (error) throw new Error(`insertSignals: ${error.message}`);
}

export async function recordScoreHistory(
  vcId: string,
  runId: number,
  score: number,
  action: RecommendedAction,
): Promise<void> {
  const { error } = await db()
    .from("vc_score_history")
    .insert({ vc_id: vcId, run_id: runId, follow_up_score: score, recommended_action: action });
  if (error) throw new Error(`recordScoreHistory(${vcId}): ${error.message}`);
}

export interface RunError {
  vcId?: string;
  source?: string;
  message: string;
}

export async function startRun(trigger: "cron" | "manual" | "script"): Promise<number> {
  const { data, error } = await db().from("pipeline_runs").insert({ trigger }).select("id").single();
  if (error) throw new Error(`startRun: ${error.message}`);
  return data.id as number;
}

export async function finishRun(
  runId: number,
  result: { vcsProcessed: number; errors: RunError[]; usage: Record<string, unknown> },
): Promise<void> {
  const { error } = await db()
    .from("pipeline_runs")
    .update({
      finished_at: new Date().toISOString(),
      vcs_processed: result.vcsProcessed,
      errors: result.errors,
      usage: result.usage,
    })
    .eq("id", runId);
  if (error) throw new Error(`finishRun(${runId}): ${error.message}`);
}
