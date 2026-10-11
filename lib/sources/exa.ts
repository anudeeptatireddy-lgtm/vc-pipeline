// Web search source (docs/signal-sources.md §1.3/§1.4): news and posts by the
// partner or firm in the window. Tavily first, Exa only as fallback (lib/search.ts).
// File name kept for history; the source is reported as "web-search".
import { webSearch } from "../search";
import type { RawItem, SignalSource, Vc } from "../types";
import { tierForUrl } from "./tiers";

const firmName = (vc: Vc) => vc.firm.replace(/\(.*?\)/g, "").trim();

export const exaSource: SignalSource = {
  name: "web-search",
  enabled: () => !!(process.env.TAVILY_API_KEY || process.env.EXA_API_KEY),
  async fetchForVc(vc, since) {
    // One search per VC: the firm (and partner) in recent news. Gemini's own
    // Google Search covers the long tail for free.
    const query = `${firmName(vc)}${vc.partner_name ? ` ${vc.partner_name}` : ""} venture capital investment funding`;
    const hits = await webSearch({ query, kind: "news", days: 30, maxResults: 10 });
    const items: RawItem[] = [];
    for (const h of hits) {
      // Undated pages can never pass the 30-day check; drop them before Gemini.
      if (!h.publishedAt || new Date(h.publishedAt) < since) continue;
      items.push({ url: h.url, title: h.title, snippet: h.snippet, publishedAt: h.publishedAt, source: "web-search", sourceTier: tierForUrl(h.url, vc) });
    }
    return items;
  },
};
