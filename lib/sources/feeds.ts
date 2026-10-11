// RSS helpers shared by the feed-based sources.
import Parser from "rss-parser";
import { politeFetch } from "../http";
import type { RawItem, SourceTier } from "../types";

const parser = new Parser();

export async function parseFeed(xml: string, source: string, tier: SourceTier, since: Date): Promise<RawItem[]> {
  const feed = await parser.parseString(xml);
  const out: RawItem[] = [];
  for (const it of feed.items ?? []) {
    const date = it.isoDate ?? it.pubDate;
    if (!it.link || !date || new Date(date) < since) continue;
    out.push({
      url: it.link,
      title: (it.title ?? "").trim(),
      snippet: (it.contentSnippet ?? it.content ?? "").replace(/\s+/g, " ").slice(0, 600),
      publishedAt: new Date(date).toISOString(),
      source,
      sourceTier: tier,
    });
  }
  return out;
}

export async function fetchFeed(url: string, source: string, tier: SourceTier, since: Date): Promise<RawItem[]> {
  const r = await politeFetch(url);
  if (!r.ok) throw new Error(`${source} feed ${url}: ${r.status || r.error}`);
  return parseFeed(r.text, source, tier, since);
}
