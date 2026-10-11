// Read-only queries over the SQL views, used by the dashboard pages
// (CLAUDE.md rule 8). Nothing here writes; server-side only.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { q } from "./sql";
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
  const [vcs, tops, sources, tape, changes, runs, suggested] = await Promise.all([
    q("select id, firm, partner_name, priority, region, status, last_contact_date, last_signal_date, follow_up_score, recommended_action from v_dashboard_vcs"),
    q("select * from v_top_signal"),
    q("select * from v_vc_sources order by published_date desc"),
    q("select * from v_signal_tape"),
    q("select vc_id, delta, action_before from v_score_changes"),
    q("select * from pipeline_runs order by started_at desc limit 10"),
    q("select id, firm, partner_name, reason, evidence_urls from suggested_vcs order by created_at desc limit 3"),
  ]);

  type V = { id: string; firm: string; partner_name: string | null; priority: string | null; region: string | null; status: VcStatus | null; last_contact_date: string | null; last_signal_date: string | null; follow_up_score: number | null; recommended_action: string | null };
  type T = { vc_id: string; summary: string; published_date: string; source_url: string; source_name: string; source_tier: SourceTier; sector_fit: string; customer_type: string; offering_type: string; round_stage: string; logistics_relevance: string; corroborated_by: string | null; opening_line: string | null; nudge_line: string | null };
  type S = { vc_id: string; source_name: string; source_url: string; source_tier: SourceTier };

  const topBy = new Map((tops as T[]).map((t) => [t.vc_id, t]));
  const srcBy = new Map<string, S[]>();
  for (const s of sources as S[]) srcBy.set(s.vc_id, [...(srcBy.get(s.vc_id) ?? []), s]);
  const tapeBy = new Map<string, number[]>();
  for (const t of tape as { vc_id: string; days_ago: number }[]) tapeBy.set(t.vc_id, [...(tapeBy.get(t.vc_id) ?? []), t.days_ago]);
  const deltaBy = new Map((changes as { vc_id: string; delta: number | null }[]).map((d) => [d.vc_id, d.delta]));

  const rows: DashboardRow[] = (vcs as V[]).map((v) => {
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

  const runList = runs as unknown as RunRow[];
  const latestRun = runList[0] ?? null;
  const good = runList.filter((r) => runState(r) === "ok");
  return {
    rows: sortRows(rows),
    latestRun,
    lastGoodRun: good[0] ?? null,
    previousRun: good[1] ?? null,
    runState: runState(latestRun),
    suggested: suggested as Dashboard["suggested"],
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

export interface ContactRow {
  id: number;
  name: string;
  title: string | null;
  poc_level: "decision_maker" | "partner" | "principal" | "associate" | "other";
  focus: string | null;
  bio: string | null;
  relevant: boolean;
  rank: number;
  linkedin_url: string | null;
  x_url: string | null;
  email: string | null;
  email_source_url: string | null;
  source_url: string;
  messages: { kind: "email" | "linkedin_note" | "follow_up"; subject: string | null; body: string }[];
}

export interface ChannelRow {
  pitch_url: string | null;
  emails: string[];
  email_sources: string[];
  x_url: string | null;
  contact_url: string | null;
  email_hidden_from_bots: boolean;
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
  contacts: ContactRow[];
  channels: ChannelRow | null;
}

export async function getVcDetail(id: string): Promise<VcDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [vc, feed, contacts, messages, channels] = await Promise.all([
    q<VcDetail["vc"]>("select * from v_dashboard_vcs where id = $1", [id]),
    q<SignalFeedRow>("select * from v_signal_feed where vc_id = $1 order by published_date desc limit 50", [id]),
    q<Omit<ContactRow, "messages">>("select * from vc_contacts where vc_id = $1 order by rank", [id]),
    q<{ contact_id: number; kind: ContactRow["messages"][number]["kind"]; subject: string | null; body: string }>(
      "select contact_id, kind, subject, body from vc_messages where vc_id = $1 order by kind",
      [id],
    ),
    q<ChannelRow>("select pitch_url, emails, email_sources, x_url, contact_url, email_hidden_from_bots from vc_channels where vc_id = $1", [id]),
  ]);
  if (!vc[0]) return null;
  return {
    vc: vc[0],
    signals: feed,
    contacts: contacts.map((c) => ({ ...c, messages: messages.filter((m) => m.contact_id === c.id).map(({ kind, subject, body }) => ({ kind, subject, body })) })),
    channels: channels[0] ?? null,
  };
}

export async function getRuns(limit = 30): Promise<RunRow[]> {
  return q<RunRow>("select * from pipeline_runs order by started_at desc limit $1", [limit]);
}
