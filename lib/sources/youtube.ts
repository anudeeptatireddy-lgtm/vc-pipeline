// YouTube (docs/signal-sources.md §1.9) via the Data API v3 only. The channel
// RSS endpoint the docs suggest is disallowed by youtube.com/robots.txt, so
// channel uploads come from playlistItems.list (1 unit) instead, plus one
// capped search.list (100 units) per VC for the partner's name.
import { z } from "zod";
import type { RawItem, SignalSource } from "../types";

const Playlist = z.object({
  items: z.array(
    z.object({
      snippet: z.object({
        title: z.string(),
        description: z.string(),
        publishedAt: z.string(),
        channelTitle: z.string(),
        resourceId: z.object({ videoId: z.string() }),
      }),
    }),
  ),
});

export function parseUploads(json: unknown, since: Date): RawItem[] {
  return Playlist.parse(json)
    .items.filter((i) => new Date(i.snippet.publishedAt) >= since)
    .map((i) => ({
      url: `https://www.youtube.com/watch?v=${i.snippet.resourceId.videoId}`,
      title: `${i.snippet.title} (${i.snippet.channelTitle})`,
      snippet: i.snippet.description.slice(0, 500),
      publishedAt: i.snippet.publishedAt,
      source: "youtube",
      sourceTier: "B" as const,
    }));
}

const Search = z.object({
  items: z.array(
    z.object({
      id: z.object({ videoId: z.string().optional() }),
      snippet: z.object({ title: z.string(), description: z.string(), publishedAt: z.string(), channelTitle: z.string() }),
    }),
  ),
});

export function parseSearch(json: unknown): RawItem[] {
  return Search.parse(json)
    .items.filter((i) => i.id.videoId)
    .map((i) => ({
      url: `https://www.youtube.com/watch?v=${i.id.videoId}`,
      title: `${i.snippet.title} (${i.snippet.channelTitle})`,
      snippet: i.snippet.description,
      publishedAt: i.snippet.publishedAt,
      source: "youtube",
      sourceTier: "B" as const,
    }));
}

export const youtubeSource: SignalSource = {
  name: "youtube",
  enabled: (vc) => !!process.env.YOUTUBE_API_KEY && !!(vc.youtube_channel_id || vc.partner_name),
  async fetchForVc(vc, since) {
    const items: RawItem[] = [];
    const key = process.env.YOUTUBE_API_KEY!;
    if (vc.youtube_channel_id?.startsWith("UC")) {
      const uploads = `UU${vc.youtube_channel_id.slice(2)}`; // a channel's uploads playlist
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=10&playlistId=${uploads}&key=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`youtube uploads ${res.status}`);
      items.push(...parseUploads(await res.json(), since));
    }
    if (vc.partner_name) {
      const q = `"${vc.partner_name}" ${vc.firm.replace(/\(.*?\)/g, "").trim()}`;
      const url =
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&order=date` +
        `&publishedAfter=${since.toISOString()}&q=${encodeURIComponent(q)}&key=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`youtube search ${res.status}`);
      items.push(...parseSearch(await res.json()));
    }
    return items;
  },
};
