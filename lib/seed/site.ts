// Pure HTML helpers for scripts/seed-vcs.ts. No network here, so they're
// testable against saved fixtures.
import * as cheerio from "cheerio";

// Words that don't identify a firm on their own.
const GENERIC = new Set([
  "ventures", "venture", "capital", "partners", "partner", "fund", "funds", "india", "global",
  "vc", "the", "and", "of", "investments", "group", "growth", "invest", "management",
]);

/** Distinctive lowercase tokens of a firm name: "Peak XV Partners (Surge)" -> ["peak", "xv"]. */
export function firmTokens(firm: string): string[] {
  const base = firm.replace(/\(.*?\)/g, " ").toLowerCase();
  const tokens = base.split(/[^a-z0-9]+/).filter((t) => t && !GENERIC.has(t));
  // "8VC", "100X.VC" -> keep the whole thing when nothing distinctive survives.
  return tokens.length ? tokens : base.split(/\s+/).filter(Boolean);
}

/** Visible text: title, meta site name/description, and body text (first 20k chars). */
export function pageText(html: string): { title: string; text: string } {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();
  const title = [
    $("title").first().text(),
    $('meta[property="og:site_name"]').attr("content") ?? "",
    $('meta[property="og:title"]').attr("content") ?? "",
    $('meta[name="description"]').attr("content") ?? "",
  ].join(" ");
  const text = $("body").text().replace(/\s+/g, " ").slice(0, 20000);
  return { title: title.replace(/\s+/g, " ").trim(), text };
}

/** True when every distinctive firm token appears as a word in the page. */
export function pageMatchesFirm(html: string, firm: string): boolean {
  const { title, text } = pageText(html);
  const hay = `${title} ${text}`.toLowerCase();
  return firmTokens(firm).every((t) => new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(hay));
}

const INVESTOR_WORDS = /\b(portfolio|invest(s|ed|ing|ment|ments|or|ors)?|venture|ventures|founders|fund|funds|seed)\b/i;

/** Firm name present AND the page talks like an investor ("Mela" != melawater.com). */
export function isFirmSite(html: string, firm: string): boolean {
  if (!pageMatchesFirm(html, firm)) return false;
  const { title, text } = pageText(html);
  return INVESTOR_WORDS.test(`${title} ${text}`);
}

export interface SiteLinks {
  portfolio: string[];
  team: string[];
  feeds: string[];
  substackOrMedium: string[];
  youtube: string[];
  linkedinCompany: string[];
}

const PORTFOLIO_RE = /portfolio|companies|investments|founders/i;
const TEAM_RE = /\b(team|people|about-us|our-team|who-we-are|partners)\b/i;

function sameSite(a: URL, b: URL): boolean {
  const strip = (h: string) => h.replace(/^www\./, "");
  return strip(a.hostname) === strip(b.hostname);
}

export function extractSiteLinks(html: string, baseUrl: string): SiteLinks {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const out: SiteLinks = { portfolio: [], team: [], feeds: [], substackOrMedium: [], youtube: [], linkedinCompany: [] };
  const add = (list: string[], url: string) => {
    if (!list.includes(url)) list.push(url);
  };

  $('link[rel="alternate"]').each((_, el) => {
    const type = $(el).attr("type") ?? "";
    const href = $(el).attr("href");
    if (href && /rss|atom/.test(type)) {
      try {
        add(out.feeds, new URL(href, base).toString());
      } catch {}
    }
  });

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")!;
    let u: URL;
    try {
      u = new URL(href, base);
    } catch {
      return;
    }
    if (!/^https?:$/.test(u.protocol)) return;
    u.hash = "";
    const label = `${$(el).text()} ${u.pathname}`;
    const url = u.toString();

    if (sameSite(u, base)) {
      if (u.pathname === "/" || u.pathname === "") return;
      if (PORTFOLIO_RE.test(label)) add(out.portfolio, url);
      else if (TEAM_RE.test(label)) add(out.team, url);
    } else if (/(^|\.)substack\.com$/.test(u.hostname) || u.hostname === "medium.com") {
      add(out.substackOrMedium, url);
    } else if (/(^|\.)youtube\.com$/.test(u.hostname) && /^\/(channel\/|@|c\/|user\/)/.test(u.pathname)) {
      add(out.youtube, url);
    } else if (/(^|\.)linkedin\.com$/.test(u.hostname) && u.pathname.startsWith("/company/")) {
      add(out.linkedinCompany, url);
    }
  });
  return out;
}

/** substack/medium profile link -> its RSS feed URL. */
export function feedForBlog(url: string): string | null {
  const u = new URL(url);
  if (u.hostname.endsWith(".substack.com")) return `${u.origin}/feed`;
  if (u.hostname === "medium.com") {
    const first = u.pathname.split("/").filter(Boolean)[0];
    return first ? `https://medium.com/feed/${first}` : null;
  }
  return null;
}

/** YouTube channel id from a /channel/ URL or from the HTML of an @handle page. */
export function youtubeChannelId(url: string, html?: string): string | null {
  const direct = url.match(/\/channel\/(UC[\w-]{22})/);
  if (direct) return direct[1]!;
  if (!html) return null;
  const m =
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/) ??
    html.match(/"externalId":"(UC[\w-]{22})"/) ??
    html.match(/"channelId":"(UC[\w-]{22})"/);
  return m ? m[1]! : null;
}

/** linkedin.com/in/<slug> only (person profiles), normalised. */
export function normaliseLinkedinProfile(url: string): string | null {
  const m = url.match(/^https?:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com\/in\/([^/?#]+)/i);
  return m ? `https://www.linkedin.com/in/${m[3]}` : null;
}
