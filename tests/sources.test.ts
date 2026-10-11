import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { matchBatch, mentionsVc, vcAliases } from "@/lib/sources/batch-feeds";
import { parseFeed } from "@/lib/sources/feeds";
import { parseEpisodes, podcastAuthHeaders } from "@/lib/sources/podcast-index";
import { parseFormD } from "@/lib/sources/sec-form-d";
import { parseTavily } from "@/lib/sources/tavily";
import { tierForUrl } from "@/lib/sources/tiers";
import { parseSearch } from "@/lib/sources/youtube";
import type { Vc } from "@/lib/types";

const since = new Date("2026-09-11T00:00:00Z");
const xml = readFileSync("tests/fixtures/feed.xml", "utf8");
const vc = (o: Partial<Vc>): Vc => ({ firm: "X", partner_name: null, website: null, rss_url: null, ...o }) as Vc;

describe("feeds", () => {
  it("parses items inside the window only", async () => {
    const items = await parseFeed(xml, "inc42", "C", since);
    expect(items.map((i) => i.url)).toEqual([
      "https://inc42.com/buzz/freightfox-seed/",
      "https://inc42.com/buzz/qc-series-c/",
      "https://inc42.com/buzz/policy/",
    ]);
    expect(items[0]!.publishedAt).toBe("2026-10-05T06:00:00.000Z");
  });
});

describe("batch matching", () => {
  it("builds aliases without generic single words", () => {
    expect(vcAliases({ firm: "Accel India", partner_name: null })).toEqual(["Accel India", "Accel"]);
    expect(vcAliases({ firm: "Z47 (Matrix Partners India)", partner_name: "Avnish Bajaj" })).toEqual([
      "Z47", "Matrix Partners India", "Avnish Bajaj",
    ]);
    expect(vcAliases({ firm: "Prime Venture Partners", partner_name: null })).toEqual(["Prime Venture Partners"]);
  });
  it("matches articles to the right VC", async () => {
    const items = await parseFeed(xml, "inc42", "C", since);
    expect(matchBatch(items, vc({ firm: "Stellaris Venture Partners" })).map((i) => i.url)).toEqual(["https://inc42.com/buzz/freightfox-seed/"]);
    expect(matchBatch(items, vc({ firm: "Accel India" })).map((i) => i.url)).toEqual(["https://inc42.com/buzz/qc-series-c/"]);
    expect(matchBatch(items, vc({ firm: "Prime Venture Partners" }))).toEqual([]);
    expect(mentionsVc("Accelerate your freight", { firm: "Accel India", partner_name: null })).toBe(false);
  });
});

describe("podcast index", () => {
  it("signs requests per the API docs", () => {
    const h = podcastAuthHeaders("KEY", "SECRET", 1_760_000_000_000);
    expect(h["X-Auth-Date"]).toBe("1760000000");
    expect(h.Authorization).toMatch(/^[0-9a-f]{40}$/);
  });
  it("parses episodes in the window", () => {
    const items = parseEpisodes(
      { items: [
        { title: "Freight AI with Santosh", link: "https://pod.example/ep1", feedTitle: "Future of Supply Chain", description: "<p>Talk</p>", datePublished: 1_791_400_000 },
        { title: "Old", link: "https://pod.example/old", datePublished: 1_700_000_000 },
      ] },
      since,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ url: "https://pod.example/ep1", sourceTier: "B", snippet: "Talk" });
  });
});

describe("youtube", () => {
  it("parses search results", () => {
    const items = parseSearch({ items: [
      { id: { videoId: "abc" }, snippet: { title: "Panel", description: "d", publishedAt: "2026-10-01T00:00:00Z", channelTitle: "FreightWaves" } },
      { id: { channelId: "UCx" }, snippet: { title: "Channel", description: "", publishedAt: "2026-10-01T00:00:00Z", channelTitle: "c" } },
    ] });
    expect(items).toEqual([expect.objectContaining({ url: "https://www.youtube.com/watch?v=abc", title: "Panel (FreightWaves)" })]);
  });
});

