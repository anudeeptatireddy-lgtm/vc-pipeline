// Read-only queries over the SQL views, used by the dashboard pages
// (CLAUDE.md rule 8). Nothing here writes; server-side only.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "./db";
import { ACTION_BUCKET, RECOMMENDED_ACTIONS, type Bucket, type RecommendedAction, type SourceTier, type VcStatus } from "./types";

export interface DashboardRow {
  id: string;
  firm: string;
  partnerName: string | null;
  priority: "P1" | "P2" | "P3" | null;
  region: string | null;
  status: VcStatus | null; // Vikram's data
  lastContactDate: string | null; // Vikram's data
  action: RecommendedAction;
  bucket: Bucket;
  score: number;
  scoreDelta: number | null;
  lastSignalDate: string | null;
  top: null | {
    summary: string;
    publishedDate: string;
    relevance: string;
    sources: { name: string; url: string; tier: SourceTier }[];
    corroborated: boolean;
    tier: SourceTier;
    fit: { sector: string; customer: string; offering: string; stage: string };
    openingLine: string | null;
    nudgeLine: string | null;
  };
  tapeDaysAgo: number[];
}

export interface RunRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  trigger: string | null;
  vcs_processed: number | null;
  errors: { vcId?: string; source?: string; message: string }[];
  usage: {
    durationMs?: number;
    perSource?: Record<string, number>;
    newSignals?: number;
    skippedForTime?: number;
    exa?: { calls: number; dollars: number };
    gemini?: { calls: number; inputTokens: number; outputTokens: number };
  };
}

export type RunState = "ok" | "running" | "failed" | "none";

export interface Dashboard {
  rows: DashboardRow[];
  latestRun: RunRow | null;
  lastGoodRun: RunRow | null;
  previousRun: RunRow | null;
  runState: RunState;
  suggested: { id: number; firm: string; partner_name: string | null; reason: string | null; evidence_urls: string[] | null }[];
  fixtures: boolean;
}

function check<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return (r.data ?? []) as T;
}

const ORDER: Record<Bucket, number> = { reach_out: 0, nudge: 1, parked: 2 };

export function sortRows(rows: DashboardRow[]): DashboardRow[] {
  return [...rows].sort(
    (a, b) =>
      ORDER[a.bucket] - ORDER[b.bucket] ||
      b.score - a.score ||
      (b.top?.publishedDate ?? b.lastSignalDate ?? "").localeCompare(a.top?.publishedDate ?? a.lastSignalDate ?? "") ||
      a.firm.localeCompare(b.firm),
  );
}

export function runState(latest: RunRow | null, now = Date.now()): RunState {
  if (!latest) return "none";
  if (latest.finished_at) {
    const fatal = latest.errors?.some((e) => e.message.startsWith("run failed"));
    return fatal ? "failed" : "ok";
  }
  return now - Date.parse(latest.started_at) < 10 * 60_000 ? "running" : "failed";
}

function isAction(a: string | null): a is RecommendedAction {
  return !!a && (Object.values(RECOMMENDED_ACTIONS) as string[]).includes(a);
}

