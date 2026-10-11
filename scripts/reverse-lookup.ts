// Reverse lookup (docs/signal-sources.md Tier 3 "reverse-lookup trick"):
// B2B logistics / supply-chain SOFTWARE seed and pre-seed rounds from the last
// 12 months → who led them → investors ranked by the rubric.
//
//   npm run reverse-lookup            # writes data/reverse-lookup.json
//
// Every round needs a resolved URL (fetched, or a bot-block that proves it
// exists) and a dated article inside the window; investor names must appear in
// the article text; fit is computed in code (lib/score.ts), never by the model.
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { loadAllVcs } from "../lib/db";
import { exaSearch, exaUsage, type ExaResult } from "../lib/exa";
import { geminiJson, geminiUsage } from "../lib/gemini";
import { mapLimit, politeFetch } from "../lib/http";
import { logisticsRelevance } from "../lib/score";
import { canonical as canonicalCompany } from "../lib/portfolio";
import { vcAliases } from "../lib/sources/batch-feeds";
import { CUSTOMER_TYPES, OFFERING_TYPES, ROUND_STAGES, SECTOR_FITS } from "../lib/types";

const DAYS = 365;
const since = new Date(Date.now() - DAYS * 86_400_000);
const INDIA_NEWS = ["inc42.com", "yourstory.com", "entrackr.com", "economictimes.indiatimes.com", "vccircle.com", "livemint.com", "moneycontrol.com", "business-standard.com", "thehindubusinessline.com", "techcrunch.com"];

const QUERIES: { q: string; domains?: string[] }[] = [
  // India first
  { q: "logistics SaaS startup raises seed funding round led by", domains: INDIA_NEWS },
  { q: "supply chain software startup raises pre-seed round led by", domains: INDIA_NEWS },
  { q: "freight tech startup raises seed round led by", domains: INDIA_NEWS },
  { q: "trucking and fleet management software startup seed funding led by", domains: INDIA_NEWS },
  { q: "warehouse management software startup raises seed round", domains: INDIA_NEWS },
  { q: "B2B logistics platform raises seed funding Bengaluru led by", domains: INDIA_NEWS },
  { q: "export import shipping logistics tech startup raises seed round India" },
  { q: "Indian logistics software startup raises pre-seed funding from venture capital" },
  { q: "procurement and supply chain AI startup India seed round led by" },
  { q: "transport management system startup India raises seed funding" },
  // Global
  { q: "freight software startup raises seed round led by" },
  { q: "supply chain software startup seed round led by" },
  { q: "logistics AI startup raises seed funding led by" },
  { q: "transportation management system startup raises seed round" },
  { q: "freight forwarding software startup raises pre-seed round" },
  { q: "warehouse software startup raises seed funding led by" },
  { q: "3PL software startup raises seed round" },
  { q: "customs brokerage compliance software startup seed round" },
  { q: "fleet operations software startup seed round led by" },
  { q: "supply chain visibility startup raises seed funding" },
  { q: "logistics tech startup seed round Southeast Asia Middle East led by" },
];

const Kind = z.enum(["fund", "angel", "corporate", "venture_debt", "accelerator", "government", "unknown"]);
const Round = z.object({
  article: z.number().int(),
  is_new_funding_round: z.boolean(),
  company: z.string(),
  what_it_sells: z.string().describe("max 15 words"),
  sells_to: z.string().describe("who the customers are, max 10 words"),
  hq_country: z.string(),
  round_stage: z.enum(ROUND_STAGES),
  amount: z.string().describe('as stated, e.g. "$3M" or "₹12 crore"; empty if not stated'),
  lead_investors: z.array(z.string()).describe("only investors the article says led or co-led"),
  other_investors: z.array(z.string()),
  investor_kinds: z.array(z.object({ name: z.string(), kind: Kind })),
  sector_fit: z.enum(SECTOR_FITS),
  customer_type: z.enum(CUSTOMER_TYPES),
  offering_type: z.enum(OFFERING_TYPES),
});
const Extract = z.object({ rounds: z.array(Round) });