describe("sec form d", () => {
  it("keeps filings by the named firm", () => {
    const items = parseFormD({ hits: { hits: [
      { _id: "0001234567-26-000001:primary_doc.xml", _source: { ciks: ["0001234567"], display_names: ["Dynamo Ventures Fund IV, L.P.  (CIK 0001234567)"], file_date: "2026-10-02" } },
      { _id: "0009999999-26-000001:primary_doc.xml", _source: { ciks: ["0009999999"], display_names: ["Dynamo Energy LLC"], file_date: "2026-10-03" } },
    ] } }, "Dynamo Ventures");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ url: "https://www.sec.gov/Archives/edgar/data/1234567/000123456726000001/0001234567-26-000001-index.htm", sourceTier: "A", publishedAt: "2026-10-02" });
  });
});

describe("tavily", () => {
  it("parses results", () => {
    expect(parseTavily({ results: [{ url: "https://a.com", title: "T", content: "C", published_date: "2026-10-01" }] })).toEqual([
      { url: "https://a.com", title: "T", snippet: "C", publishedAt: "2026-10-01", source: "tavily" },
    ]);
  });
});

describe("tiers", () => {
  it("rates first-party, social and press", () => {
    const v = vc({ website: "https://dynamo.vc", rss_url: "https://dynamo.substack.com/feed" });
    expect(tierForUrl("https://dynamo.vc/news/fund-iv", v)).toBe("B");
    expect(tierForUrl("https://dynamo.substack.com/p/x", v)).toBe("B");
    expect(tierForUrl("https://www.linkedin.com/posts/x", v)).toBe("D");
    expect(tierForUrl("https://inc42.com/buzz/x", v)).toBe("C");
  });
});

describe("exa source", () => {
  it("maps results into RawItems with tiers", async () => {
    vi.resetModules();
    vi.doMock("@/lib/exa", () => ({
      exaSearch: vi.fn(async () => [
        { url: "https://dynamo.vc/blog/a", title: "A", text: "t", publishedDate: "2026-10-01" },
        { url: "https://directory.example/dynamo", title: "Dynamo profile", text: "t", publishedDate: null }, // undated: dropped
        { url: "https://old.example/x", title: "Old", text: "t", publishedDate: "2026-06-01" }, // before window: dropped
      ]),
    }));
    const { exaSource } = await import("@/lib/sources/exa");
    const items = await exaSource.fetchForVc!(vc({ firm: "Dynamo Ventures", partner_name: "Santosh Sankar", website: "https://dynamo.vc" }), since);
    expect(items).toHaveLength(4); // one dated in-window item per query (3 general + 1 news-site search)
    expect(items[0]).toMatchObject({ url: "https://dynamo.vc/blog/a", source: "exa", sourceTier: "B", publishedAt: "2026-10-01" });
    vi.doUnmock("@/lib/exa");
  });
});

describe("youtube uploads", () => {
  it("parses a channel's uploads playlist inside the window", async () => {
    const { parseUploads } = await import("@/lib/sources/youtube");
    const items = parseUploads({ items: [
      { snippet: { title: "Fund IV", description: "d", publishedAt: "2026-10-01T00:00:00Z", channelTitle: "Dynamo", resourceId: { videoId: "v1" } } },
      { snippet: { title: "Old", description: "d", publishedAt: "2026-01-01T00:00:00Z", channelTitle: "Dynamo", resourceId: { videoId: "v0" } } },
    ] }, since);
    expect(items.map((i) => i.url)).toEqual(["https://www.youtube.com/watch?v=v1"]);
  });
});

describe("gemini pre-filter", () => {
  it("always sends first-party items even when they don't name the firm", async () => {
    const { preFilter } = await import("@/lib/sources/gemini-grounding");
    const v = vc({ firm: "Dynamo Ventures", partner_name: "Santosh Sankar" });
    const items = [
      { url: "https://dynamo.substack.com/p/1", title: "Weekly dispatch", source: "firm-rss", sourceTier: "B" as const },
      { url: "https://x.example/1", title: "Unrelated cooking news", source: "exa", sourceTier: "C" as const },
    ];
    expect(preFilter(items, v).map((i) => i.url)).toEqual(["https://dynamo.substack.com/p/1"]);
  });
});
