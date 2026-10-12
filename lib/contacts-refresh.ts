// Discover who to contact at a firm and draft messages for the top contacts.
// Sources: the firm's own team/contact pages (direct fetch, Jina Reader for
// JS-rendered pages), at most one Tavily lookup per firm for a missing
// LinkedIn. Names must appear on a fetched page; emails must be published.
import { z } from "zod";
import {
  findEmails, findPitchLinks, findXLink, firmEmails, isRelevant, personalEmail, pocLevel, profileLinksByName, rankContacts, type PocLevel,
} from "./contacts";
import { geminiJson } from "./gemini";
import { politeFetch } from "./http";
import { draftMessages, loadFounder, type SignalFacts } from "./messages";
import { webSearch } from "./search";
import { extractSiteLinks, normaliseLinkedinProfile, pageText } from "./seed/site";
import { deleteSql, insertFromJsonSql, insertSql, pickColumns, SYSTEM_WRITE_COLUMNS } from "./ownership";
import { q } from "./sql";
import type { Vc } from "./types";

const TEAM_PATHS = ["/team", "/people", "/our-team", "/team-members", "/about-us", "/about", "/who-we-are"];
const CONTACT_PATHS = ["/contact", "/contact-us", "/pitch", "/apply", "/submit-your-pitch", "/founders"];
const MAX_CONTACTS = 5;
const MESSAGE_CONTACTS = 2;

const People = z.object({
  people: z.array(
    z.object({
      name: z.string(),
      title: z.string(),
      focus: z.string().describe("sectors/stages they say they invest in; empty if not stated"),
      bio: z.string().describe("<= 35 words, only facts from the text"),
      investment_team: z.boolean().describe("true for partners, principals, associates; false for ops, finance, admin"),
    }),
  ),
});

export interface Contact {
  name: string;
  title: string | null;
  poc_level: PocLevel;
  focus: string | null;
  bio: string | null;
  relevant: boolean;
  rank: number;
  linkedin_url: string | null;
  x_url: string | null;
  email: string | null;
  email_source_url: string | null;
  source_url: string;
}

async function jina(url: string): Promise<string> {
  const key = process.env.JINA_API_KEY;
  const res = await fetch(`https://r.jina.ai/${url}`, { headers: { Accept: "text/plain", ...(key ? { Authorization: `Bearer ${key}` } : {}) }, signal: AbortSignal.timeout(30000) }).catch(() => null);
  return res?.ok ? res.text() : "";
}

async function page(url: string) {
  const r = await politeFetch(url);
  if (!r.ok || !r.contentType.includes("html")) return null;
  return { url: r.finalUrl, html: r.text, text: pageText(r.text).text };
}

export interface Channels {
  pitch_url: string | null;
  emails: string[];
  email_sources: string[];
  x_url: string | null;
  contact_url: string | null;
  email_hidden_from_bots: boolean;
}

