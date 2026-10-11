// Resolve rows flagged needs_review: verified website, team page and partner.
// Partner names must appear on a page we fetched from the firm's own site;
// LinkedIn via Tavily (search index only). Writes via update_vc_identifiers.
//   npx tsx --env-file=.env.local scripts/fix-review-rows.ts [vc05 vc27 ...]
import { z } from "zod";
import { loadVcs, writeVcIdentifiers } from "../lib/db";
import { geminiJson } from "../lib/gemini";
import { politeFetch } from "../lib/http";
import { webSearch } from "../lib/search";
import { extractSiteLinks, isFirmSite, normaliseLinkedinProfile, pageText } from "../lib/seed/site";

// Known canonical sites where the stored one is a subsite (verified by fetching below).
// Eclipse moved eclipse.vc -> eclipse.capital; its homepage is JS-only, so it's verified via its /team page.
const SITE_OVERRIDES: Record<string, { site: string; verifyAt: string }> = {
  vc29: { site: "https://eclipse.capital", verifyAt: "https://eclipse.capital/team" },
};
const TEAM_PATHS = ["/team", "/people", "/our-team", "/team-members", "/about-us", "/about", "/who-we-are"];

const Pick = z.object({
  partner_name: z.string().nullable(),
  title: z.string().describe("their title as shown on the page"),
  confidence: z.enum(["high", "low"]),
});

async function jina(url: string): Promise<string> {
  const key = process.env.JINA_API_KEY;
  const res = await fetch(`https://r.jina.ai/${url}`, { headers: { Accept: "text/plain", ...(key ? { Authorization: `Bearer ${key}` } : {}) }, signal: AbortSignal.timeout(30000) }).catch(() => null);
  return res?.ok ? res.text() : "";
}

/** Pages that name the firm (its own person pages or articles), fetched and checked in code. */
async function articlesNaming(firmName: string): Promise<string> {
  const news = [
    ...(await webSearch({ query: `${firmName} co-founder managing partner`, kind: "general", days: 0, maxResults: 5 })),
    ...(await webSearch({ query: `${firmName} founder interview`, kind: "news", days: 365, maxResults: 5 })),
  ];
  let text = "";
  for (const n of news.slice(0, 8)) {
    const r = await politeFetch(n.url);
    const t = r.ok ? pageText(r.text).text : "";
    if (t.toLowerCase().includes(firmName.toLowerCase())) text += `\n\nPAGE ${r.finalUrl}\n${t.slice(0, 6000)}`;
  }
  return text;
}

async function pick(firm: string, text: string) {
  const { data } = await geminiJson(
    `Pick ONE current partner, general partner, managing partner, principal, or founder/co-founder of the firm ${firm} (angel networks often call their leaders co-founders) for a seed-stage B2B logistics SaaS founder to contact.
Prefer someone whose profile mentions B2B software, supply chain, logistics, mobility or industrial tech; otherwise the managing/founding partner with confidence "low".
Use ONLY names in the text below; return null if no investor at ${firm} is named.

${text.slice(0, 20000)}`,
    Pick,
    { timeoutMs: 60_000 },
  );
  const name = data.partner_name?.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim() ?? null;
  const onPage = !!name && name.split(" ").filter((p) => p.length > 1).every((p) => text.toLowerCase().includes(p.toLowerCase()));
  return { name: onPage ? name : null, data };
}

async function main() {
  const keys = process.argv.slice(2);
  const vcs = (await loadVcs()).filter((v) => (keys.length ? keys.includes(v.seed_key ?? "") : v.needs_review));
  for (const vc of vcs) {
    let site = vc.website!;
    const override = SITE_OVERRIDES[vc.seed_key ?? ""];
    if (override) {
      const r = await politeFetch(override.verifyAt);
      if (r.ok && isFirmSite(r.text, vc.firm)) site = override.site;
    }
    const home = await politeFetch(site);
    const links = home.ok ? extractSiteLinks(home.text, home.finalUrl).team : [];
    const candidates = [...new Set([...links, ...TEAM_PATHS.map((p) => `${site}${p}`)])];

    // Read up to 3 working team-ish pages (direct fetch, Jina Reader if JS-rendered).
    let teamText = "";
    let teamUrl: string | null = null;
    for (const c of candidates.slice(0, 10)) {
      if (teamText.length > 12000) break;
      const r = await politeFetch(c);
      if (!r.ok || /\/(portfolio|companies)\//i.test(new URL(r.finalUrl).pathname)) continue; // e.g. /team redirecting to a portfolio company
      let text = pageText(r.text).text;
      if (text.length < 1500) text = (await jina(r.finalUrl)).slice(0, 8000);
      if (text.length < 300 || !/partner|founder|managing|principal|director|investor/i.test(text)) continue;
      teamUrl ??= r.finalUrl;
      teamText += `\n\nPAGE ${r.finalUrl}\n${text.slice(0, 8000)}`;
    }
    const firmName = vc.firm.replace(/\(.*?\)/g, "").trim();
    let found = teamText ? await pick(vc.firm, teamText) : null;
    if (!found?.name) {
      // No verifiable name on the firm's team pages: use pages that name the firm (its own person pages or articles).
      const extra = await articlesNaming(firmName);
      if (extra) {
        teamText += extra;
        found = await pick(vc.firm, teamText);
      }
    }
    if (!found?.name) {
      console.log(`${vc.seed_key} ${vc.firm}: no verifiable partner (model said ${found?.data.partner_name ?? "none"}); left for review`);
      continue;
    }
    const name = found.name;
    const data = found.data;

    const hits = await webSearch({ query: `${name} ${vc.firm.replace(/\(.*?\)/g, "").trim()}`, kind: "general", days: 0, includeDomains: ["linkedin.com"], maxResults: 5 });
    const surname = name.split(" ").pop()!.toLowerCase();
    const li = hits.map((h) => ({ url: normaliseLinkedinProfile(h.url), title: h.title.toLowerCase() })).find((h) => h.url && h.title.includes(surname))?.url ?? undefined;

    await writeVcIdentifiers(vc.id, {
      website: site !== vc.website ? site : undefined,
      team_url: teamUrl ?? undefined,
      partner_name: name,
      partner_confidence: data.confidence,
      linkedin_url: li,
      needs_review: false,
    });
    console.log(`${vc.seed_key} ${vc.firm}: ${name} (${data.title}, ${data.confidence})${li ? ` · ${li}` : " · no LinkedIn match"}${site !== vc.website ? ` · website -> ${site}` : ""} · team ${teamUrl}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
