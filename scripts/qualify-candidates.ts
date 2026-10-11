// Apply the rubric's hard filters to reverse-lookup investors:
//   verified + dated B2B logistics software seed deal in 12 months (from
//   data/reverse-lookup.json), led or co-led, India-accessible, not
//   venture-debt-only, not corporate strategic, not already on the list,
//   official website verified by fetching.
// Writes data/candidates.json, ranked by rubric score.
//   npx tsx --env-file=.env.local scripts/qualify-candidates.ts
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { loadAllVcs } from "../lib/db";
import { geminiJson, geminiUsage } from "../lib/gemini";
import { mapLimit, politeFetch } from "../lib/http";
import { isFirmSite, pageText } from "../lib/seed/site";

type Inv = {
  name: string; score: number; kind: string; india: boolean; onList: string | null;
  deals: { company: string; sells: string; to: string; country: string; stage: string; amount: string; date: string; urls: string[]; role: string }[];
};

const Facts = z.object({
  official_name: z.string(),
  official_website: z.string().describe("the firm's own homepage URL; empty if unknown"),
  hq_country: z.string(),
  invests_in_india: z.boolean().describe("true only if the firm has invested in an Indian startup or says India is in its mandate"),
  india_evidence_url: z.string().describe("a page that shows it; empty if none"),
  investor_type: z.enum(["seed_fund", "multi_stage", "cvc_strategic", "angel_syndicate", "accelerator", "venture_debt", "other"]),
  leads_seed_rounds: z.boolean(),
  partner_for_logistics: z.string().describe("the partner who led the logistics deal(s), if named; empty if unknown"),
});

/** The evidence page must load and actually mention India (existing isn't enough). */
const showsIndia = async (url: string) => {
  if (!/^https?:\/\//.test(url)) return false;
  const r = await politeFetch(url);
  if (!r.ok) return false;
  const { title, text } = pageText(r.text);
  return /\bindia(n)?\b/i.test(`${title} ${text}`);
};

async function main() {
  const rl = JSON.parse(readFileSync("data/reverse-lookup.json", "utf8")) as { investors: Inv[] };
  const listSites = new Set(
    (await loadAllVcs()).map((v) => v.website).filter((w): w is string => !!w).map((w) => new URL(w).hostname.replace(/^www\./, "")),
  );
  // India first: every investor with an India deal, plus the top 40 by score.
  const eligible = rl.investors.filter((i) => !i.onList && !["angel", "corporate", "venture_debt", "government"].includes(i.kind));
  const pool = [...new Set([...eligible.slice(0, 40), ...eligible.filter((i) => i.india)])];
  console.log(`checking ${pool.length} candidates (top 40 + all with an India deal; not on list, not angel/corporate/debt/government by article)`);

  const results = await mapLimit(pool, 6, async (c) => {
    const reasons: string[] = [];
    let facts: z.infer<typeof Facts> | null = null;
    for (let attempt = 0; attempt < 2 && !facts; attempt++) try {
      ({ data: facts } = await geminiJson(
        `Investor: "${c.name}". It led or co-led these seed rounds: ${c.deals.map((d) => `${d.company} (${d.date})`).join(", ")}.
Find the investor's official website and answer about the INVESTOR (not the startups). Use Google Search; never guess a URL.`,
        Facts,
        { search: true, timeoutMs: 90_000 },
      ));
    } catch (e) {
      if (attempt === 1) reasons.push(`lookup failed: ${(e as Error).message.slice(0, 60)}`);
    }
    let website: string | null = null;
    if (facts?.official_website) {
      try {
        const origin = new URL(facts.official_website).origin;
        const page = await politeFetch(origin);
        if (page.ok && isFirmSite(page.text, facts.official_name || c.name)) website = new URL(page.finalUrl).origin;
        else if ([401, 403, 429].includes(page.status)) website = origin; // exists but blocks bots; seed re-verifies via index
      } catch {}
    }
    if (!website) reasons.push("no verified website");
    if (website && listSites.has(new URL(website).hostname.replace(/^www\./, ""))) reasons.push("duplicate of a listed fund");
    if (facts?.investor_type === "venture_debt") reasons.push("venture debt");
    if (facts?.investor_type === "cvc_strategic") reasons.push("corporate strategic");
    if (facts && facts.investor_type === "angel_syndicate" && !facts.leads_seed_rounds) reasons.push("doesn't lead");
    const indiaOk = c.india || (!!facts?.invests_in_india && (await showsIndia(facts.india_evidence_url)));
    if (!indiaOk) reasons.push("not India-accessible (no India deal or verifiable India mandate)");
    return {
      name: facts?.official_name || c.name, score: c.score, website, hq: facts?.hq_country ?? null,
      investorType: facts?.investor_type ?? null, partner: facts?.partner_for_logistics || null,
      indiaEvidence: c.india ? "India deal in corpus" : facts?.india_evidence_url || null,
      deals: c.deals, qualifies: reasons.length === 0, reasons,
    };
  });

  // Same fund under two names (e.g. "Bonfire V" / "Bonfire Ventures"): merge by verified website, keep the higher score.
  const bySite = new Map<string, (typeof results)[number]>();
  for (const r of results) {
    const site = r.website ? new URL(r.website).hostname.replace(/^www\./, "") : null;
    const prev = site ? bySite.get(site) : undefined;
    if (site && prev) {
      prev.reasons = prev.reasons.filter(Boolean);
      r.reasons.push(`duplicate of ${prev.name}`);
      r.qualifies = false;
    } else if (site) bySite.set(site, r);
  }
  const ranked = results.sort((a, b) => Number(b.qualifies) - Number(a.qualifies) || b.score - a.score);
  writeFileSync("data/candidates.json", JSON.stringify(ranked, null, 2) + "\n");
  for (const r of ranked) {
    console.log(`${r.qualifies ? "QUALIFIES" : "rejected "} ${r.score.toFixed(1).padStart(6)} | ${r.name} | ${r.website ?? "-"} | ${r.investorType ?? "-"} | ${r.qualifies ? r.deals.map((d) => `${d.company} ${d.date}`).join("; ") : r.reasons.join("; ")}`);
  }
  console.log(`\n${ranked.filter((r) => r.qualifies).length} qualify. Gemini: ${geminiUsage.calls} calls.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
