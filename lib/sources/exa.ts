// Exa semantic search (docs/signal-sources.md §1.3): essays, posts and
// coverage by the partner or firm, restricted to the window by publish date.
import { exaSearch } from "../exa";
import type { RawItem, SignalSource, Vc } from "../types";
import { tierForUrl } from "./tiers";

const firmName = (vc: Vc) => vc.firm.replace(/\(.*?\)/g, "").trim();

export const exaSource: SignalSource = {
  name: "exa",
  enabled: () => !!process.env.EXA_API_KEY,
  async fetchForVc(vc, since) {
    const start = since.toISOString();
    const queries = [
      vc.partner_name ? `${vc.partner_name} ${firmName(vc)} investor` : null,
      `${firmName(vc)} venture capital seed investment`,
      `${firmName(vc)} logistics supply chain freight startup funding`,
    ].filter((q): q is string => !!q);

    const items: RawItem[] = [];
    for (const query of queries) {
      const results = await exaSearch({ query, numResults: 8, startPublishedDate: start, textChars: 500 });
      for (const r of results) {
        items.push({
          url: r.url,
          title: r.title ?? "",
          snippet: r.text ?? undefined,
          publishedAt: r.publishedDate ?? undefined,
          source: "exa",
          sourceTier: tierForUrl(r.url, vc),
        });
      }
    }
    return items;
  },
};
