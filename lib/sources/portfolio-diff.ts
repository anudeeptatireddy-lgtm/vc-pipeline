// Portfolio page diffing (docs/signal-sources.md §6). Produces tier-A
// signals directly: we fetched the evidence ourselves, so it skips the
// extraction step and is enriched with one Gemini call per addition.
import { z } from "zod";
import { insertSnapshot, loadSnapshots } from "../db";
import { geminiJson } from "../gemini";
import { politeFetch } from "../http";
import { confirmedAdditions, extractEntries, extractEntriesFromMarkdown, extractLogoEntries, hashEntries, type Entry } from "../portfolio";
import { logisticsRelevance } from "../score";
import { CUSTOMER_TYPES, OFFERING_TYPES, ROUND_STAGES, SECTOR_FITS, type Vc, type VerifiedSignal } from "../types";
import { toDay } from "../verify";

const MIN_ENTRIES = 10; // fewer: JS-rendered (try Jina) or not really a portfolio page (don't diff)
const MAX_ENRICH = 3;

async function jinaReader(url: string): Promise<string | null> {
  const key = process.env.JINA_API_KEY;
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "text/plain", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    signal: AbortSignal.timeout(30000),
  });
  return res.ok ? res.text() : null;
}

export async function currentEntries(portfolioUrl: string, firm = ""): Promise<Entry[]> {
  const page = await politeFetch(portfolioUrl);
  if (!page.ok) throw new Error(`portfolio fetch ${page.status || page.error}`);
  let entries = extractEntries(page.text, page.finalUrl);
  // Logo walls: names only in image alt text.
  if (entries.length < MIN_ENTRIES) {
    const logos = extractLogoEntries(page.text, firm.replace(/\(.*?\)/g, "").trim());
    if (logos.length > entries.length) entries = logos;
  }
  // Only for pages we were allowed to fetch but that render client-side.
  if (entries.length < MIN_ENTRIES) {
    const md = await jinaReader(page.finalUrl).catch(() => null);
    if (md) {
      const viaJina = extractEntriesFromMarkdown(md, page.finalUrl);
      if (viaJina.length > entries.length) entries = viaJina;
    }
  }
  return entries;
}

const Enrichment = z.object({
  company_name: z.string(),
  what_it_does: z.string().describe("one line, max 20 words"),
  sector_fit: z.enum(SECTOR_FITS),
  customer_type: z.enum(CUSTOMER_TYPES),
  offering_type: z.enum(OFFERING_TYPES),
  round_stage: z.enum(ROUND_STAGES),
  confidence: z.number().min(0).max(1),
});

async function enrich(e: Entry, vc: Vc) {
  const { data } = await geminiJson(
    `${vc.firm} just added this company to its portfolio page: ${e.name} (https://${e.domain}).
Read https://${e.domain}${e.domain?.includes("/") ? " (the firm's profile page for it) and search for the company's own site," : ""} and say what the company does, then classify it for a founder raising seed for a B2B logistics SaaS:
sector_fit: fit = logistics/freight/supply-chain operations; partial = manufacturing, mobility, industrial, general B2B SaaS; none = other.
customer_type: b2b / b2b2c / b2c / unknown. offering_type: software, marketplace, services, fintech, hardware, asset_heavy, unknown.
round_stage: the round in which ${vc.firm} invested, if any public source says so; otherwise "unknown".`,
    Enrichment,
    { urlContext: true, search: true },
  );
  return data;
}

export async function detectPortfolioAdditions(
  vc: Vc,
  today: Date,
): Promise<{ signals: VerifiedSignal[]; current: Entry[]; runs: number; skipped?: string }> {
  if (!vc.portfolio_url) return { signals: [], current: [], runs: 0 };
  const entries = await currentEntries(vc.portfolio_url, vc.firm);
  // Don't snapshot a broken render or a page of nav links: diffs on it would be
  // noise. A known state, not an error, so it isn't logged as one each run.
  if (entries.length < MIN_ENTRIES) return { signals: [], current: [], runs: 0, skipped: `${entries.length} entries` };
  await insertSnapshot(vc.id, "portfolio", entries, hashEntries(entries));

  const history = await loadSnapshots(vc.id, "portfolio", 3);
  const added = confirmedAdditions(history.map((h) => h.entries)).slice(0, MAX_ENRICH);

  const signals: VerifiedSignal[] = [];
  for (const e of added) {
    const x = await enrich(e, vc);
    const relevance = logisticsRelevance(x.sector_fit, x.customer_type, x.offering_type);
    signals.push({
      vc_id: vc.id,
      signal_type: "investment",
      summary: `Added ${x.company_name} to its portfolio page (${x.what_it_does.replace(/\.$/, "")})`,
      source_url: `https://${e.domain}`, // company site, or the firm's own profile page for it
      source_name: "portfolio-diff",
      source_tier: "A",
      published_date: toDay(today),
      evidence_quote: `New on ${vc.portfolio_url} in two consecutive runs`,
      company_name: x.company_name,
      round_stage: x.round_stage,
      sector_fit: x.sector_fit,
      customer_type: x.customer_type,
      offering_type: x.offering_type,
      logistics_relevance: relevance,
      confidence: Number((0.95 * (0.5 + 0.5 * x.confidence)).toFixed(3)),
      opening_line: null,
      nudge_line: null,
      corroborated_by: null,
    });
  }
  return { signals, current: entries, runs: history.length };
}