export async function discoverContacts(vc: Vc): Promise<{ contacts: Contact[]; channels: Channels }> {
  const site = vc.website!;
  const home = await page(site);
  const teamLinks = home ? extractSiteLinks(home.html, home.url).team : [];
  const teamCandidates = [...new Set([vc.team_url, ...teamLinks, ...TEAM_PATHS.map((p) => `${site}${p}`)].filter((u): u is string => !!u))];

  // Team pages (skip /team redirecting to a portfolio company).
  const teamPages: { url: string; html: string; text: string }[] = [];
  for (const c of teamCandidates.slice(0, 8)) {
    if (teamPages.length >= 2) break;
    const p = await page(c);
    if (!p || /\/(portfolio|companies)\//i.test(new URL(p.url).pathname) || teamPages.some((t) => t.url === p.url)) continue;
    let text = p.text;
    if (text.length < 1500) text = (await jina(p.url)).slice(0, 15000);
    if (/partner|principal|associate|managing|founder|director/i.test(text)) teamPages.push({ ...p, text });
  }

  const contactPages = (await Promise.all(CONTACT_PATHS.map((p) => page(`${site}${p}`)))).filter((p): p is NonNullable<typeof p> => !!p);
  const allPages = [...(home ? [home] : []), ...teamPages, ...contactPages];

  // People, from the team pages' text only.
  let people: z.infer<typeof People>["people"] = [];
  const teamText = teamPages.map((t) => `PAGE ${t.url}\n${t.text.slice(0, 9000)}`).join("\n\n");
  if (teamText) {
    try {
      ({ data: { people } } = await geminiJson(
        `List the people at the venture firm ${vc.firm} named in this text, with their titles. Use ONLY the text.\n\n${teamText.slice(0, 20000)}`,
        People,
        { timeoutMs: 60_000 },
      ));
    } catch {}
  }
  const lower = teamText.toLowerCase();
  people = people.filter((p) => p.investment_team && p.name.split(/\s+/).filter((x) => x.length > 1).every((x) => lower.includes(x.toLowerCase())));
  if (people.length === 0 && vc.partner_name) {
    people = [{ name: vc.partner_name, title: "Partner", focus: "", bio: "", investment_team: true }];
  }

  const names = people.map((p) => p.name);
  const links: Record<string, { linkedin?: string; x?: string }> = {};
  for (const t of teamPages) Object.assign(links, profileLinksByName(t.html, names));

  // Only addresses on the firm's own domain count (pages also list portfolio companies' emails).
  const firmHost = new URL(site).hostname.replace(/^www\./, "");
  const onFirmDomain = (e: string) => {
    const d = e.split("@")[1] ?? "";
    return d === firmHost || d.endsWith(`.${firmHost}`) || firmHost.endsWith(`.${d}`);
  };
  const emailsBySource = allPages.flatMap((p) => findEmails(p.html).filter(onFirmDomain).map((e) => ({ e, src: p.url })));
  const emails = [...new Set(emailsBySource.map((x) => x.e))];

  const ranked = rankContacts(
    people.map((p) => ({
      ...p,
      poc_level: pocLevel(p.title),
      relevant: isRelevant(`${p.title} ${p.focus} ${p.bio}`),
    })),
  ).slice(0, MAX_CONTACTS);

  const contacts: Contact[] = [];
  for (const [i, p] of ranked.entries()) {
    const own = personalEmail(p.name, emails);
    let linkedin = links[p.name]?.linkedin ? normaliseLinkedinProfile(links[p.name]!.linkedin!) : null;
    if (!linkedin && vc.partner_name === p.name && vc.linkedin_url) linkedin = vc.linkedin_url;
    if (!linkedin && i === 0) {
      // One Tavily lookup per firm, for the top contact only.
      const hits = await webSearch({ query: `${p.name} ${vc.firm.replace(/\(.*?\)/g, "").trim()}`, kind: "general", days: 0, includeDomains: ["linkedin.com"], maxResults: 5 }).catch(() => []);
      const surname = p.name.split(" ").pop()!.toLowerCase();
      linkedin = hits.map((h) => ({ u: normaliseLinkedinProfile(h.url), t: h.title.toLowerCase() })).find((h) => h.u && h.t.includes(surname))?.u ?? null;
    }
    contacts.push({
      name: p.name, title: p.title || null, poc_level: p.poc_level, focus: p.focus || null, bio: p.bio || null,
      relevant: p.relevant, rank: i + 1, linkedin_url: linkedin, x_url: links[p.name]?.x ?? null,
      email: own, email_source_url: own ? emailsBySource.find((x) => x.e === own)!.src : null,
      source_url: teamPages[0]?.url ?? site,
    });
  }

  const pitch = allPages.flatMap((p) => findPitchLinks(p.html, p.url))[0] ?? null;
  const generic = firmEmails(emails, names);
  // Emails hidden from bots (Cloudflare email protection) are left hidden; we point to the page instead.
  const hiddenOn = allPages.find((p) => /cdn-cgi\/l\/email-protection|__cf_email__/.test(p.html));
  return {
    contacts,
    channels: {
      pitch_url: pitch,
      emails: generic,
      email_sources: generic.map((e) => emailsBySource.find((x) => x.e === e)!.src),
      x_url: home ? findXLink(home.html) : null,
      contact_url: hiddenOn?.url ?? contactPages[0]?.url ?? null,
      email_hidden_from_bots: !!hiddenOn,
    },
  };
}

const CONTACT_COLS = SYSTEM_WRITE_COLUMNS.vc_contacts;
const CHANNEL_COLS = SYSTEM_WRITE_COLUMNS.vc_channels;
const MESSAGE_COLS = SYSTEM_WRITE_COLUMNS.vc_messages;

export async function saveContacts(vcId: string, contacts: Contact[], channels: Channels) {
  // Fresh snapshot per firm (messages cascade with their contact).
  await q(deleteSql("vc_contacts", ["vc_id"]), [vcId]);
  if (contacts.length) {
    const rows = contacts.map((c) => pickColumns("vc_contacts", { ...c, vc_id: vcId }, CONTACT_COLS));
    await q(insertFromJsonSql("vc_contacts", CONTACT_COLS), [JSON.stringify(rows)]);
  }
  await q(insertSql("vc_channels", CHANNEL_COLS, { conflict: ["vc_id"], update: CHANNEL_COLS.filter((c) => c !== "vc_id") }), [
    vcId, channels.pitch_url, channels.emails, channels.email_sources, channels.x_url, channels.contact_url, channels.email_hidden_from_bots,
    new Date().toISOString(),
  ]);
}

/** (Re)draft messages for the top contacts from the firm's current best signal. */
export async function refreshMessages(vc: Vc): Promise<number> {
  const [top] = await q<{ signal_id: number; summary: string; published_date: string; evidence_quote: string | null; source_name: string; logistics_relevance: string }>(
    "select signal_id, summary, published_date, evidence_quote, source_name, logistics_relevance from v_top_signal where vc_id = $1",
    [vc.id],
  );
  const signal: SignalFacts | null = top
    ? { summary: top.summary, date: top.published_date, evidence: top.evidence_quote, source: top.source_name, relevance: top.logistics_relevance }
    : null;
  const contacts = await q<{ id: number; name: string; title: string | null; poc_level: string; focus: string | null; bio: string | null }>(
    "select id, name, title, poc_level, focus, bio from vc_contacts where vc_id = $1 order by rank limit $2",
    [vc.id, MESSAGE_CONTACTS],
  );
  const founder = loadFounder();
  const wantFollowUp = vc.status === "waiting_for_response";
  let n = 0;
  for (const c of contacts) {
    const d = await draftMessages(c, vc.firm, signal, wantFollowUp, founder).catch(() => null);
    if (!d) continue;
    await q(deleteSql("vc_messages", ["contact_id"]), [c.id]);
    const base = { vc_id: vc.id, contact_id: c.id, signal_id: top?.signal_id ?? null };
    const rows = [
      { ...base, kind: "email", subject: d.email_subject, body: d.email_body },
      { ...base, kind: "linkedin_note", subject: null, body: d.linkedin_note },
      ...(wantFollowUp ? [{ ...base, kind: "follow_up", subject: `Re: ${d.email_subject}`, body: d.follow_up }] : []),
    ].map((r) => pickColumns("vc_messages", r, MESSAGE_COLS));
    await q(insertFromJsonSql("vc_messages", MESSAGE_COLS), [JSON.stringify(rows)]);
    n++;
  }
  return n;
}

/** VCs whose drafts were written from an older signal than their current best one. */
export async function staleMessageVcs(): Promise<string[]> {
  const rows = await q<{ vc_id: string }>(
    `select distinct c.vc_id from vc_contacts c
     join vcs v on v.id = c.vc_id and not v.archived
     left join v_top_signal t on t.vc_id = c.vc_id
     left join vc_messages m on m.contact_id = c.id
     where c.rank <= $1 and (m.id is null or m.signal_id is distinct from t.signal_id)`,
    [MESSAGE_CONTACTS],
  );
  return rows.map((r) => r.vc_id);
}

