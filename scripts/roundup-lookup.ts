// Option 1 discovery: a year of Indian weekly funding roundups (Inc42 "Indian
// Startup Funding", Entrackr "Funding and acquisitions this week") → every
// logistics / supply-chain round they list → same fit test and rubric as
// scripts/reverse-lookup.ts. Merges into data/reverse-lookup.json.
// YourStory is skipped: it returns 403 to bots.
//
// Search: Tavily (free tier), ~2 queries per month. No Exa.
//   npx tsx --env-file=.env.local scripts/roundup-lookup.ts
import { readFileSync, writeFileSync } from "node:fs";
import * as cheerio from "cheerio";
import { z } from "zod";
import { loadAllVcs } from "../lib/db";
import { geminiJson, geminiUsage } from "../lib/gemini";
import { mapLimit, politeFetch } from "../lib/http";
import { canonical as canonicalCompany } from "../lib/portfolio";
import { canon, rankInvestors, type Deal, type RankedInvestor } from "../lib/rubric";
import { logisticsRelevance } from "../lib/score";
import { searchUsage, webSearch } from "../lib/search";
import { vcAliases } from "../lib/sources/batch-feeds";
import { CUSTOMER_TYPES, OFFERING_TYPES, ROUND_STAGES, SECTOR_FITS } from "../lib/types";
import { pagePublishedDate } from "../lib/verify";

const DAYS = 365;
const since = new Date(Date.now() - DAYS * 86_400_000);
const SEED = new Set(["pre-seed", "seed", "seed-extension"]);

const Kind = z.enum(["fund", "angel", "corporate", "venture_debt", "accelerator", "government", "unknown"]);
const Round = z.object({
  company: z.string(),
  what_it_sells: z.string(),
  sells_to: z.string(),
  hq_country: z.string(),
  round_stage: z.enum(ROUND_STAGES),
  amount: z.string(),
  lead_investors: z.array(z.string()).describe("only investors the text says led or co-led"),
  other_investors: z.array(z.string()),
  investor_kinds: z.array(z.object({ name: z.string(), kind: Kind })),
  sector_fit: z.enum(SECTOR_FITS),
  customer_type: z.enum(CUSTOMER_TYPES),
  offering_type: z.enum(OFFERING_TYPES),
});
const Extract = z.object({ rounds: z.array(Round) });

function monthsBack(n: number) {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(m.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }));
  }
  return out;
}

