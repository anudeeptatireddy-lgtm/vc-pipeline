// LinkedIn via a search index only (docs/signal-sources.md §1.6): we never
// fetch linkedin.com. Dates come from the activity ID in the URL.
import { linkedinUrlDate } from "../linkedin-date";
import { webSearch } from "../search";
import type { RawItem, SignalSource } from "../types";

export const linkedinIndexSource: SignalSource = {
  name: "linkedin-index",
  enabled: (vc) => !!((process.env.TAVILY_API_KEY || process.env.EXA_API_KEY) && vc.partner_name),
  async fetchForVc(vc, since) {
    const hits = await webSearch({
      query: `${vc.partner_name} logistics supply chain freight investment`,
      kind: "general",
      days: 30,
      includeDomains: ["linkedin.com"],
      maxResults: 8,
    });
    return hits
      .filter((h) => /linkedin\.com\/(posts|feed\/update|pulse)\//.test(h.url))
      .map((h): RawItem => ({
        url: h.url,
        title: h.title,
        snippet: h.snippet,
        publishedAt: linkedinUrlDate(h.url)?.toISOString() ?? h.publishedAt,
        source: "linkedin-index",
        sourceTier: "D",
      }))
      .filter((i) => !i.publishedAt || new Date(i.publishedAt) >= since);
  },
};
