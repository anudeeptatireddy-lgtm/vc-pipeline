// Podcast Index search by person (docs/signal-sources.md §1.8).
import { createHash } from "node:crypto";
import { z } from "zod";
import { USER_AGENT } from "../http";
import type { RawItem, SignalSource } from "../types";

const Episodes = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      link: z.string().nullish(),
      enclosureUrl: z.string().nullish(),
      feedTitle: z.string().nullish(),
      description: z.string().nullish(),
      datePublished: z.number(),
    }),
  ),
});

export function podcastAuthHeaders(key: string, secret: string, now = Date.now()): Record<string, string> {
  const date = String(Math.floor(now / 1000));
  return {
    "User-Agent": USER_AGENT,
    "X-Auth-Key": key,
    "X-Auth-Date": date,
    Authorization: createHash("sha1").update(key + secret + date).digest("hex"),
  };
}

export function parseEpisodes(json: unknown, since: Date): RawItem[] {
  return Episodes.parse(json)
    .items.filter((e) => e.datePublished * 1000 >= since.getTime() && (e.link || e.enclosureUrl))
    .map((e) => ({
      url: (e.link || e.enclosureUrl)!,
      title: `${e.title}${e.feedTitle ? ` (${e.feedTitle})` : ""}`,
      snippet: (e.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500),
      publishedAt: new Date(e.datePublished * 1000).toISOString(),
      source: "podcast-index",
      sourceTier: "B" as const,
    }));
}

export const podcastIndexSource: SignalSource = {
  name: "podcast-index",
  enabled: (vc) => !!(process.env.PODCASTINDEX_API_KEY && process.env.PODCASTINDEX_API_SECRET && vc.partner_name),
  async fetchForVc(vc, since) {
    const url = `https://api.podcastindex.org/api/1.0/search/byperson?q=${encodeURIComponent(vc.partner_name!)}&max=20`;
    const res = await fetch(url, {
      headers: podcastAuthHeaders(process.env.PODCASTINDEX_API_KEY!, process.env.PODCASTINDEX_API_SECRET!),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`podcast-index ${res.status}`);
    return parseEpisodes(await res.json(), since);
  },
};
