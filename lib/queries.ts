// Read-only queries over the SQL views, used by the dashboard pages
// (CLAUDE.md rule 8). Nothing here writes; server-side only.
import { daysAgo, firmFit, signalValue, sourcesAgree } from "./score";
import { q } from "./sql";
import { dealFacts, fitTags, laneOf, type DealFacts, type FitTags, type Lane } from "./triage";
import type { RoundStage, SignalType, SourceTier, VcStatus } from "./types";

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

export function runState(latest: RunRow | null, now = Date.now()): RunState {
  if (!latest) return "none";
  if (latest.finished_at) {
    const fatal = latest.errors?.some((e) => e.message.startsWith("run failed"));
    return fatal ? "failed" : "ok";
  }
  return now - Date.parse(latest.started_at) < 10 * 60_000 ? "running" : "failed";
}

/** One dated, linked item of evidence (a stored signal). */
export interface Evidence {
  id: number;
  type: string;
  summary: string;
  url: string;
  source: string;
  date: string;
  quote: string | null;
}

export interface TriageRow {
  id: string;
  firm: string;
  partnerName: string | null;
  region: string | null;
  status: VcStatus | null; // Vikram's data
  lastContactDate: string | null; // Vikram's data
  contactHistory: string | null; // Vikram's data
  personalNotes: string | null; // Vikram's data
  action: string;
  lane: Lane;
  score: number;
  scoreDelta: number | null;
  lastSignalDate: string | null;
  tags: FitTags | null;
  lead: null | {
    type: string;
    summary: string;
    date: string;
    deal: DealFacts | null;
    url: string;
    source: string;
    quote: string | null;
    confirmed: boolean;
    line: string | null;
    lineKind: "opening" | "nudge";
  };
  /** The lead signal and the items that report the same thing (deduplicated by link and site). */
  evidence: Evidence[];
  /** Everything else from the last 30 days, newest first. */
  other: Evidence[];
  tape: number[];
  profile: { doesSeed: string | null; thesis: string | null; type: string | null; cheque: string | null; geo: string | null };
  /** Top three signal values behind the score, plus the agreement bonus and firm fit (§8.3). */
  scoreParts: { summary: string; value: number }[];
  agreeBonus: boolean;
  fit: number;
}

export interface Suggestion {
  id: number;
  firm: string;
  summary: string | null;
  reason: string | null;
  caveat: string | null;
  rubricScore: number | null;
  dealCount: number | null;
  evidenceUrls: string[];
}

export interface Triage {
  rows: TriageRow[];
  latestRun: RunRow | null;
  /** Last full run (all investors) that finished, and the one before it. */
  lastGoodRun: RunRow | null;
  previousRun: RunRow | null;
  runState: RunState;
  suggested: Suggestion[];
}

const LANE_ORDER: Record<Lane, number> = { today: 0, follow: 1, maybe: 2, parked: 3 };

export function sortRows<T extends { lane: Lane; score: number; lastSignalDate: string | null; firm: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      LANE_ORDER[a.lane] - LANE_ORDER[b.lane] ||
      b.score - a.score ||
      (b.lastSignalDate ?? "").localeCompare(a.lastSignalDate ?? "") ||
      a.firm.localeCompare(b.firm),
  );
}

const urlKey = (u: string) => {
  try {
    const x = new URL(u);
    return `${x.hostname.replace(/^www\./, "")}${x.pathname.replace(/\/$/, "")}`;
  } catch {
    return u;
  }
};
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

