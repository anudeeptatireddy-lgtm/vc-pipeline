// Verification in code, never trusted to the model (CLAUDE.md rule 3;
// docs/signal-sources.md §7.3). A signal survives only with a resolved
// non-redirect URL and a publish date within the window.
import * as cheerio from "cheerio";
import { webSearch } from "./search";
import { politeFetch, USER_AGENT } from "./http";
import { linkedinUrlDate } from "./linkedin-date";
import { firmTokens } from "./seed/site";

export const WINDOW_DAYS = 30;

const REDIRECT_HOSTS = [
  "vertexaisearch.cloud.google.com",
  "news.google.com",
  "www.google.com",
  "google.com",
  "t.co",
  "lnkd.in",
  "bit.ly",
  "feedproxy.google.com",
];

export function isRedirectHost(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return REDIRECT_HOSTS.includes(h);
  } catch {
    return true;
  }
}

/** Follow Location headers without downloading pages. */
export async function followRedirects(url: string, maxHops = 6): Promise<string> {
  let current = url;
  for (let i = 0; i < maxHops; i++) {
    let res: Response;
    try {
      res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      return current;
    }
    await res.body?.cancel().catch(() => {});
    const loc = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !loc) return current;
    current = new URL(loc, current).toString();
  }
  return current;
}

/**
 * Google News item links no longer redirect server-side. Find the publisher's
 * own URL by searching the publisher's domain for the exact headline.
 */
export async function resolveGoogleNews(title: string, publisherUrl?: string): Promise<string | null> {
  if (!publisherUrl) return null;
  let host: string;
  try {
    host = new URL(publisherUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  const headline = title.replace(/\s+-\s+[^-]+$/, "").trim(); // drop " - Publisher"
  const results = await webSearch({ query: headline, kind: "general", days: 365, includeDomains: [host], maxResults: 3 });
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const want = norm(headline);
  const hit = results.find((r) => {
    const t = norm(r.title ?? "");
    return t && (t.includes(want.slice(0, 60)) || want.includes(t.slice(0, 60)));
  });
  return hit?.url ?? null;
}

export async function resolveUrl(url: string, title = "", publisherUrl?: string): Promise<string | null> {
  let final = isRedirectHost(url) ? await followRedirects(url) : url;
  if (new URL(final).hostname === "news.google.com") final = (await resolveGoogleNews(title, publisherUrl)) ?? final;
  return isRedirectHost(final) ? null : final;
}

const TRACKING = /^(utm_|fbclid|gclid|mc_|ref$|ref_src|igshid|trk)/;

export function canonicalUrl(url: string): string {
  const u = new URL(url);
  u.hash = "";
  u.hostname = u.hostname.replace(/^www\./, "").toLowerCase();
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString();
}

/** Publish date from page metadata (first match wins). */
export function pagePublishedDate(html: string): Date | null {
  const $ = cheerio.load(html);
  const candidates: (string | undefined)[] = [
    $('meta[property="article:published_time"]').attr("content"),
    $('meta[property="og:published_time"]').attr("content"),
    $('meta[name="pubdate"]').attr("content"),
    $('meta[name="publish-date"]').attr("content"),
    $('meta[name="date"]').attr("content"),
    $('meta[itemprop="datePublished"]').attr("content"),
    $('[itemprop="datePublished"]').attr("datetime"),
  ];
  $('script[type="application/ld+json"]').each((_, el) => {
    const m = $(el).text().match(/"datePublished"\s*:\s*"([^"]+)"/);
    if (m) candidates.push(m[1]);
  });
  candidates.push($("article time[datetime]").first().attr("datetime"), $("time[datetime]").first().attr("datetime"));
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c);
    if (!Number.isNaN(d.getTime()) && d.getUTCFullYear() > 2000) return d;
  }
  return null;
}

export const toDay = (d: Date) => d.toISOString().slice(0, 10);

export function withinWindow(d: Date, today: Date, days = WINDOW_DAYS): boolean {
  const ms = today.getTime() - d.getTime();
  return ms <= days * 86_400_000 && ms >= -86_400_000; // allow 1 day of timezone skew
}

