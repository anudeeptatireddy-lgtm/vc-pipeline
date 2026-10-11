// News RSS per VC (the role docs/signal-sources.md §1.2 gave Google News RSS).
// Google News disallows /rss/search in robots.txt (CLAUDE.md rule 4), so this
// uses Bing News RSS, which allows it: free, no key, one request per VC.
import { politeFetch } from "../http";
import type { RawItem, SignalSource, Vc } from "../types";
import { parseFeed } from "./feeds";
import { tierForUrl } from "./tiers";

const firmName = (vc: Vc) => vc.firm.replace(/\(.*?\)/g, "").trim();

/** Bing's links are click-trackers carrying the publisher URL in `url=`. */
export function publisherUrl(link: string): string {
  try {
    const u = new URL(link);
    if (/(^|\.)bing\.com$/.test(u.hostname)) {
      const target = u.searchParams.get("url");
      if (target && /^https?:\/\//.test(target)) return target;
    }
  } catch {}
  return link;
}

export function newsRssUrl(vc: Pick<Vc, "firm" | "partner_name" | "region">): string {
  // Quoted firm name only: Bing's RSS returns nothing for OR queries.
  const terms = `"${firmName(vc as Vc)}"`;
  const mkt = /india/i.test(vc.region ?? "") ? "en-IN" : "en-US";
  return `https://www.bing.com/news/search?q=${encodeURIComponent(terms)}&format=rss&mkt=${mkt}`;
}

export const newsRssSource: SignalSource = {
  name: "news-rss",
  enabled: () => true,
  async fetchForVc(vc, since) {
    const r = await politeFetch(newsRssUrl(vc));
    if (!r.ok) throw new Error(`news rss ${r.status || r.error}`);
    const items = await parseFeed(r.text, "news-rss", "C", since);
    return items.map((i): RawItem => {
      const url = publisherUrl(i.url);
      return { ...i, url, sourceTier: tierForUrl(url, vc) };
    });
  },
};
