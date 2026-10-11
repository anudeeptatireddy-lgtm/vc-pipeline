// LinkedIn via a search index only (docs/signal-sources.md §1.6): we never
// fetch linkedin.com. Dates come from the activity ID in the URL.
import { exaSearch } from "../exa";
import { linkedinUrlDate } from "../linkedin-date";
import type { RawItem, SignalSource } from "../types";

export const linkedinIndexSource: SignalSource = {
  name: "linkedin-index",
  enabled: (vc) => !!(process.env.EXA_API_KEY && vc.partner_name),
  async fetchForVc(vc, since) {
    const results = await exaSearch({
      query: `${vc.partner_name} post about logistics, supply chain, freight or a new investment`,
      includeDomains: ["linkedin.com"],
      startPublishedDate: since.toISOString(),
      numResults: 8,
      textChars: 500,
    });
    return results
      .filter((r) => /linkedin\.com\/(posts|feed\/update|pulse)\//.test(r.url))
      .map((r): RawItem => ({
        url: r.url,
        title: r.title ?? "",
        snippet: r.text ?? undefined,
        publishedAt: linkedinUrlDate(r.url)?.toISOString() ?? r.publishedDate ?? undefined,
        source: "linkedin-index",
        sourceTier: "D",
      }));
  },
};
