// Corroboration rules (docs/signal-sources.md §8.2). Pure; applied to the
// window of stored signals before scoring.
import type { Entry } from "./portfolio";
import { canonical } from "./portfolio";
import { TIER_CONFIDENCE } from "./sources/tiers";
import type { SourceTier } from "./types";

export interface Triangulable {
  signal_type: string;
  source_tier: SourceTier;
  source_name: string;
  company_name: string | null;
  published_date: string;
  confidence: number;
  corroborated_by: string | null;
}

const days = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
const same = (a: string | null, b: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * - Upgrade: a D-tier signal + any A/B/C signal on the same company within 14
 *   days → treated as B-tier confirmed.
 * - Confirmation: any two different sources on the same company (portfolio
 *   diff + press, Form D + news) mark each other as corroborated.
 * - Conflict: an uncorroborated D-tier "investment" whose company is absent
 *   from a portfolio page we've snapshotted at least twice → confidence ≤ 0.5.
 * Returns the signals that changed.
 */
export function triangulate<T extends Triangulable>(signals: T[], portfolio: { runs: number; entries: Entry[] } | null): T[] {
  const changed = new Set<T>();
  for (const s of signals) {
    if (!s.company_name) continue;
    const others = signals.filter(
      (o) => o !== s && o.source_name !== s.source_name && same(o.company_name, s.company_name) && days(o.published_date, s.published_date) <= 14,
    );
    if (others.length === 0) continue;
    if (!s.corroborated_by) {
      s.corroborated_by = others[0]!.source_name;
      changed.add(s);
    }
    if (s.source_tier === "D" && others.some((o) => o.source_tier !== "D")) {
      const floor = TIER_CONFIDENCE.B;
      if (s.confidence < floor) {
        s.confidence = floor;
        changed.add(s);
      }
    }
  }

  if (portfolio && portfolio.runs >= 2) {
    const names = new Set(portfolio.entries.map((e) => canonical({ name: e.name })));
    for (const s of signals) {
      if (s.signal_type !== "investment" || s.source_tier !== "D" || s.corroborated_by || !s.company_name) continue;
      if (!names.has(canonical({ name: s.company_name })) && s.confidence > 0.5) {
        s.confidence = 0.5;
        changed.add(s);
      }
    }
  }
  return [...changed];
}
