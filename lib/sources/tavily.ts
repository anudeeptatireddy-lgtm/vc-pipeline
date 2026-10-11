// Tavily fallback (docs/signal-sources.md §1.4): only called when every other
// source returned nothing for a VC, to save the 1,000 monthly credits.
import { z } from "zod";
import type { RawItem, SignalSource } from "../types";
import { tierForUrl } from "./tiers";

const Response = z.object({
  results: z.array(
    z.object({ url: z.string(), title: z.string().nullish(), content: z.string().nullish(), published_date: z.string().nullish() }),
  ),
});

export function parseTavily(json: unknown): Omit<RawItem, "sourceTier">[] {
  return Response.parse(json).results.map((r) => ({
    url: r.url,
    title: r.title ?? "",
    snippet: r.content ?? undefined,
    publishedAt: r.published_date ?? undefined,
    source: "tavily",
  }));
}

export const tavilySource: SignalSource = {
  name: "tavily",
  fallbackOnly: true,
  enabled: () => !!process.env.TAVILY_API_KEY,
  async fetchForVc(vc) {
    const query = `${vc.partner_name ? `${vc.partner_name} ` : ""}${vc.firm.replace(/\(.*?\)/g, "").trim()} investment OR fund OR logistics`;
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.TAVILY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, topic: "news", days: 30, max_results: 8 }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`tavily ${res.status}`);
    return parseTavily(await res.json()).map((r) => ({ ...r, sourceTier: tierForUrl(r.url, vc) }));
  },
};