async function main() {
  // 1. Find roundup articles, month by month.
  const months = monthsBack(12);
  const queries = months.flatMap((m) => [
    { q: `Indian Startup Funding startups raised this week ${m}`, d: "inc42.com", re: /raised .* this week/i },
    { q: `Funding and acquisitions in Indian startups this week ${m}`, d: "entrackr.com", re: /funding and acquisitions/i },
  ]);
  const urls = new Map<string, string>();
  await mapLimit(queries, 4, async ({ q, d, re }) => {
    const hits = await webSearch({ query: q, kind: "general", days: DAYS, includeDomains: [d], maxResults: 20 }).catch(() => []);
    for (const h of hits) if (re.test(h.title)) urls.set(h.url.replace(/[?#].*$/, ""), h.title);
  });
  console.log(`roundup articles found: ${urls.size} (Tavily calls ${searchUsage.tavily}, Exa ${searchUsage.exa})`);

  // 2. Fetch, date-check, extract logistics rounds (Gemini reads the article text only).
  const raw: { url: string; date: string; text: string; r: z.infer<typeof Round> }[] = [];
  let tooOld = 0;
  let unreadable = 0;
  await mapLimit([...urls.keys()], 5, async (url) => {
    const page = await politeFetch(url);
    if (!page.ok) return void unreadable++;
    const date = pagePublishedDate(page.text);
    if (!date || date < since) return void tooOld++;
    const $ = cheerio.load(page.text);
    $("script, style, noscript, nav, footer, header, aside").remove();
    const text = ($("article").text() || $("main").text() || $("body").text()).replace(/\s+/g, " ").trim().slice(0, 45000);
    for (let i = 0; i < text.length; i += 15000) {
      const chunk = text.slice(i, i + 15000);
      try {
        const { data } = await geminiJson(
          `This is part of an Indian weekly startup funding roundup. List ONLY the funding rounds of companies in logistics,
freight, shipping, supply chain, fleet/trucking, warehousing, procurement or B2B mobility. Ignore all other sectors.
Use ONLY what the text says; never add investors. lead_investors: only those the text says led or co-led.
Classify the company: sector_fit fit = logistics/freight/supply-chain operations; partial = manufacturing, mobility,
industrial, general B2B SaaS; none = other. customer_type b2b/b2b2c/b2c/unknown. offering_type software (SaaS/data/AI tools),
marketplace, services, fintech, hardware, asset_heavy, not_applicable, unknown. round_stage as stated
("pre-series-a" is NOT seed: use "series-a" only if it says Series A, otherwise "unknown").

${chunk}`,
          Extract,
          { timeoutMs: 90_000 },
        );
        for (const r of data.rounds) raw.push({ url: page.finalUrl, date: date.toISOString().slice(0, 10), text: chunk.toLowerCase(), r });
      } catch (e) {
        console.error(`gemini ${url}: ${(e as Error).message.slice(0, 80)}`);
      }
    }
  });
  console.log(`logistics-sector rounds listed: ${raw.length}; articles too old ${tooOld}, unreadable ${unreadable}`);

  // 3. Same fit test as reverse-lookup, verified in code.
  const dropped = { fit: 0, stage: 0, names: 0 };
  const kinds = new Map<string, string>();
  const deals = new Map<string, Deal>();
  for (const { url, date, text, r } of raw) {
    if (logisticsRelevance(r.sector_fit, r.customer_type, r.offering_type) !== "direct") { dropped.fit++; continue; }
    if (!SEED.has(r.round_stage)) { dropped.stage++; continue; }
    const named = (n: string) => canon(n).split(" ").filter((t) => t.length > 2).every((t) => text.includes(t));
    const leads = r.lead_investors.filter(named);
    if (!leads.length || !text.includes(r.company.toLowerCase().split(" ")[0]!)) { dropped.names++; continue; }
    for (const k of r.investor_kinds) kinds.set(canon(k.name), k.kind);
    const key = canonicalCompany({ name: r.company }) || canon(r.company);
    const prev = deals.get(key);
    if (prev) {
      if (!prev.urls.includes(url)) prev.urls.push(url);
      for (const l of leads) if (!prev.leads.some((x) => canon(x) === canon(l))) prev.leads.push(l);
      continue;
    }
    deals.set(key, {
      company: r.company, sells: r.what_it_sells, to: r.sells_to, country: r.hq_country || "India", stage: r.round_stage,
      amount: r.amount, date, urls: [url], leads, others: r.other_investors.filter(named), via: "roundup",
    });
  }
  console.log(`qualifying roundup deals: ${deals.size}; dropped ${JSON.stringify(dropped)}`);

  // 4. Merge with the earlier web discovery (company-level dedupe) and re-rank with the shared rubric.
  const prev = JSON.parse(readFileSync("data/reverse-lookup.json", "utf8")) as { deals: Deal[]; investors: RankedInvestor[] };
  const merged = new Map<string, Deal>();
  for (const d of prev.deals) merged.set(canonicalCompany({ name: d.company }) || canon(d.company), { via: "web", ...d });
  let added = 0;
  for (const [k, d] of deals) {
    const m = merged.get(k);
    if (m) {
      for (const u of d.urls) if (!m.urls.includes(u)) m.urls.push(u);
      for (const l of d.leads) if (!m.leads.some((x) => canon(x) === canon(l))) m.leads.push(l);
    } else {
      merged.set(k, d);
      added++;
    }
  }
  for (const inv of prev.investors) if (!kinds.has(canon(inv.name))) kinds.set(canon(inv.name), inv.kind);
  const existing = (await loadAllVcs()).flatMap((v) => vcAliases(v).map((a) => ({ alias: canon(a), firm: v.firm })));
  const ranked = rankInvestors([...merged.values()], kinds, existing);
  writeFileSync(
    "data/reverse-lookup.json",
    JSON.stringify({ generatedAt: new Date().toISOString(), windowDays: DAYS, sources: ["web search (Exa)", "Inc42 + Entrackr weekly roundups"], deals: [...merged.values()], investors: ranked }, null, 2) + "\n",
  );
  console.log(`merged: ${merged.size} deals (${added} new from roundups)`);
  console.log("\nINDIA-DEAL INVESTORS NOT ON THE LIST (score | kind | deals)");
  for (const c of ranked.filter((c) => c.india && !c.onList).slice(0, 30)) {
    console.log(`${c.score.toFixed(1).padStart(6)} | ${c.name} | ${c.kind} | ${c.deals.map((d) => `${d.company} (${d.stage}, ${d.date}, ${d.role})`).join("; ")}`);
  }
  console.log(`\nTavily: ${searchUsage.tavily} calls · Exa: ${searchUsage.exa} · Gemini: ${geminiUsage.calls} calls`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
