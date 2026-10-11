// Portfolio diffing, pure parts (docs/signal-sources.md §6 steps 3–7).
import { createHash } from "node:crypto";
import * as cheerio from "cheerio";

export interface Entry {
  name: string;
  domain?: string;
}

const NOT_A_COMPANY = /(^|\.)(linkedin|twitter|x|facebook|instagram|youtube|medium|substack|github|google|apple|crunchbase|angel|wellfound|calendly|typeform|notion|webflow|wix|squarespace|wordpress|gstatic|cloudflare|jsdelivr|vimeo|spotify|tiktok|bsky|threads|whatsapp|t)\.(com|co|io|me|app|net|org|so|site|ly)$/i;

const host = (u: URL) => u.hostname.replace(/^www\./, "").toLowerCase();

const GENERIC_TEXT = /^(view website|visit( website)?|website|here|text link|explore|learn more|read more|read here|more|link|image \d+|download.*)$/i;

function cleanName(s: string): string {
  const t = s.replace(/\s+/g, " ").trim().slice(0, 60);
  return GENERIC_TEXT.test(t) ? "" : t;
}

const slugName = (path: string) =>
  decodeURIComponent(path.split("/").filter(Boolean).pop() ?? "").replace(/[-_]+/g, " ").trim();

/**
 * Company entries: outbound links to other domains (keyed by domain), plus
 * internal profile pages under the portfolio path such as /portfolio/acme
 * (keyed by slug), named by link text, logo alt, or the domain/slug.
 */
export function extractEntries(html: string, pageUrl: string): Entry[] {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, header").remove();
  const page = new URL(pageUrl);
  const own = host(page);
  const base = page.pathname.replace(/\/+$/, "");
  const out = new Map<string, Entry>();
  $("a[href]").each((_, el) => {
    let u: URL;
    try {
      u = new URL($(el).attr("href")!, pageUrl);
    } catch {
      return;
    }
    if (!/^https?:$/.test(u.protocol)) return;
    const h = host(u);
    const label = cleanName($(el).text()) || cleanName($(el).find("img").attr("alt") ?? "");
    if (h === own || h.endsWith(`.${own}`)) {
      const path = u.pathname.replace(/\/+$/, "");
      // A child of the portfolio page, one level down: /portfolio/acme
      if (base && path.startsWith(`${base}/`) && !path.slice(base.length + 1).includes("/")) {
        const key = `${own}${path}`;
        if (!out.has(key)) out.set(key, { name: label || slugName(path), domain: key });
      }
      return;
    }
    if (NOT_A_COMPANY.test(h)) return;
    if (!out.has(h)) out.set(h, { name: label || h, domain: h });
  });
  return [...out.values()];
}

const GENERIC_ALT = /\b(icon|arrow|menu|banner|background|image|photo|picture|avatar|hero|close|search|play|button|placeholder|team|founder|partner|linkedin|twitter|facebook|instagram|youtube)\b/i;

/**
 * Logo walls: company names only in <img alt>. Used when a page has too few
 * company links. Keys are canonical names (no domain available).
 */
export function extractLogoEntries(html: string, ownFirm = ""): Entry[] {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, header").remove();
  const own = ownFirm.toLowerCase();
  const out = new Map<string, Entry>();
  $("img[alt]").each((_, el) => {
    // "Zepto logo" / "Logo of Zepto" -> "Zepto"
    const alt = ($(el).attr("alt") ?? "").replace(/\b(company\s+)?logo(\s+of)?\b/gi, " ").replace(/[-_|]+$/g, "").replace(/\s+/g, " ").trim();
    if (alt.length < 2 || alt.length > 40 || alt.split(" ").length > 4) return;
    if (GENERIC_ALT.test(alt) || /\.(png|jpe?g|svg|webp)$/i.test(alt) || (own && alt.toLowerCase().includes(own))) return;
    const key = canonical({ name: alt });
    if (key.length >= 2 && !out.has(key)) out.set(key, { name: alt });
  });
  return [...out.values()];
}

/** Same, for Jina Reader markdown: [text](url). */
export function extractEntriesFromMarkdown(md: string, pageUrl: string): Entry[] {
  const own = host(new URL(pageUrl));
  const out = new Map<string, Entry>();
  const flat = md.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1"); // logo images → their alt text
  for (const m of flat.matchAll(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)) {
    let u: URL;
    try {
      u = new URL(m[2]!);
    } catch {
      continue;
    }
    const h = host(u);
    if (h === own || h.endsWith(`.${own}`) || NOT_A_COMPANY.test(h)) continue;
    const name = cleanName(m[1]!) || h;
    if (!out.has(h)) out.set(h, { name, domain: h });
  }
  return [...out.values()];
}

export function canonical(e: Entry): string {
  const name = e.name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|pvt|technologies|technology|labs|ai)\b\.?/g, "")
    .replace(/[^a-z0-9]/g, "");
  return e.domain ? e.domain.replace(/^www\./, "").toLowerCase() : name;
}

export function hashEntries(entries: Entry[]): string {
  const keys = [...new Set(entries.map(canonical))].sort();
  return createHash("sha256").update(keys.join("\n")).digest("hex");
}

export function diffPortfolio(prev: Entry[], curr: Entry[]) {
  const p = new Map(prev.map((e) => [canonical(e), e]));
  const c = new Map(curr.map((e) => [canonical(e), e]));
  const added = [...c.keys()].filter((k) => !p.has(k)).map((k) => c.get(k)!);
  const removed = [...p.keys()].filter((k) => !c.has(k)).map((k) => p.get(k)!);
  return { added, removed };
}

/**
 * Debounced additions (§6 step 7): an entry alerts when it is in the current
 * snapshot AND the previous one, but not the one before that. Needs three
 * snapshots, so nothing alerts on a firm's first or second run.
 * `snapshots` is oldest → newest, current last.
 */
export function confirmedAdditions(snapshots: Entry[][]): Entry[] {
  if (snapshots.length < 3) return [];
  const [older, prev, curr] = snapshots.slice(-3) as [Entry[], Entry[], Entry[]];
  const prevKeys = new Set(prev.map(canonical));
  return diffPortfolio(older, curr).added.filter((e) => prevKeys.has(canonical(e)));
}
