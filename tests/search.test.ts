import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exaSearch = vi.fn(async () => [{ url: "https://exa.example/a", title: "E", text: "t", publishedDate: "2026-10-01" }]);

beforeEach(() => {
  vi.resetModules();
  vi.doMock("@/lib/exa", () => ({ exaSearch, exaUsage: { calls: 0, dollars: 0 } }));
  process.env.TAVILY_API_KEY = "t";
  process.env.EXA_API_KEY = "e";
  exaSearch.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("@/lib/exa");
  vi.doUnmock("@/lib/sql");
});

const tavilyOk = () =>
  vi.fn(async () => new Response(JSON.stringify({ results: [{ url: "https://t.example/a", title: "T", content: "c", published_date: "Thu, 08 Oct 2026 08:00:00 GMT" }] }), { status: 200 }));

describe("webSearch", () => {
  it("uses Tavily first", async () => {
    vi.doMock("@/lib/sql", () => ({ q: vi.fn(async () => [{ n: 0 }]) }));
    vi.stubGlobal("fetch", tavilyOk());
    const { webSearch, searchUsage } = await import("@/lib/search");
    const hits = await webSearch({ query: "x", kind: "news" });
    expect(hits).toEqual([expect.objectContaining({ provider: "tavily", publishedAt: "2026-10-08T08:00:00.000Z" })]);
    expect(exaSearch).not.toHaveBeenCalled();
    expect(searchUsage.tavily).toBe(1);
  });
  it("falls back to a small Exa search when Tavily errors", async () => {
    vi.doMock("@/lib/sql", () => ({ q: vi.fn(async () => [{ n: 0 }]) }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota", { status: 432 })));
    const { webSearch } = await import("@/lib/search");
    const hits = await webSearch({ query: "x", kind: "news", maxResults: 10 });
    expect(hits[0]!.provider).toBe("exa");
    expect(exaSearch).toHaveBeenCalledWith(expect.objectContaining({ numResults: 5, textChars: 300 }));
  });
  it("skips Tavily once the monthly cap is reached", async () => {
    vi.doMock("@/lib/sql", () => ({ q: vi.fn(async () => [{ n: 10_000 }]) }));
    const fetchSpy = tavilyOk();
    vi.stubGlobal("fetch", fetchSpy);
    const { webSearch } = await import("@/lib/search");
    await webSearch({ query: "x", kind: "news" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(exaSearch).toHaveBeenCalled();
  });
});
