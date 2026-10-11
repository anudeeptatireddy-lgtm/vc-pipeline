// Feeds fetched once per run and matched to VCs by name afterwards:
// India funding news (docs/signal-sources.md §3) and logistics trade media (§1.10).
import type { RawItem, SignalSource, Vc } from "../types";
import { fetchFeed } from "./feeds";

export const BATCH_FEEDS: { source: string; url: string }[] = [
  { source: "inc42", url: "https://inc42.com/feed/" },
  { source: "inc42", url: "https://inc42.com/buzz/feed/" },
  { source: "yourstory", url: "https://yourstory.com/feed" },
  { source: "supply-chain-dive", url: "https://www.supplychaindive.com/feeds/news/" },
  { source: "the-loadstar", url: "https://theloadstar.com/feed/" },
  { source: "et-infra", url: "https://infra.economictimes.indiatimes.com/rss/topstories" },
  { source: "joc", url: "https://www.joc.com/rss.xml" },
];

export const batchFeedSource: SignalSource = {
  name: "batch-feeds",
  enabled: () => true,
  async fetchBatch(since) {
    const results = await Promise.allSettled(BATCH_FEEDS.map((f) => fetchFeed(f.url, f.source, "C", since)));
    const items: RawItem[] = [];
    const failures: string[] = [];
    results.forEach((r, i) => (r.status === "fulfilled" ? items.push(...r.value) : failures.push(BATCH_FEEDS[i]!.url)));
    if (items.length === 0 && failures.length) throw new Error(`all batch feeds failed: ${failures.join(", ")}`);
    return items;
  },
};

/**
 * Names an article must contain to count as being about this VC. Single words
 * are only used when distinctive ("Accel", "Lightspeed"), never "Prime" or "Titan".
 */
export function vcAliases(vc: Pick<Vc, "firm" | "partner_name">): string[] {
  const aliases = new Set<string>();
  const base = vc.firm.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  aliases.add(base);
  const inParens = vc.firm.match(/\((.*?)\)/)?.[1];
  if (inParens && inParens.includes(" ")) aliases.add(inParens.trim());
  const noIndia = base.replace(/\s+India$/i, "");
  if (noIndia !== base && !noIndia.includes(" ") && noIndia.length >= 5) aliases.add(noIndia);
  if (vc.partner_name && vc.partner_name.includes(" ")) aliases.add(vc.partner_name);
  return [...aliases];
}

export function mentionsVc(text: string, vc: Pick<Vc, "firm" | "partner_name">): boolean {
  const t = text.toLowerCase();
  return vcAliases(vc).some((a) => {
    const re = new RegExp(`(^|[^a-z0-9])${a.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
    return re.test(t);
  });
}

export function matchBatch(items: RawItem[], vc: Vc): RawItem[] {
  return items.filter((i) => mentionsVc(`${i.title} ${i.snippet ?? ""}`, vc));
}
