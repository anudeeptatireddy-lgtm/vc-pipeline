// Exa semantic search (docs/signal-sources.md §1.3): essays, posts and
// coverage by the partner or firm, restricted to the window by publish date.
import { exaSearch } from "../exa";
import type { RawItem, SignalSource, Vc } from "../types";
import { tierForUrl } from "./tiers";

const firmName = (vc: Vc) => vc.firm.replace(/\(.*?\)/g, "").trim();

// Funding-news and trade-press sites, searched by name. Their RSS feeds only
// hold the last 1–3 days, so a 30-day window needs a search index instead.
export const NEWS_DOMAINS_INDIA = [
  "inc42.com", "yourstory.com", "entrackr.com", "economictimes.indiatimes.com", "vccircle.com",
  "livemint.com", "moneycontrol.com", "business-standard.com", "thehindubusinessline.com",
];
export const NEWS_DOMAINS_GLOBAL = [
  "techcrunch.com", "freightwaves.com", "supplychaindive.com", "theloadstar.com", "joc.com",
  "businesswire.com", "prnewswire.com", "axios.com", "fortune.com",
];

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

    const india = /india/i.test(vc.region ?? "");
    const searches = [
      ...queries.map((query) => ({ query, includeDomains: undefined as string[] | undefined })),
      {
        query: `${firmName(vc)} invests leads funding round startup`,
        includeDomains: india ? [...NEWS_DOMAINS_INDIA, ...NEWS_DOMAINS_GLOBAL.slice(0, 5)] : NEWS_DOMAINS_GLOBAL,
      },
    ];
    const items: RawItem[] = [];
    for (const { query, includeDomains } of searches) {
      const results = await exaSearch({ query, numResults: 8, startPublishedDate: start, textChars: 500, includeDomains });
      for (const r of results) {
        // Undated pages (directories, profiles) can never pass the 30-day check;
        // dropping them here stops them crowding real news out of Gemini's prompt.
        if (!r.publishedDate || new Date(r.publishedDate) < since) continue;
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
