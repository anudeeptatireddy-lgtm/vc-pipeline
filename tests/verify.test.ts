import { describe, expect, it } from "vitest";
import { linkedinActivityDate, linkedinActivityId } from "@/lib/linkedin-date";
import { canonicalUrl, dedupe, isRedirectHost, pagePublishedDate, withinWindow } from "@/lib/verify";

describe("linkedin activity date", () => {
  it("decodes the first 41 bits", () => {
    const ms = Date.UTC(2026, 9, 1, 12, 0, 0);
    const id = ((BigInt(ms) << 22n) | 12345n).toString();
    expect(linkedinActivityDate(id)?.getTime()).toBe(ms);
    expect(linkedinActivityId(`https://www.linkedin.com/posts/jane_freight-activity-${id}-abcd`)).toBe(id);
  });
  it("rejects junk", () => expect(linkedinActivityDate("123")).toBeNull());
});

describe("urls", () => {
  it("canonicalises", () => {
    expect(canonicalUrl("https://www.Example.com/a/?utm_source=x&b=2&a=1#top")).toBe("https://example.com/a?a=1&b=2");
  });
  it("flags redirect hosts", () => {
    expect(isRedirectHost("https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc")).toBe(true);
    expect(isRedirectHost("https://inc42.com/buzz/x")).toBe(false);
  });
});

describe("dates", () => {
  it("reads page metadata, preferring article:published_time", () => {
    const html = `<meta property="article:published_time" content="2026-10-02T09:00:00+05:30"><time datetime="2026-01-01">`;
    expect(pagePublishedDate(html)?.toISOString().slice(0, 10)).toBe("2026-10-02");
    const ld = `<script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2026-09-20"}</script>`;
    expect(pagePublishedDate(ld)?.toISOString().slice(0, 10)).toBe("2026-09-20");
  });
  it("enforces the 30-day window", () => {
    const today = new Date("2026-10-11T00:00:00Z");
    expect(withinWindow(new Date("2026-09-12"), today)).toBe(true);
    expect(withinWindow(new Date("2026-09-10"), today)).toBe(false);
    expect(withinWindow(new Date("2026-10-20"), today)).toBe(false);
  });
});

describe("dedupe", () => {
  const base = { signal_type: "investment", published_date: "2026-10-05", corroborated_by: null as string | null };
  it("drops repeat URLs and same-company repeats, recording corroboration", () => {
    const out = dedupe([
      { ...base, source_url: "https://a.com/x?utm_source=1", company_name: "FreightCo", confidence: 0.7, source_name: "exa" },
      { ...base, source_url: "https://www.a.com/x", company_name: "FreightCo", confidence: 0.6, source_name: "exa" },
      { ...base, source_url: "https://b.com/y", company_name: "freightco", confidence: 0.9, source_name: "inc42" },
      { ...base, source_url: "https://c.com/z", company_name: "OtherCo", confidence: 0.5, source_name: "exa" },
    ]);
    expect(out.map((s) => s.source_url)).toEqual(["https://b.com/y", "https://c.com/z"]);
    expect(out[0]!.corroborated_by).toBe("exa");
  });
});