const SEED = new Set(["pre-seed", "seed", "seed-extension"]);
const SUFFIX = /\b(ventures?|venture partners|capital|partners|fund|funds|vc|llp|llc|pvt|ltd|inc|advisors|management|investments?|the|group|india)\b/g;
export const canon = (n: string) =>
  n.toLowerCase().replace(/\(.*?\)/g, " ").replace(/&/g, " and ").replace(SUFFIX, " ").replace(/[^a-z0-9]+/g, " ").trim();

interface Deal {
  company: string;
  sells: string;
  to: string;
  country: string;
  stage: string;
  amount: string;
  date: string;
  urls: string[];
  leads: string[];
  others: string[];
}

async function main() {
  // 1. Collect articles. Each query runs over date slices (India: quarters,
  //    global: halves) so older rounds aren't crowded out by the newest ones.
  const seen = new Map<string, ExaResult>();
  const slices = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      start: new Date(since.getTime() + (i * DAYS * 86_400_000) / n).toISOString(),
      end: new Date(since.getTime() + ((i + 1) * DAYS * 86_400_000) / n).toISOString(),
    }));
  const jobs = QUERIES.flatMap((qq, i) => slices(i < 10 ? 4 : 2).map((sl) => ({ ...qq, ...sl })));
  await mapLimit(jobs, 4, async ({ q, domains, start, end }) => {
    const res = await exaSearch({ query: q, numResults: 25, startPublishedDate: start, endPublishedDate: end, includeDomains: domains, textChars: 2500 }).catch(
      (e) => (console.error(`exa "${q}": ${(e as Error).message}`), [] as ExaResult[]),
    );
    for (const r of res) if (r.publishedDate && new Date(r.publishedDate) >= since && r.text) seen.set(r.url, r);
  });
  const articles = [...seen.values()];
  console.log(`articles: ${articles.length} (Exa calls ${exaUsage.calls}, $${exaUsage.dollars.toFixed(3)})`);

  // 2. Extract rounds with Gemini, 6 articles per call (text given; no search, so no invented deals).
  const batches: ExaResult[][] = [];
  for (let i = 0; i < articles.length; i += 6) batches.push(articles.slice(i, i + 6));
  const raw: { a: ExaResult; r: z.infer<typeof Round> }[] = [];
  await mapLimit(batches, 6, async (batch) => {
    const body = batch.map((a, i) => `[${i}] ${a.title}\nURL: ${a.url}\nPUBLISHED: ${a.publishedDate}\n${(a.text ?? "").slice(0, 2500)}`).join("\n\n---\n\n");
    try {
      const { data } = await geminiJson(
        `Extract startup funding rounds from these news articles. Use ONLY what the text says; never add investors or facts.
For each article that announces a NEW funding round for a company, return one entry (article = its [index]).
Skip articles that are not a new round (lists, opinion, layoffs, acquisitions).
lead_investors: only investors the text says led or co-led the round. other_investors: the rest named in the text.
investor_kinds: classify each named investor: fund (venture capital firm), angel (individual), corporate (corporate/strategic venture arm),
venture_debt, accelerator, government, unknown.
Classify the COMPANY: sector_fit fit = logistics/freight/supply-chain operations; partial = manufacturing, mobility, industrial,
general B2B SaaS; none = other. customer_type b2b/b2b2c/b2c/unknown. offering_type software (SaaS/data/AI tools), marketplace,
services, fintech, hardware, asset_heavy, not_applicable, unknown. round_stage as stated.

${body}`,
        Extract,
        { timeoutMs: 110_000 },
      );
      for (const r of data.rounds) if (batch[r.article]) raw.push({ a: batch[r.article]!, r });
    } catch (e) {
      console.error(`gemini batch: ${(e as Error).message.slice(0, 120)}`);
    }
  });
  console.log(`rounds extracted: ${raw.length} (Gemini calls ${geminiUsage.calls})`);

  // 3. Verify and fit-test in code.
  const deals = new Map<string, Deal>();
  const kinds = new Map<string, z.infer<typeof Kind>>();
  const dropped = { notRound: 0, fit: 0, stage: 0, url: 0, names: 0 };
  await mapLimit(raw, 6, async ({ a, r }) => {
    if (!r.is_new_funding_round) return void dropped.notRound++;
    if (logisticsRelevance(r.sector_fit, r.customer_type, r.offering_type) !== "direct") return void dropped.fit++;
    if (!SEED.has(r.round_stage)) return void dropped.stage++;
    const page = await politeFetch(a.url);
    if (!(page.ok || [401, 403, 429].includes(page.status))) return void dropped.url++;
    const text = `${a.title} ${a.text}`.toLowerCase();
    const named = (n: string) => canon(n).split(" ").filter((t) => t.length > 2).every((t) => text.includes(t));
    const leads = r.lead_investors.filter(named);
    if (leads.length === 0) return void dropped.names++;
    for (const k of r.investor_kinds) kinds.set(canon(k.name), k.kind);
    const key = canonicalCompany({ name: r.company }) || canon(r.company);
    const date = a.publishedDate!.slice(0, 10);
    const d = deals.get(key);
    if (d) {
      d.urls.push(a.url);
      if (date < d.date) d.date = date;
      for (const l of leads) if (!d.leads.some((x) => canon(x) === canon(l))) d.leads.push(l);
    } else {
      deals.set(key, {
        company: r.company, sells: r.what_it_sells, to: r.sells_to, country: r.hq_country, stage: r.round_stage,
        amount: r.amount, date, urls: [a.url], leads, others: r.other_investors.filter(named),
      });
    }
  });
  console.log(`qualifying deals: ${deals.size}; dropped ${JSON.stringify(dropped)}`);

  // 4. Rank investors by the rubric (led / co-led qualifying deals only).
  const existing = (await loadAllVcs()).flatMap((v) => vcAliases(v).map((a) => ({ alias: canon(a), firm: v.firm, archived: v.archived })));
  const inv = new Map<string, { name: string; score: number; deals: (Deal & { role: string })[]; kind: string; india: boolean; onList: string | null }>();
  for (const d of deals.values()) {
    const ageDays = (Date.now() - Date.parse(d.date)) / 86_400_000;
    for (const lead of d.leads) {
      const key = canon(lead);
      if (!key) continue;
      const role = d.leads.length > 1 ? "co-led" : "led";
      const value = 40 * 1.5 * 1.3 * (role === "led" ? 1 : 0.85) * Math.exp(-ageDays / 180);
      const cur = inv.get(key) ?? {
        name: lead, score: 0, deals: [], kind: kinds.get(key) ?? "unknown", india: false,
        onList: existing.find((e) => e.alias === key || e.alias.startsWith(`${key} `) || key.startsWith(`${e.alias} `))?.firm ?? null,
      };
      cur.score += value;
      cur.deals.push({ ...d, role });
      cur.india ||= /india/i.test(d.country);
      inv.set(key, cur);
    }
  }
  const ranked = [...inv.values()].sort((a, b) => b.score - a.score).map((c) => ({ ...c, score: Number(c.score.toFixed(1)) }));
  writeFileSync("data/reverse-lookup.json", JSON.stringify({ generatedAt: new Date().toISOString(), windowDays: DAYS, deals: [...deals.values()], investors: ranked }, null, 2) + "\n");

  console.log("\nTOP INVESTORS (rubric score | kind | India deal | on list | qualifying led deals)");
  for (const c of ranked.slice(0, 40)) {
    console.log(`${c.score.toFixed(1).padStart(6)} | ${c.name} | ${c.kind} | ${c.india ? "IN" : "  "} | ${c.onList ?? "-"} | ${c.deals.map((d) => `${d.company} (${d.stage}, ${d.date}, ${d.role})`).join("; ")}`);
  }
  console.log(`\nExa: ${exaUsage.calls} calls, $${exaUsage.dollars.toFixed(3)}. Gemini: ${geminiUsage.calls} calls.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
