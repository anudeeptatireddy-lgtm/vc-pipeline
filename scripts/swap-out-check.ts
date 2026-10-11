// For each active VC: any logistics / supply-chain investment in the last 12
// months? Evidence must be an Exa result we got back (real URL, dated inside
// the window) whose text names the firm. Writes data/swap-out-check.json.
//   npx tsx --env-file=.env.local scripts/swap-out-check.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { loadVcs } from "../lib/db";
import { exaSearch, exaUsage, type ExaResult } from "../lib/exa";
import { geminiJson, geminiUsage } from "../lib/gemini";
import { mapLimit } from "../lib/http";
import { mentionsVc } from "../lib/sources/batch-feeds";
import { q } from "../lib/sql";

const DAYS = 365;
const since = new Date(Date.now() - DAYS * 86_400_000);

const Out = z.object({
  vcs: z.array(
    z.object({
      vc: z.number().int(),
      deals: z.array(
        z.object({
          result: z.number().int().describe("index of the search result that states it"),
          company: z.string(),
          what_it_does: z.string(),
          role: z.enum(["led", "co-led", "participated"]),
          b2b_logistics_software: z.boolean().describe("true only if the company sells software to logistics/supply-chain businesses"),
        }),
      ),
    }),
  ),
});

const CACHE = "data/.cache/swap-out-exa.json";

type Status = "found" | "none" | "unknown";

async function main() {
  const vcs = await loadVcs();
  // Exa results are cached so re-running the check doesn't re-spend credits.
  const cache: Record<string, ExaResult[]> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
  await mapLimit(vcs.filter((v) => !cache[v.id]), 5, async (vc) => {
    const firm = vc.firm.replace(/\(.*?\)/g, "").trim();
    cache[vc.id] = await exaSearch({
      query: `${firm} invests in logistics, supply chain or freight startup funding round`,
      numResults: 8, startPublishedDate: since.toISOString(), textChars: 1500,
    }).catch(() => [] as ExaResult[]);
  });
  mkdirSync("data/.cache", { recursive: true });
  writeFileSync(CACHE, JSON.stringify(cache));

  // Logistics-sector investments we already verified and stored count as activity.
  const stored = await q<{ vc_id: string; company_name: string | null; published_date: string; source_url: string }>(
    `select vc_id, company_name, published_date, source_url from signals
     where signal_type = 'investment' and sector_fit = 'fit' and published_date >= current_date - 365`,
  );

  const out: Record<string, { firm: string; status: Status; logisticsDeals: { company: string; what: string; role: string; software: boolean; date: string; url: string }[] }> = {};
  await mapLimit(vcs, 8, async (vc) => {
    const rs = (cache[vc.id] ?? []).filter((r) => r.publishedDate && new Date(r.publishedDate) >= since && mentionsVc(`${r.title} ${r.text}`, vc));
    const deals: (typeof out)[string]["logisticsDeals"] = stored
      .filter((s) => s.vc_id === vc.id)
      .map((s) => ({ company: s.company_name ?? "?", what: "stored signal", role: "invested", software: false, date: s.published_date, url: s.source_url }));
    let status: Status = deals.length ? "found" : "none";
    if (rs.length) {
      const body = rs.map((r, j) => `result [${j}] ${r.title} (${r.publishedDate?.slice(0, 10)})\n${(r.text ?? "").replace(/\s+/g, " ").slice(0, 1200)}`).join("\n\n");
      let data: z.infer<typeof Out> | null = null;
      for (let attempt = 0; attempt < 2 && !data; attempt++) {
        try {
          ({ data } = await geminiJson(
            `VC: ${vc.firm}. List investments THIS VC made (led, co-led or participated) in a LOGISTICS, FREIGHT or SUPPLY-CHAIN
company, using ONLY these search results. Ignore other investors' deals, exits and non-logistics companies. Return vcs: [{vc: 0, deals}].

${body}`,
            Out,
            { timeoutMs: 90_000 },
          ));
        } catch {}
      }
      if (!data) status = deals.length ? "found" : "unknown"; // a failed check is never evidence of "no activity"
      for (const d of data?.vcs.flatMap((v) => v.deals) ?? []) {
        const r = rs[d.result];
        if (!r || !`${r.title} ${r.text}`.toLowerCase().includes(d.company.toLowerCase().split(" ")[0]!)) continue;
        deals.push({ company: d.company, what: d.what_it_does, role: d.role, software: d.b2b_logistics_software, date: r.publishedDate!.slice(0, 10), url: r.url });
        status = "found";
      }
    }
    out[vc.id] = { firm: vc.firm, status, logisticsDeals: deals };
  });

  // Merge in the reverse-lookup corpus (deals where the VC led or co-led).
  try {
    const rl = JSON.parse(readFileSync("data/reverse-lookup.json", "utf8")) as { investors: { onList: string | null; deals: { company: string; sells: string; role: string; date: string; urls: string[] }[] }[] };
    for (const inv of rl.investors) {
      const vc = inv.onList ? vcs.find((v) => v.firm === inv.onList) : undefined;
      if (!vc || !out[vc.id]) continue;
      for (const d of inv.deals) out[vc.id]!.logisticsDeals.push({ company: d.company, what: d.sells, role: d.role, software: true, date: d.date, url: d.urls[0]! });
      out[vc.id]!.status = "found";
    }
  } catch {}

  writeFileSync("data/swap-out-check.json", JSON.stringify(out, null, 2) + "\n");
  for (const [, v] of Object.entries(out).sort((a, b) => a[1].logisticsDeals.length - b[1].logisticsDeals.length)) {
    console.log(`${v.status.padEnd(7)} ${String(v.logisticsDeals.length).padStart(2)} | ${v.firm} | ${v.logisticsDeals.slice(0, 3).map((d) => `${d.company} (${d.role}, ${d.date})`).join("; ")}`);
  }
  console.log(`\nExa: ${exaUsage.calls} new calls, $${exaUsage.dollars.toFixed(3)}. Gemini: ${geminiUsage.calls} calls.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
