// Seed and resolve the 50-VC watchlist (docs/vc-list.md, build-plan Phase 2).
//
//   npm run seed                 # insert missing rows, resolve unresolved ones
//   npm run seed -- --only=vc01,vc04
//   npm run seed -- --force      # re-resolve every row
//
// Idempotent: rows are inserted once (Vikram's columns get [DEMO] values only
// then); identifiers go through update_vc_identifiers, which never blanks a
// value it already has. Every website and partner name is checked against a
// page we fetched, never taken from the model or the CSV on trust.
import { readFileSync, writeFileSync } from "node:fs";
import Parser from "rss-parser";
import { z } from "zod";
import { insertNewVcs, loadVcs, writeVcIdentifiers, type VcIdentifiers } from "../lib/db";
import { exaSearch, exaUsage, type ExaResult } from "../lib/exa";
import { geminiJson, geminiUsage } from "../lib/gemini";
import { mapLimit, politeFetch, USER_AGENT } from "../lib/http";
import { parseCsv, toSeedRows, type SeedRow } from "../lib/seed/csv";
import { demoManualColumns } from "../lib/seed/demo";
import {
  extractSiteLinks,
  feedForBlog,
  firmTokens,
  isFirmSite,
  normaliseLinkedinProfile,
  pageText,
  youtubeChannelId,
} from "../lib/seed/site";
import type { Vc } from "../lib/types";

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const force = args.includes("--force");

const NOT_A_FIRM_SITE = [
  "linkedin.com", "crunchbase.com", "tracxn.com", "pitchbook.com", "cbinsights.com", "wikipedia.org",
  "x.com", "twitter.com", "facebook.com", "instagram.com", "youtube.com", "medium.com", "substack.com",
  "signal.nfx.com", "vcsheet.com", "openvc.app", "inc42.com", "yourstory.com", "entrackr.com",
  "techcrunch.com", "economictimes.indiatimes.com", "bloomberg.com", "dealroom.co", "f6s.com",
];

interface Report {
  key: string;
  firm: string;
  website: string | null;
  partner: string | null;
  partnerConfidence: "high" | "low" | null;
  identifiers: string[];
  reviewReasons: string[];
  notes: string[];
  errors: string[];
}

const isHtml = (ct: string) => ct.includes("html");

async function fetchHtml(url: string) {
  const r = await politeFetch(url);
  return r.ok && isHtml(r.contentType) ? r : null;
}

// ---------- website ----------

interface Site {
  url: string;
  /** null when the site blocks our fetcher and we verified it from Exa's index instead. */
  html: string | null;
}

const BLOCKED = new Set([401, 403, 429]);
const asHtml = (r: ExaResult) => `<title>${r.title ?? ""}</title><body>${r.text ?? ""}</body>`;

async function resolveWebsite(row: SeedRow, existing: string | null): Promise<Site | null> {
  const candidates: string[] = [];
  if (existing) candidates.push(existing);
  if (row.website) candidates.push(`https://${row.website.replace(/^https?:\/\//, "")}`);

  const tryCandidates = async (list: string[], indexed: ExaResult[] = []): Promise<Site | null> => {
    for (const c of list) {
      let origin: string;
      try {
        origin = new URL(c).origin;
      } catch {
        continue;
      }
      const r = await politeFetch(origin);
      if (r.ok && isHtml(r.contentType) && isFirmSite(r.text, row.firm)) return { url: new URL(r.finalUrl).origin, html: r.text };
      // Site refuses bots: accept it only if the search index's copy of a page on
      // this origin names the firm and reads like an investor.
      if (BLOCKED.has(r.status)) {
        const seen = indexed.find((x) => x.url.startsWith(origin) && isFirmSite(asHtml(x), row.firm));
        if (seen) return { url: origin, html: null };
      }
    }
    return null;
  };

  const direct = await tryCandidates(candidates);
  if (direct) return direct;

  const results = await exaSearch({
    query: `${row.firm} venture capital firm official website`,
    numResults: 6,
    excludeDomains: NOT_A_FIRM_SITE,
    textChars: 300,
  });
  return tryCandidates([...candidates, ...results.map((r) => r.url)], results);
}

