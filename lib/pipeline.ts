// One VC through the pipeline: sources → Gemini → verify → score → RPC.
// Every source call is isolated (CLAUDE.md rule 6): a failure is recorded and
// the VC still gets scored from whatever else is available.
import {
  insertSignals, loadRecentSignals, recordScoreHistory, writeVcSignals,
  type RunError, type SignalRow, type VcProfile,
} from "./db";
import { firmFit, followUpScore, logisticsRelevance, recommendedAction, signalSummary, signalValue } from "./score";
import { extractSignals, type ModelSignal } from "./sources/gemini-grounding";
import { TIER_CONFIDENCE, tierForUrl } from "./sources/tiers";
import type { RawItem, RecommendedAction, SignalSource, Vc, VerifiedSignal } from "./types";
import { canonicalUrl, dedupe, toDay, verifyCandidate, WINDOW_DAYS } from "./verify";

export interface VcRunResult {
  vcId: string;
  firm: string;
  rawItems: number;
  modelSignals: number;
  newSignals: number;
  rejected: Record<string, number>;
  score: number;
  action: RecommendedAction;
  summary: string;
  errors: RunError[];
  perSource: Record<string, number>;
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** dashboard-design.md §7: drop copy lines over 40 words or on off-thesis signals. */
function copyLine(line: string | undefined, onThesis: boolean): string | null {
  if (!onThesis || !line?.trim()) return null;
  return words(line) <= 40 ? line.trim() : null;
}

export function windowStart(today: Date): Date {
  return new Date(today.getTime() - WINDOW_DAYS * 86_400_000);
}

export async function processVc(opts: {
  vc: Vc;
  profile: VcProfile | null;
  sources: SignalSource[];
  batchItems?: RawItem[]; // from fetchBatch sources, already matched to this VC
  runId: number;
  today?: Date;
}): Promise<VcRunResult> {
  const { vc, profile, sources, runId } = opts;
  const today = opts.today ?? new Date();
  const since = windowStart(today);
  const errors: RunError[] = [];
  const perSource: Record<string, number> = {};
  const rejected: Record<string, number> = {};

  // 1. Collect raw items, one source at a time, each isolated.
  const raw: RawItem[] = [...(opts.batchItems ?? [])];
  for (const b of opts.batchItems ?? []) perSource[b.source] = (perSource[b.source] ?? 0) + 1;
  const ordered = [...sources.filter((s) => !s.fallbackOnly), ...sources.filter((s) => s.fallbackOnly)];
  for (const src of ordered) {
    if (!src.fetchForVc || !src.enabled(vc)) continue;
    if (src.fallbackOnly && raw.length > 0) continue;
    try {
      const items = await src.fetchForVc(vc, since);
      perSource[src.name] = (perSource[src.name] ?? 0) + items.length;
      raw.push(...items);
    } catch (e) {
      errors.push({ vcId: vc.id, source: src.name, message: (e as Error).message.slice(0, 300) });
    }
  }
  const byUrl = new Map<string, RawItem>();
  for (const r of raw) {
    try {
      byUrl.set(canonicalUrl(r.url), r);
    } catch {}
  }

  // 2. Gemini: classify collected items + search for more.
  let modelSignals: ModelSignal[] = [];
  try {
    const out = await extractSignals(vc, profile, raw, today);
    modelSignals = out.is_same_person_or_firm || out.signals.length === 0 ? out.signals : [];
    if (!out.is_same_person_or_firm && out.signals.length) rejected["namesake"] = out.signals.length;
  } catch (e) {
    errors.push({ vcId: vc.id, source: "gemini-grounding", message: (e as Error).message.slice(0, 300) });
  }
  perSource["gemini-grounding"] = modelSignals.length;

  // 3. Verify each in code.
  const verified: VerifiedSignal[] = [];
  for (const m of modelSignals) {
    let rawItem: RawItem | undefined;
    try {
      rawItem = byUrl.get(canonicalUrl(m.source_url));
    } catch {}
    const v = await verifyCandidate(
      {
        url: m.source_url,
        title: m.title ?? rawItem?.title,
        publisherUrl: rawItem?.publisher,
        rssDate: rawItem?.publishedAt,
        modelDate: m.published_date || undefined,
        evidence: m.evidence_quote,
      },
      { firm: vc.firm, partnerName: vc.partner_name },
      today,
    ).catch((e): { reject: string } => ({ reject: `verify error: ${(e as Error).message.slice(0, 80)}` }));
    if ("reject" in v) {
      const key = v.reject.replace(/\s*\(.*\)$/, "");
      rejected[key] = (rejected[key] ?? 0) + 1;
      continue;
    }
    const relevance = logisticsRelevance(m.sector_fit, m.customer_type, m.offering_type);
    const tier = rawItem && canonicalUrl(rawItem.url) === canonicalUrl(v.url) ? rawItem.sourceTier : tierForUrl(v.url, vc);
    const onThesis = relevance === "direct" || relevance === "thematic";
    verified.push({
      vc_id: vc.id,
      signal_type: m.signal_type,
      summary: m.summary_one_line.trim(),
      source_url: v.url,
      source_name: rawItem?.source ?? "gemini-grounding",
      source_tier: tier,
      published_date: v.publishedDate,
      evidence_quote: m.evidence_quote?.trim() || null,
      company_name: m.company_name?.trim() || null,
      round_stage: m.round_stage,
      sector_fit: m.sector_fit,
      customer_type: m.customer_type,
      offering_type: m.offering_type,
      logistics_relevance: relevance,
      // Tier sets the ceiling; the model's own confidence scales within it.
      confidence: Number((TIER_CONFIDENCE[tier] * (0.5 + 0.5 * m.confidence)).toFixed(3)),
      opening_line: copyLine(m.opening_line, onThesis),
      nudge_line: copyLine(m.nudge_line, onThesis),
      corroborated_by: null,
    });
  }

  // 4. Dedupe and store.
  const fresh: SignalRow[] = dedupe(verified).map((s) => ({ ...s, signal_value: Number(signalValue(s, today).toFixed(3)) }));
  try {
    await insertSignals(fresh);
  } catch (e) {
    errors.push({ vcId: vc.id, source: "db", message: (e as Error).message.slice(0, 300) });
  }

  // 5. Score over everything stored in the window (earlier runs included),
  //    so a quiet run doesn't erase last week's evidence.
  let window: SignalRow[] = fresh;
  try {
    window = dedupe(await loadRecentSignals(vc.id, toDay(since)));
  } catch (e) {
    errors.push({ vcId: vc.id, source: "db", message: (e as Error).message.slice(0, 300) });
  }
  const score = followUpScore(window, firmFit(profile), today);
  const action = recommendedAction(score, vc.status, vc.last_contact_date, today);
  const summary = signalSummary(window, today);
  const lastSignalDate = window.length ? window.map((s) => s.published_date).sort().at(-1)! : null;

  await writeVcSignals(vc.id, { lastSignalDate, signalSummary: summary, followUpScore: score, recommendedAction: action });
  await recordScoreHistory(vc.id, runId, score, action).catch((e) =>
    errors.push({ vcId: vc.id, source: "db", message: (e as Error).message.slice(0, 300) }),
  );

  return {
    vcId: vc.id, firm: vc.firm, rawItems: raw.length, modelSignals: modelSignals.length, newSignals: fresh.length,
    rejected, score, action, summary, errors, perSource,
  };
}