export async function getTriage(): Promise<Triage> {
  const [vcs, tops, feed, changes, runs, suggested] = await Promise.all([
    q("select * from v_dashboard_vcs where not exists (select 1 from vcs a where a.id = v_dashboard_vcs.id and a.archived)"),
    q("select * from v_top_signal"),
    q<SignalFeedRow & { vc_id: string }>("select * from v_signal_feed where published_date >= current_date - 30 order by published_date desc, id desc"),
    q("select vc_id, delta from v_score_changes"),
    q("select * from pipeline_runs order by started_at desc limit 40"),
    q("select * from suggested_vcs order by rubric_score desc nulls last, created_at desc limit 12"),
  ]);

  type V = VcDetail["vc"];
  type T = { vc_id: string; signal_id: number; summary: string; published_date: string; source_url: string; source_name: string; evidence_quote: string | null; corroborated_by: string | null; opening_line: string | null; nudge_line: string | null };
  const topBy = new Map((tops as T[]).map((t) => [t.vc_id, t]));
  const feedBy = new Map<string, SignalFeedRow[]>();
  for (const s of feed) feedBy.set(s.vc_id, [...(feedBy.get(s.vc_id) ?? []), s]);
  const deltaBy = new Map((changes as { vc_id: string; delta: number | null }[]).map((d) => [d.vc_id, d.delta]));
  const today = new Date();

  const rows: TriageRow[] = (vcs as V[]).map((v) => {
    const sigs = feedBy.get(v.id) ?? [];
    const t = topBy.get(v.id);
    const leadSig = t ? sigs.find((s) => s.id === t.signal_id) ?? null : null;
    const tags = leadSig
      ? fitTags({ sector: leadSig.sector_fit, customer: leadSig.customer_type, offering: leadSig.offering_type, stage: leadSig.round_stage }, v.does_seed)
      : null;
    const action = v.recommended_action ?? "Quiet: deprioritize this week";
    const score = v.follow_up_score ?? 0;
    const lane = laneOf({ score, status: v.status, hasSignal: !!leadSig, tags, action });

    // Evidence that supports the lead: the lead itself, then items about the same company; one per link and per site.
    const company = leadSig?.company_name?.trim().toLowerCase();
    const same = (s: SignalFeedRow) =>
      !!leadSig && (s.id === leadSig.id || (!!company && company !== v.firm.toLowerCase() && s.company_name?.trim().toLowerCase() === company));
    const toEv = (s: SignalFeedRow): Evidence => ({ id: s.id, type: s.signal_type, summary: s.summary, url: s.source_url, source: s.source_name, date: s.published_date, quote: s.evidence_quote });
    const seenUrl = new Set<string>();
    const seenHost = new Set<string>();
    const evidence: Evidence[] = [];
    for (const s of [...(leadSig ? [leadSig] : []), ...sigs.filter((x) => x.id !== leadSig?.id && same(x))]) {
      const k = urlKey(s.source_url);
      const h = hostOf(s.source_url);
      if (seenUrl.has(k) || seenHost.has(h)) continue;
      seenUrl.add(k);
      seenHost.add(h);
      evidence.push(toEv(s));
    }
    const other = sigs.filter((s) => !same(s) && !seenUrl.has(urlKey(s.source_url))).slice(0, 6).map(toEv);
    const confirmed = !!leadSig && (!!leadSig.corroborated_by || new Set(evidence.map((e) => hostOf(e.url))).size >= 2);

    const scorable = sigs.map((s) => ({ ...s, signal_type: s.signal_type as SignalType, round_stage: s.round_stage as RoundStage, logistics_relevance: s.logistics_relevance as never }));
    const scoreParts = scorable
      .map((s) => ({ summary: s.summary, value: Number(signalValue(s, today).toFixed(1)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    const waiting = v.status === "waiting_for_response";
    return {
      id: v.id,
      firm: v.firm,
      partnerName: v.partner_name,
      region: v.region,
      status: v.status,
      lastContactDate: v.last_contact_date,
      contactHistory: v.contact_history,
      personalNotes: v.personal_notes,
      action,
      lane,
      score,
      scoreDelta: deltaBy.get(v.id) ?? null,
      lastSignalDate: v.last_signal_date,
      tags,
      lead:
        leadSig && t
          ? {
              type: leadSig.signal_type,
              summary: leadSig.summary,
              date: leadSig.published_date,
              deal: leadSig.signal_type === "investment" ? dealFacts(leadSig) : null,
              url: leadSig.source_url,
              source: leadSig.source_name,
              quote: leadSig.evidence_quote,
              confirmed,
              line: waiting ? (t.nudge_line ?? t.opening_line) : t.opening_line,
              lineKind: waiting && t.nudge_line ? "nudge" : "opening",
            }
          : null,
      evidence,
      other,
      tape: sigs.map((s) => daysAgo(s.published_date, today)),
      profile: { doesSeed: v.does_seed, thesis: v.b2b_logistics_thesis, type: v.investor_type, cheque: v.typical_check, geo: v.geo_focus },
      scoreParts,
      agreeBonus: sourcesAgree(scorable),
      fit: Number(
        firmFit(v.does_seed && v.b2b_logistics_thesis && v.investor_type ? { does_seed: v.does_seed as never, b2b_logistics_thesis: v.b2b_logistics_thesis as never, investor_type: v.investor_type as never } : null).toFixed(2),
      ),
    };
  });

  const runList = runs as unknown as RunRow[];
  const latestRun = runList[0] ?? null;
  // "Updated" means the last run that checked the whole list, not a one-investor test run.
  const good = runList.filter((r) => runState(r) === "ok" && (r.vcs_processed ?? 0) >= 40);
  type Sg = { id: number; firm: string; summary: string | null; reason: string | null; caveat: string | null; rubric_score: string | number | null; deal_count: number | null; evidence_urls: string[] | null };
  return {
    rows: sortRows(rows),
    latestRun,
    lastGoodRun: good[0] ?? null,
    previousRun: good[1] ?? null,
    runState: runState(latestRun),
    suggested: (suggested as Sg[]).map((x) => ({
      id: x.id, firm: x.firm, summary: x.summary, reason: x.reason, caveat: x.caveat,
      rubricScore: x.rubric_score == null ? null : Number(x.rubric_score), dealCount: x.deal_count, evidenceUrls: x.evidence_urls ?? [],
    })),
  };
}

export interface SignalFeedRow {
  id: number;
  vc_id?: string;
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
}

export async function getVcDetail(id: string): Promise<VcDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [vc, feed] = await Promise.all([
    q<VcDetail["vc"]>("select * from v_dashboard_vcs where id = $1", [id]),
    q<SignalFeedRow>("select * from v_signal_feed where vc_id = $1 order by published_date desc limit 50", [id]),
  ]);
  if (!vc[0]) return null;
  return { vc: vc[0], signals: feed };
}

/** People and firm routes for one investor (the workspace loads these when it opens). */
export async function getContacts(id: string): Promise<{ contacts: ContactRow[]; channels: ChannelRow | null } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [contacts, messages, channels] = await Promise.all([
    q<Omit<ContactRow, "messages">>("select * from vc_contacts where vc_id = $1 order by rank", [id]),
    q<{ contact_id: number; kind: ContactRow["messages"][number]["kind"]; subject: string | null; body: string }>(
      "select contact_id, kind, subject, body from vc_messages where vc_id = $1 order by kind",
      [id],
    ),
    q<ChannelRow>("select pitch_url, emails, email_sources, x_url, contact_url, email_hidden_from_bots from vc_channels where vc_id = $1", [id]),
  ]);
  return {
    contacts: contacts.map((c) => ({ ...c, messages: messages.filter((m) => m.contact_id === c.id).map(({ kind, subject, body }) => ({ kind, subject, body })) })),
    channels: channels[0] ?? null,
  };
}

export async function getRuns(limit = 30): Promise<RunRow[]> {
  return q<RunRow>("select * from pipeline_runs order by started_at desc limit $1", [limit]);
}
