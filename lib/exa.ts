// Exa search client (docs/signal-sources.md §1.3). Every response is zod-validated.
import { z } from "zod";

const ExaResult = z.object({
  url: z.string(),
  title: z.string().nullish(),
  publishedDate: z.string().nullish(),
  author: z.string().nullish(),
  text: z.string().nullish(),
});
const ExaResponse = z.object({
  results: z.array(ExaResult),
  costDollars: z.object({ total: z.number() }).partial().nullish(),
});
export type ExaResult = z.infer<typeof ExaResult>;

export interface ExaSearch {
  query: string;
  category?: "company" | "people" | "news" | "research paper" | "personal site" | "financial report";
  numResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  textChars?: number;
}

export interface ExaUsage {
  calls: number;
  dollars: number;
}
export const exaUsage: ExaUsage = { calls: 0, dollars: 0 };

export async function exaSearch(s: ExaSearch): Promise<ExaResult[]> {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new Error("EXA_API_KEY is not set");
  const body: Record<string, unknown> = {
    query: s.query,
    type: "auto",
    numResults: s.numResults ?? 5,
    contents: { text: { maxCharacters: s.textChars ?? 800 } },
  };
  if (s.category) body.category = s.category;
  if (s.includeDomains) body.includeDomains = s.includeDomains;
  if (s.excludeDomains) body.excludeDomains = s.excludeDomains;
  if (s.startPublishedDate) body.startPublishedDate = s.startPublishedDate;

  const call = () =>
    fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  let res: Response;
  try {
    res = await call();
    if (res.status === 429 || res.status >= 500) throw new Error(`exa ${res.status}`);
  } catch {
    // One retry on network errors, timeouts, 429 and 5xx.
    await new Promise((r) => setTimeout(r, 1500));
    res = await call().catch((e) => {
      throw new Error(`exa: ${(e as Error).message}`);
    });
  }
  exaUsage.calls++;
  if (!res.ok) throw new Error(`exa ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const parsed = ExaResponse.parse(await res.json());
  exaUsage.dollars += parsed.costDollars?.total ?? 0;
  return parsed.results;
}