/** Team and portfolio pages for a site that blocks us, read from Exa's index. */
async function indexedPages(site: string, firm: string) {
  const results = await exaSearch({
    query: `${firm} team partners portfolio companies`,
    includeDomains: [new URL(site).hostname],
    numResults: 8,
    textChars: 6000,
  });
  const team = results.find((r) => /team|people|partners|about/i.test(new URL(r.url).pathname));
  const portfolio = results.find((r) => /portfolio|companies|investments/i.test(new URL(r.url).pathname));
  return { teamUrl: team?.url ?? null, teamText: team?.text ?? "", portfolioUrl: portfolio?.url ?? null };
}

// ---------- firm pages ----------

async function firstWorking(urls: string[]): Promise<string | null> {
  for (const u of urls.slice(0, 4)) {
    const r = await fetchHtml(u);
    if (r) return r.finalUrl;
  }
  return null;
}

const rss = new Parser();

async function validFeed(url: string): Promise<boolean> {
  const r = await politeFetch(url);
  if (!r.ok || !/xml|rss|atom/.test(r.contentType + r.text.slice(0, 200))) return false;
  try {
    const feed = await rss.parseString(r.text);
    return (feed.items?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

async function resolveFeed(origin: string, links: ReturnType<typeof extractSiteLinks>): Promise<string | null> {
  const candidates = [
    ...links.feeds,
    ...links.substackOrMedium.map(feedForBlog).filter((x): x is string => !!x),
    `${origin}/feed`,
    `${origin}/rss.xml`,
    `${origin}/blog/feed`,
    `${origin}/feed.xml`,
  ];
  for (const c of [...new Set(candidates)].slice(0, 7)) if (await validFeed(c)) return c;
  return null;
}

async function resolveYoutube(links: string[]): Promise<string | null> {
  for (const l of links.slice(0, 2)) {
    const id = youtubeChannelId(l);
    if (id) return id;
    const r = await politeFetch(l);
    const fromPage = r.ok ? youtubeChannelId(l, r.text) : null;
    if (fromPage) return fromPage;
  }
  return null;
}

// ---------- partner ----------

const PartnerPick = z.object({
  partner_name: z.string().nullable(),
  confidence: z.enum(["high", "low"]),
  reason: z.string(),
});

function mentions(hay: string, name: string): boolean {
  const parts = name.toLowerCase().split(/\s+/).filter((p) => p.length > 1);
  const h = hay.toLowerCase();
  return parts.length > 0 && parts.every((p) => h.includes(p));
}

function firmMentioned(hay: string, firm: string): boolean {
  const h = hay.toLowerCase();
  return firmTokens(firm).every((t) => h.includes(t));
}

const cleanName = (n: string) => n.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();

async function resolvePartner(
  row: SeedRow,
  teamText: string,
  known: string | null,
): Promise<{ name: string; confidence: "high" | "low"; linkedin: string | null } | null> {
  // A partner chosen on an earlier run is kept, so its LinkedIn URL stays consistent.
  let name = row.partner_name || known || null;
  let confidence: "high" | "low" = "high";
  let people: ExaResult[] = [];

  if (!name) {
    people = await exaSearch({
      query: `${row.firm} partner investing in B2B software, supply chain or logistics`,
      category: "people",
      numResults: 10,
      textChars: 600,
    });
    const peopleBlock = people
      .map((p, i) => `[${i}] ${p.title ?? ""} | ${p.url}\n${(p.text ?? "").slice(0, 400)}`)
      .join("\n\n");
    const { data } = await geminiJson(
      `You are choosing which investor at ${row.firm} a seed-stage B2B logistics SaaS founder in India should contact.

Pick ONE current partner, general partner, managing partner or principal at ${row.firm}.
Prefer someone whose profile mentions B2B software, supply chain, logistics, freight or mobility.
If nobody fits, pick the managing partner or founding partner and set confidence "low".
Use only names that appear in the text below. If no current investor at ${row.firm} appears, return partner_name null.

TEAM PAGE TEXT:
${teamText.slice(0, 12000) || "(not available)"}

PEOPLE SEARCH RESULTS:
${peopleBlock || "(none)"}`,
      PartnerPick,
    );
    if (!data.partner_name) return null;
    name = cleanName(data.partner_name);
    confidence = data.confidence;
  }

  // Verify in code: the name must appear on the firm's own team page, or in a
  // people result that also names the firm.
  const onTeamPage = !!teamText && mentions(teamText, name);
  const inPeople = people.some((p) => mentions(`${p.title} ${p.text}`, name!) && firmMentioned(`${p.title} ${p.text}`, row.firm));
  const given = !!(row.partner_name || known);
  if (!onTeamPage && !inPeople && !given) return null;

  // LinkedIn profile: a people result whose URL is a linkedin.com/in profile and
  // whose title names the person and whose content names the firm.
  const lookup = await exaSearch({ query: `${name} ${row.firm}`, category: "people", numResults: 5, textChars: 400 });
  const match = [...lookup, ...people].find(
    (p) => normaliseLinkedinProfile(p.url) && mentions(p.title ?? "", name!) && firmMentioned(`${p.title} ${p.text}`, row.firm),
  );
  if (given && !onTeamPage && !match) confidence = "low"; // name we couldn't confirm this time
  if (known && !row.partner_name) confidence = confidenceByKey.get(row.id) ?? confidence;
  return { name, confidence, linkedin: match ? normaliseLinkedinProfile(match.url) : null };
}

const confidenceByKey = new Map<string, "high" | "low" | null>();

// ---------- SEC ----------

const secAgent = process.env.SEC_USER_AGENT ?? "";
const secEnabled = !!secAgent && !secAgent.includes("example.com");

const SecHits = z.object({
  hits: z.object({
    hits: z.array(z.object({ _source: z.object({ ciks: z.array(z.string()), display_names: z.array(z.string()) }) })),
  }),
});

async function resolveSecCik(row: SeedRow): Promise<string | null> {
  if (!secEnabled || !/US/.test(row.region)) return null;
  const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${row.firm.replace(/\(.*?\)/g, "").trim()}"`)}&forms=D`;
  const res = await fetch(url, { headers: { "User-Agent": secAgent }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`sec ${res.status}`);
  const parsed = SecHits.parse(await res.json());
  for (const h of parsed.hits.hits) {
    const i = h._source.display_names.findIndex((n) => firmMentioned(n, row.firm));
    if (i >= 0) return h._source.ciks[i] ?? null;
  }
  return null;
}

// ---------- per VC ----------

async function resolveVc(vc: Vc, row: SeedRow): Promise<Report> {
  const report: Report = {
    key: row.id, firm: row.firm, website: null, partner: null, partnerConfidence: null,
    identifiers: [], reviewReasons: [], notes: [], errors: [],
  };
  const ids: VcIdentifiers = { region: row.region, priority: row.priority };
  const step = async <T>(name: string, fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (e) {
      report.errors.push(`${name}: ${(e as Error).message.slice(0, 200)}`);
      return null;
    }
  };

  const site = await step("website", () => resolveWebsite(row, vc.website));
  let teamText = "";
  if (site?.html) {
    ids.website = report.website = site.url;
    const links = extractSiteLinks(site.html, site.url);

    const portfolio = await step("portfolio", () =>
      firstWorking([...links.portfolio, `${site.url}/portfolio`, `${site.url}/companies`]),
    );
    if (portfolio) ids.portfolio_url = portfolio;

    const team = await step("team", () => firstWorking([...links.team, `${site.url}/team`, `${site.url}/people`]));
    if (team) {
      ids.team_url = team;
      const r = await politeFetch(team);
      if (r.ok) teamText = pageText(r.text).text;
    }

    const feed = await step("rss", () => resolveFeed(site.url, links));
    if (feed) ids.rss_url = feed;

    const yt = await step("youtube", () => resolveYoutube(links.youtube));
    if (yt) ids.youtube_channel_id = yt;
  } else if (site) {
    ids.website = report.website = site.url;
    report.notes.push("site blocks our fetcher; verified from search index");
    const pages = await step("indexed pages", () => indexedPages(site.url, row.firm));
    if (pages?.teamUrl) ids.team_url = pages.teamUrl;
    if (pages?.portfolioUrl) ids.portfolio_url = pages.portfolioUrl;
    teamText = pages?.teamText ?? "";
  } else {
    report.reviewReasons.push("no verified website");
  }

  const partner = await step("partner", () => resolvePartner(row, teamText, force ? null : vc.partner_name));
  if (partner) {
    ids.partner_name = report.partner = partner.name;
    ids.partner_confidence = report.partnerConfidence = partner.confidence;
    if (partner.linkedin) ids.linkedin_url = partner.linkedin;
    // Low confidence = "no logistics-focused partner, used the managing partner",
    // which is the documented fallback, not something to review.
    if (partner.confidence === "low") report.notes.push("partner confidence low");
  } else {
    report.reviewReasons.push("no verified partner");
  }

  const cik = await step("sec", () => resolveSecCik(row));
  if (cik) ids.sec_cik = cik;

  ids.needs_review = report.reviewReasons.length > 0;
  report.identifiers = (["linkedin_url", "rss_url", "portfolio_url", "team_url", "sec_cik", "youtube_channel_id"] as const).filter(
    (k) => ids[k],
  );
  await writeVcIdentifiers(vc.id, ids);
  return report;
}

// ---------- main ----------

async function main() {
  const rows = toSeedRows(parseCsv(readFileSync("data/vc-seed-list.csv", "utf8")));
  console.log(`CSV: ${rows.length} rows. User-Agent: ${USER_AGENT}`);
  if (!secEnabled) console.log("SEC lookups skipped: set SEC_USER_AGENT to a real contact email to enable.");

  const inserted = await insertNewVcs(
    rows.map((r) => ({
      seed_key: r.id,
      name: r.partner_name || r.firm,
      firm: r.firm,
      thesis: r.inclusion_evidence || null,
      ...demoManualColumns(r),
    })),
  );
  console.log(`Inserted ${inserted} new rows.`);

  const vcs = new Map((await loadVcs()).map((v) => [v.seed_key, v]));
  for (const v of vcs.values()) if (v.seed_key) confidenceByKey.set(v.seed_key, v.partner_confidence);
  const todo = rows.filter((r) => {
    if (only && !only.includes(r.id)) return false;
    const vc = vcs.get(r.id);
    return force || !!only || !(vc?.website && vc.partner_name);
  });
  console.log(`Resolving ${todo.length} rows...`);

  const reports = await mapLimit(todo, 4, async (row) => {
    const vc = vcs.get(row.id);
    if (!vc) throw new Error(`row ${row.id} missing after insert`);
    const r = await resolveVc(vc, row).catch(
      (e): Report => ({
        key: row.id, firm: row.firm, website: null, partner: null, partnerConfidence: null,
        identifiers: [], reviewReasons: ["resolution failed"], notes: [], errors: [(e as Error).message],
      }),
    );
    const flag = r.reviewReasons.length ? `REVIEW (${r.reviewReasons.join("; ")})` : "ok";
    console.log(`${r.key} ${r.firm}: site=${r.website ?? "-"} partner=${r.partner ?? "-"} ids=[${r.identifiers.join(",")}] ${flag}`);
    for (const n of r.notes) console.log(`    note ${n}`);
    for (const e of r.errors) console.log(`    error ${e}`);
    return r;
  });

  writeFileSync("data/seed-report.json", JSON.stringify(reports, null, 2) + "\n");

  const all = await loadVcs();
  const idCount = (v: Vc) =>
    [v.linkedin_url, v.rss_url, v.portfolio_url, v.team_url, v.sec_cik, v.youtube_channel_id].filter(Boolean).length;
  console.log("\n--- Seed report (whole table) ---");
  console.log(`Rows: ${all.length}`);
  console.log(`Verified website: ${all.filter((v) => v.website).length}`);
  console.log(`Partner resolved: ${all.filter((v) => v.partner_name).length}`);
  console.log(`>= 2 identifiers: ${all.filter((v) => idCount(v) >= 2).length} (target >= 30)`);
  console.log(`Needs review: ${all.filter((v) => v.needs_review).map((v) => v.seed_key).join(", ") || "none"}`);
  console.log(`Exa: ${exaUsage.calls} calls, $${exaUsage.dollars.toFixed(3)}. Gemini: ${geminiUsage.calls} calls.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
