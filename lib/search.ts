// Web search for the pipeline: Tavily first (free tier, 1,000 credits/month),
// Exa only as a small fallback when Tavily errors or the monthly Tavily cap is
// reached. Exa credits are kept for the submission (owner's instruction).
import { z } from "zod";
import { exaSearch } from "./exa";
import { q } from "./sql";

export interface SearchHit {
  url: string;
  title: string;
  snippet: string;
  publishedAt?: string; // ISO
  provider: "tavily" | "exa";
}

export interface SearchQuery {
  query: string;
  kind: "news" | "general";
  days?: number; // look-back window; 0 = no date filter (e.g. profiles)
  includeDomains?: string[];
  maxResults?: number;
}

/** Monthly Tavily budget. Free tier is 1,000 basic searches; stay safely under it. */
export const TAVILY_MONTHLY_CAP = Number(process.env.TAVILY_MONTHLY_CAP ?? 950);

export const searchUsage = { tavily: 0, exa: 0, exaFallbacks: 0 };

let monthUsed: number | null = null;

/** Tavily calls already made this calendar month (from pipeline_runs.usage). */
async function tavilyUsedThisMonth(): Promise<number> {
  if (monthUsed !== null) return monthUsed + searchUsage.tavily;
  try {
    const [row] = await q<{ n: number }>(
      `select coalesce(sum((usage->'search'->>'tavily')::int), 0)::int as n
       from pipeline_runs where started_at >= date_trunc('month', now())`,
    );
    monthUsed = row?.n ?? 0;
  } catch {
    monthUsed = 0;
  }
  return monthUsed + searchUsage.tavily;
}

const TavilyResponse = z.object({
  results: z.array(
    z.object({
      url: z.string(),
      title: z.string().nullish(),
      content: z.string().nullish(),
      published_date: z.string().nullish(),
    }),
  ),
});

async function tavily(s: SearchQuery): Promise<SearchHit[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY is not set");
  const body: Record<string, unknown> = {
    query: s.query,
    topic: s.kind,
    max_results: s.maxResults ?? 10,
    search_depth: "basic", // 1 credit
  };
  if (s.kind === "news") body.days = s.days || 30;
  else if (s.days !== 0) body.time_range = (s.days ?? 30) <= 7 ? "week" : (s.days ?? 30) <= 31 ? "month" : "year";
  if (s.includeDomains) body.include_domains = s.includeDomains;
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  searchUsage.tavily++;
  if (!res.ok) throw new Error(`tavily ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return TavilyResponse.parse(await res.json()).results.map((r) => {
    const d = r.published_date ? new Date(r.published_date) : null;
    return {
      url: r.url,
      title: r.title ?? "",
      snippet: (r.content ?? "").slice(0, 600),
      publishedAt: d && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined,
      provider: "tavily" as const,
    };
  });
}

/** Exa, deliberately small: 5 results, short text. */
async function exaSmall(s: SearchQuery): Promise<SearchHit[]> {
  searchUsage.exa++;
  const results = await exaSearch({
    query: s.query,
    numResults: Math.min(s.maxResults ?? 5, 5),
    startPublishedDate: s.days === 0 ? undefined : new Date(Date.now() - (s.days ?? 30) * 86_400_000).toISOString(),
    includeDomains: s.includeDomains,
    textChars: 300,
  });
  return results.map((r) => ({ url: r.url, title: r.title ?? "", snippet: r.text ?? "", publishedAt: r.publishedDate ?? undefined, provider: "exa" as const }));
}

/** Tavily first; Exa only if Tavily fails or this month's Tavily cap is reached. */
export async function webSearch(s: SearchQuery): Promise<SearchHit[]> {
  const underCap = (await tavilyUsedThisMonth()) < TAVILY_MONTHLY_CAP;
  if (underCap) {
    try {
      return await tavily(s);
    } catch {
      // fall through to Exa
    }
  }
  if (!process.env.EXA_API_KEY) return [];
  searchUsage.exaFallbacks++;
  return exaSmall(s);
}