function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface Candidate {
  url: string;
  title?: string;
  publisherUrl?: string;
  rssDate?: string; // pubDate from a feed
  modelDate?: string; // what Gemini said; last resort
  evidence?: string;
}

export interface Verified {
  url: string;
  publishedDate: string; // YYYY-MM-DD
  dateSource: "page" | "rss" | "linkedin" | "model";
  pageFetched: boolean;
}

export type Rejection = { reject: string };

/**
 * Resolve the URL, recompute the date (page meta → RSS → LinkedIn ID → model),
 * enforce the window and check the page is about this VC.
 */
export async function verifyCandidate(
  c: Candidate,
  who: { firm: string; partnerName: string | null },
  today: Date,
): Promise<Verified | Rejection> {
  if (!c.url || !/^https?:\/\//.test(c.url)) return { reject: "no url" };
  const url = await resolveUrl(c.url, c.title, c.publisherUrl).catch(() => null);
  if (!url) return { reject: "unresolved redirect" };

  const page = /linkedin\.com/.test(url) ? null : await politeFetch(url);
  const html = page?.ok && page.contentType.includes("html") ? page.text : "";

  const candidates: [Date | null, Verified["dateSource"]][] = [
    [html ? pagePublishedDate(html) : null, "page"],
    [parseDate(c.rssDate), "rss"],
    [linkedinUrlDate(url), "linkedin"],
    [parseDate(c.modelDate), "model"],
  ];
  const found = candidates.find(([d]) => d);
  if (!found) return { reject: "no publish date" };
  const [date, dateSource] = found as [Date, Verified["dateSource"]];
  if (!withinWindow(date, today)) return { reject: `outside ${WINDOW_DAYS}-day window (${toDay(date)})` };

  // Entity match: the fetched page (or, if we couldn't read it, the title and
  // evidence) must name the firm or the partner.
  // JS-rendered pages have almost no text in the raw HTML; then also use the
  // page's title/description and the headline + evidence quote.
  const fallback = `${c.title ?? ""} ${c.evidence ?? ""}`;
  let hay = fallback.toLowerCase();
  if (html) {
    const $ = cheerio.load(html);
    const body = $("body").text().replace(/\s+/g, " ");
    const meta = `${$("title").text()} ${$('meta[property="og:title"]').attr("content") ?? ""} ${$('meta[name="description"]').attr("content") ?? ""}`;
    hay = (body.length < 800 ? `${body} ${meta} ${fallback}` : `${body} ${meta}`).toLowerCase();
  }
  const firmHit = firmTokens(who.firm).every((t) => hay.includes(t));
  const surname = who.partnerName?.trim().split(/\s+/).pop()?.toLowerCase();
  const partnerHit = !!surname && surname.length > 2 && hay.includes(surname);
  if (!firmHit && !partnerHit) return { reject: "page doesn't mention the firm or partner" };

  return { url, publishedDate: toDay(date), dateSource, pageFetched: !!html };
}

export interface Dedupable {
  source_url: string;
  company_name: string | null;
  signal_type: string;
  published_date: string;
  confidence: number;
  source_name: string;
  corroborated_by: string | null;
}

/**
 * Dedupe by canonical URL, then by (company, type) within 7 days. Keeps the
 * most confident copy; a duplicate from a different source is recorded in
 * `corroborated_by` (§8.2) rather than lost.
 */
export function dedupe<T extends Dedupable>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => b.confidence - a.confidence);
  const seenUrl = new Set<string>();
  const kept: T[] = [];
  for (const s of sorted) {
    const cu = canonicalUrl(s.source_url);
    if (seenUrl.has(cu)) continue;
    const dup = s.company_name
      ? kept.find(
          (k) =>
            k.company_name?.toLowerCase() === s.company_name!.toLowerCase() &&
            k.signal_type === s.signal_type &&
            Math.abs(Date.parse(k.published_date) - Date.parse(s.published_date)) <= 7 * 86_400_000,
        )
      : undefined;
    if (dup) {
      if (dup.source_name !== s.source_name && !dup.corroborated_by) dup.corroborated_by = s.source_name;
      continue;
    }
    seenUrl.add(cu);
    kept.push(s);
  }
  return kept;
}
