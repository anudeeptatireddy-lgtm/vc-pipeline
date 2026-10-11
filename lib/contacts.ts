// Who to contact at a firm: pure helpers over a firm's own pages.
// Emails are only those the firm publishes (mailto or visible text); never guessed.
import * as cheerio from "cheerio";

export type PocLevel = "decision_maker" | "partner" | "principal" | "associate" | "other";

/** Point-of-contact level from a title. Order matters: "Managing Partner" before "Partner". */
export function pocLevel(title: string | null | undefined): PocLevel {
  const t = (title ?? "").toLowerCase();
  if (/\b(managing (director|partner)|general partner|founding partner|co-?founder|founder|\bgp\b|chief investment officer|cio)\b/.test(t)) return "decision_maker";
  if (/\b(venture partner|partner)\b/.test(t)) return "partner";
  if (/\b(principal|vice president|\bvp\b|director|investment director|head of)\b/.test(t)) return "principal";
  if (/\b(associate|analyst|investment manager|fellow)\b/.test(t)) return "associate";
  return "other";
}

const RELEVANT = /\b(logistic\w*|supply[- ]chain|freight|shipping|fleet|warehous\w*|b2b|saas|enterprise|mobility|industrial|procurement|transport\w*)\b/i;
export const isRelevant = (text: string) => RELEVANT.test(text);

const LEVEL_ORDER: Record<PocLevel, number> = { decision_maker: 0, partner: 1, principal: 2, associate: 3, other: 4 };

/** Best first: relevant decision-makers, relevant partners, then by level. */
export function rankContacts<T extends { poc_level: PocLevel; relevant: boolean }>(people: T[]): T[] {
  const score = (p: T) => LEVEL_ORDER[p.poc_level] * 2 - (p.relevant ? 3 : 0);
  return [...people].sort((a, b) => score(a) - score(b));
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const NOT_EMAIL = /\.(png|jpe?g|gif|svg|webp)$|@(2x|3x)\b|example\.com|sentry|wixpress|domain\.com/i;

/** Emails the page publishes (mailto links and visible text). */
export function findEmails(html: string): string[] {
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $('a[href^="mailto:"]').each((_, el) => {
    const addr = decodeURIComponent(($(el).attr("href") ?? "").slice(7).split("?")[0]!).trim().toLowerCase();
    if (addr && !NOT_EMAIL.test(addr)) out.add(addr);
  });
  $("script, style, noscript").remove();
  for (const m of $("body").text().matchAll(EMAIL)) {
    const addr = m[0].toLowerCase().replace(/\.$/, "");
    if (!NOT_EMAIL.test(addr)) out.add(addr);
  }
  return [...out];
}

/** "Submit your pitch" / apply links on the firm's own domain (or a form host). */
export function findPitchLinks(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);
  const own = base.hostname.replace(/^www\./, "");
  const out = new Set<string>();
  $("a[href]").each((_, el) => {
    const text = `${$(el).text()} ${$(el).attr("href")}`.toLowerCase();
    if (!/\b(pitch|apply|submit|raise|get funded|founders? form|application)\b/.test(text)) return;
    try {
      const u = new URL($(el).attr("href")!, base);
      const host = u.hostname.replace(/^www\./, "");
      if (host === own || host.endsWith(`.${own}`) || /typeform|forms\.gle|google\.com|airtable|hubspot|jotform|tally\.so|docsend/.test(host)) out.add(u.toString());
    } catch {}
  });
  return [...out];
}

export function findXLink(html: string): string | null {
  const $ = cheerio.load(html);
  let x: string | null = null;
  $("a[href]").each((_, el) => {
    const h = $(el).attr("href") ?? "";
    if (!x && /^https?:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]+\/?$/.test(h) && !/\/(share|intent|home)\b/.test(h)) x = h;
  });
  return x;
}

/**
 * LinkedIn / X profile links on a team page, matched to people by the card
 * that contains both the link and the person's name.
 */
export function profileLinksByName(html: string, names: string[]): Record<string, { linkedin?: string; x?: string }> {
  const $ = cheerio.load(html);
  const out: Record<string, { linkedin?: string; x?: string }> = {};
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const isLi = /linkedin\.com\/in\//.test(href);
    const isX = /^https?:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]+\/?$/.test(href);
    if (!isLi && !isX) return;
    let node = $(el).parent();
    for (let depth = 0; depth < 5 && node.length; depth++, node = node.parent()) {
      const text = node.text().replace(/\s+/g, " ");
      const hits = names.filter((n) => text.includes(n));
      if (hits.length === 1) {
        const rec = (out[hits[0]!] ??= {});
        if (isLi) rec.linkedin ??= href.split("?")[0];
        else rec.x ??= href;
        return;
      }
      if (hits.length > 1) return; // container holds several people: ambiguous
    }
  });
  return out;
}

/** A published email that belongs to this person (local part matches their name). */
export function personalEmail(name: string, emails: string[]): string | null {
  const parts = name.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
  const first = parts[0];
  const last = parts.at(-1);
  return emails.find((e) => {
    const local = e.split("@")[0]!;
    return (!!first && local.includes(first)) || (!!last && local.includes(last));
  }) ?? null;
}

/** Firm-level emails: generic inboxes (pitch@, hello@ ...), not people. */
export function firmEmails(emails: string[], peopleNames: string[]): string[] {
  return emails.filter((e) => !peopleNames.some((n) => personalEmail(n, [e])));
}
