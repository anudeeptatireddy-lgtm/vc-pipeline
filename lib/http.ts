// Polite fetching (CLAUDE.md rule 4): descriptive User-Agent, robots.txt,
// at most one fetch per URL per process, timeouts, no retries on 4xx.

export const USER_AGENT =
  "VCPipelineIntelligence/0.1 (+research bot for a founder's investor watchlist; respects robots.txt)";

export interface FetchResult {
  ok: boolean;
  status: number;
  finalUrl: string;
  contentType: string;
  text: string;
  error?: string;
}

const pageCache = new Map<string, Promise<FetchResult>>();
const robotsCache = new Map<string, Promise<RobotsRules>>();

export interface RobotsRules {
  allow: string[];
  disallow: string[];
}

/** Rules for `User-agent: *` (we have no named entry anywhere). */
export function parseRobots(txt: string): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [] };
  let inStar = false;
  let sawRuleSinceAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "user-agent") {
      // Consecutive user-agent lines share one group.
      if (sawRuleSinceAgent) inStar = false;
      sawRuleSinceAgent = false;
      if (value === "*") inStar = true;
    } else if (key === "allow" || key === "disallow") {
      sawRuleSinceAgent = true;
      if (inStar && value) (key === "allow" ? rules.allow : rules.disallow).push(value);
    }
  }
  return rules;
}

function ruleMatches(rule: string, path: string): boolean {
  const anchored = rule.endsWith("$");
  const body = anchored ? rule.slice(0, -1) : rule;
  const re = new RegExp(
    "^" + body.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (anchored ? "$" : ""),
  );
  return re.test(path);
}

/** Longest matching rule wins; Allow wins ties (Google's semantics). */
export function isAllowed(rules: RobotsRules, path: string): boolean {
  let best = { len: -1, allow: true };
  for (const r of rules.disallow) if (ruleMatches(r, path) && r.length > best.len) best = { len: r.length, allow: false };
  for (const r of rules.allow) if (ruleMatches(r, path) && r.length >= best.len) best = { len: r.length, allow: true };
  return best.allow;
}

async function robotsFor(origin: string): Promise<RobotsRules> {
  let p = robotsCache.get(origin);
  if (!p) {
    p = rawFetch(`${origin}/robots.txt`, 8000).then((r) =>
      r.ok && r.contentType.includes("text/plain") ? parseRobots(r.text) : { allow: [], disallow: [] },
    );
    robotsCache.set(origin, p);
  }
  return p;
}

async function rawFetch(url: string, timeoutMs: number, init: RequestInit = {}): Promise<FetchResult> {
  try {
    const res = await fetch(url, {
      ...init,
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", ...init.headers },
    });
    const contentType = res.headers.get("content-type") ?? "";
    const text = /text|xml|json|html/.test(contentType) ? await res.text() : "";
    return { ok: res.ok, status: res.status, finalUrl: res.url || url, contentType, text };
  } catch (e) {
    return { ok: false, status: 0, finalUrl: url, contentType: "", text: "", error: (e as Error).message };
  }
}

/** GET a public page once per process, honouring robots.txt. */
export function politeFetch(url: string, timeoutMs = 15000): Promise<FetchResult> {
  const cached = pageCache.get(url);
  if (cached) return cached;
  const p = (async () => {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return { ok: false, status: 0, finalUrl: url, contentType: "", text: "", error: "invalid url" };
    }
    const rules = await robotsFor(u.origin);
    if (!isAllowed(rules, u.pathname + u.search)) {
      return { ok: false, status: 0, finalUrl: url, contentType: "", text: "", error: "disallowed by robots.txt" };
    }
    return rawFetch(url, timeoutMs);
  })();
  pageCache.set(url, p);
  return p;
}

/** Run `fn` over items with at most `limit` in flight. Errors are the caller's job. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