export async function getDashboard(): Promise<Dashboard> {
  if (process.env.NEXT_PUBLIC_USE_FIXTURES === "true" && process.env.NODE_ENV !== "production") {
    const rows = JSON.parse(readFileSync(join(process.cwd(), "fixtures/dashboard.sample.json"), "utf8")) as DashboardRow[];
    return { rows: sortRows(rows), latestRun: null, lastGoodRun: null, previousRun: null, runState: "none", suggested: [], fixtures: true };
  }
  const c = db();
  const [vcs, tops, sources, tape, changes, runs, suggested] = await Promise.all([
    c.from("v_dashboard_vcs").select("id, firm, partner_name, priority, region, status, last_contact_date, last_signal_date, follow_up_score, recommended_action"),
    c.from("v_top_signal").select("*"),
    c.from("v_vc_sources").select("*").order("published_date", { ascending: false }),
    c.from("v_signal_tape").select("*"),
    c.from("v_score_changes").select("vc_id, delta, action_before"),
    c.from("pipeline_runs").select("*").order("started_at", { ascending: false }).limit(10),
    c.from("suggested_vcs").select("id, firm, partner_name, reason, evidence_urls").order("created_at", { ascending: false }).limit(3),
  ]);

  type V = { id: string; firm: string; partner_name: string | null; priority: string | null; region: string | null; status: VcStatus | null; last_contact_date: string | null; last_signal_date: string | null; follow_up_score: number | null; recommended_action: string | null };
  type T = { vc_id: string; summary: string; published_date: string; source_url: string; source_name: string; source_tier: SourceTier; sector_fit: string; customer_type: string; offering_type: string; round_stage: string; logistics_relevance: string; corroborated_by: string | null; opening_line: string | null; nudge_line: string | null };
  type S = { vc_id: string; source_name: string; source_url: string; source_tier: SourceTier };

  const topBy = new Map(check<T[]>(tops, "v_top_signal").map((t) => [t.vc_id, t]));
  const srcBy = new Map<string, S[]>();
  for (const s of check<S[]>(sources, "v_vc_sources")) srcBy.set(s.vc_id, [...(srcBy.get(s.vc_id) ?? []), s]);
  const tapeBy = new Map<string, number[]>();
  for (const t of check<{ vc_id: string; days_ago: number }[]>(tape, "v_signal_tape")) tapeBy.set(t.vc_id, [...(tapeBy.get(t.vc_id) ?? []), t.days_ago]);
  const deltaBy = new Map(check<{ vc_id: string; delta: number | null }[]>(changes, "v_score_changes").map((d) => [d.vc_id, d.delta]));

  const rows: DashboardRow[] = check<V[]>(vcs, "v_dashboard_vcs").map((v) => {
    const action = isAction(v.recommended_action) ? v.recommended_action : RECOMMENDED_ACTIONS.quiet;
    const t = topBy.get(v.id);
    const all = srcBy.get(v.id) ?? [];
    // The top signal's own link first, then the rest (unique URLs).
    const links = t ? [{ source_name: t.source_name, source_url: t.source_url, source_tier: t.source_tier }, ...all] : all;
    const seen = new Set<string>();
    const uniq = links.filter((s) => !seen.has(s.source_url) && !!seen.add(s.source_url));
    return {
      id: v.id,
      firm: v.firm,
      partnerName: v.partner_name,
      priority: (v.priority as DashboardRow["priority"]) ?? null,
      region: v.region,
      status: v.status,
      lastContactDate: v.last_contact_date,
      action,
      bucket: ACTION_BUCKET[action],
      score: v.follow_up_score ?? 0,
      scoreDelta: deltaBy.get(v.id) ?? null,
      lastSignalDate: v.last_signal_date,
      top: t
        ? {
            summary: t.summary,
            publishedDate: t.published_date,
            relevance: t.logistics_relevance,
            sources: uniq.map((s) => ({ name: s.source_name, url: s.source_url, tier: s.source_tier })),
            corroborated: !!t.corroborated_by,
            tier: t.source_tier,
            fit: { sector: t.sector_fit, customer: t.customer_type, offering: t.offering_type, stage: t.round_stage },
            openingLine: t.opening_line,
            nudgeLine: t.nudge_line,
          }
        : null,
      tapeDaysAgo: tapeBy.get(v.id) ?? [],
    };
  });

  const runList = check<RunRow[]>(runs, "pipeline_runs");
  const latestRun = runList[0] ?? null;
  const good = runList.filter((r) => runState(r) === "ok");
  return {
    rows: sortRows(rows),
    latestRun,
    lastGoodRun: good[0] ?? null,
    previousRun: good[1] ?? null,
    runState: runState(latestRun),
    suggested: check(suggested, "suggested_vcs"),
    fixtures: false,
  };
}

export interface SignalFeedRow {
  id: number;
  signal_type: string;
  summary: string;
  source_url: string;
  source_name: string;
  source_tier: SourceTier;
  published_date: string;
  evidence_quote: string | null;
  company_name: string | null;
  round_stage: string;
  sector_fit: string;
  customer_type: string;
  offering_type: string;
  logistics_relevance: string;
  confidence: number;
  corroborated_by: string | null;
}

export interface VcDetail {
  vc: {
    id: string; name: string; firm: string; partner_name: string | null; priority: string | null; region: string | null;
    status: VcStatus | null; last_contact_date: string | null; contact_history: string | null; personal_notes: string | null;
    last_signal_date: string | null; signal_summary: string | null; follow_up_score: number | null; recommended_action: string | null;
    updated_by_system_at: string | null; does_seed: string | null; b2b_logistics_thesis: string | null; investor_type: string | null;
    typical_check: string | null; geo_focus: string | null; signals_30d: number;
  };
  signals: SignalFeedRow[];
}

export async function getVcDetail(id: string): Promise<VcDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const c = db();
  const [vc, feed] = await Promise.all([
    c.from("v_dashboard_vcs").select("*").eq("id", id).maybeSingle(),
    c.from("v_signal_feed").select("*").eq("vc_id", id).order("published_date", { ascending: false }).limit(50),
  ]);
  if (vc.error) throw new Error(`v_dashboard_vcs: ${vc.error.message}`);
  if (!vc.data) return null;
  return { vc: vc.data as VcDetail["vc"], signals: check<SignalFeedRow[]>(feed, "v_signal_feed") };
}

export async function getRuns(limit = 30): Promise<RunRow[]> {
  return check<RunRow[]>(
    await db().from("pipeline_runs").select("*").order("started_at", { ascending: false }).limit(limit),
    "pipeline_runs",
  );
}
