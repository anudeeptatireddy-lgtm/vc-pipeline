// Source reliability tiers (docs/signal-sources.md §8.1) by URL.
import type { SourceTier, Vc } from "../types";

export const TIER_CONFIDENCE: Record<SourceTier, number> = { A: 0.95, B: 0.85, C: 0.75, D: 0.55 };

const SOCIAL = /(^|\.)(linkedin\.com|x\.com|twitter\.com|bsky\.app|threads\.net|facebook\.com|instagram\.com)$/;
const FIRST_PARTY = /(^|\.)(substack\.com|medium\.com|youtube\.com|podcasts\.apple\.com|spotify\.com|buzzsprout\.com|transistor\.fm)$/;

export function tierForUrl(url: string, vc: Pick<Vc, "website" | "rss_url">): SourceTier {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "C";
  }
  const own = [vc.website, vc.rss_url]
    .filter((u): u is string => !!u)
    .map((u) => new URL(u).hostname.replace(/^www\./, ""));
  if (own.some((h) => host === h || host.endsWith(`.${h}`))) return "B";
  if (SOCIAL.test(host)) return "D";
  if (FIRST_PARTY.test(host)) return "B";
  return "C";
}
