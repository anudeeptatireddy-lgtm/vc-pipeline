// Re-find portfolio pages for VCs whose portfolio_url is missing or yields
// fewer than 10 companies: homepage links (direct fetch and Jina Reader) plus
// common paths; keep the page with the most companies (>= 10). Writes via
// update_vc_identifiers only.
//   npx tsx --env-file=.env.local scripts/fix-portfolio-urls.ts
import { loadVcs, writeVcIdentifiers } from "../lib/db";
import { mapLimit, politeFetch } from "../lib/http";
import { extractSiteLinks } from "../lib/seed/site";
import { currentEntries } from "../lib/sources/portfolio-diff";

const PATHS = ["/portfolio", "/companies", "/portfolio-companies", "/our-companies", "/investments", "/our-portfolio", "/portfolio/all"];

async function count(url: string, firm: string): Promise<number> {
  try {
    return (await currentEntries(url, firm)).length;
  } catch {
    return 0;
  }
}

async function jinaLinks(site: string): Promise<string[]> {
  try {
    const key = process.env.JINA_API_KEY;
    const res = await fetch(`https://r.jina.ai/${site}`, { headers: { Accept: "text/plain", ...(key ? { Authorization: `Bearer ${key}` } : {}) }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) return [];
    const md = await res.text();
    const host = new URL(site).hostname.replace(/^www\./, "");
    return [...md.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)]
      .map((m) => m[1]!)
      .filter((u) => new URL(u).hostname.replace(/^www\./, "") === host && /portfolio|companies|investments|founders/i.test(u));
  } catch {
    return [];
  }
}

async function main() {
  const vcs = await loadVcs();
  const todo = (await mapLimit(vcs, 6, async (v) => ({ v, n: v.portfolio_url ? await count(v.portfolio_url, v.firm) : 0 }))).filter((x) => x.n < 10 && x.v.website);
  console.log(`${todo.length} VCs with a missing or weak portfolio page`);
  await mapLimit(todo, 4, async ({ v, n }) => {
    const site = v.website!;
    const home = await politeFetch(site);
    const candidates = new Set<string>([
      ...(home.ok ? extractSiteLinks(home.text, home.finalUrl).portfolio : []),
      ...(await jinaLinks(site)),
      ...PATHS.map((p) => `${site}${p}`),
    ]);
    // A single company's page (/portfolio/<slug>, /portfolio-companies/<slug>) isn't the portfolio.
    const isListing = (u: string) => {
      const segs = new URL(u).pathname.split("/").filter(Boolean);
      return segs.length <= 1 || (segs.length === 2 && /^(all|companies|portfolio|specialization)$/i.test(segs[1]!));
    };
    let best = { url: v.portfolio_url, n };
    for (const c of [...candidates].filter(isListing).slice(0, 10)) {
      const k = await count(c, v.firm);
      if (k > best.n) best = { url: c, n: k };
    }
    if (best.url && best.url !== v.portfolio_url && best.n >= 10) {
      await writeVcIdentifiers(v.id, { portfolio_url: best.url });
      console.log(`FIXED ${v.firm}: ${n} -> ${best.n} companies at ${best.url}`);
    } else {
      console.log(`kept  ${v.firm}: best ${best.n} companies (${best.url ?? "none"})`);
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
