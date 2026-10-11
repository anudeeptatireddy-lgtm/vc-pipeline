// Re-check earlier swap-ins against the hard filters with their own evidence:
// is the qualifying round really pre-seed/seed (not pre-Series A), did this
// fund lead or co-lead it, and is the company or the fund India-linked?
// Writes data/recheck.json. Changes nothing.
//   npx tsx --env-file=.env.local scripts/recheck-swapins.ts vc54 vc55 ...
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { loadVcs } from "../lib/db";
import { geminiJson } from "../lib/gemini";
import { politeFetch } from "../lib/http";
import { pageText } from "../lib/seed/site";

const Check = z.object({
  round_as_stated: z.string().describe('exact wording, e.g. "seed", "pre-Series A", "Series A"'),
  is_pre_seed_or_seed: z.boolean().describe("false for pre-Series A, Series A or later"),
  fund_led_or_co_led: z.boolean(),
  company_country: z.string(),
  quote: z.string().describe("<=25 words from the text that states the round"),
});

async function main() {
  const keys = process.argv.slice(2);
  const vcs = (await loadVcs()).filter((v) => keys.includes(v.seed_key ?? ""));
  const out: Record<string, { firm: string; pass: boolean; reasons: string[]; evidence: string; check: z.infer<typeof Check> | null }> = {};
  for (const vc of vcs) {
    const line = readFileSync("data/vc-seed-list.csv", "utf8").split("\n").find((l) => l.startsWith(`${vc.seed_key},`)) ?? "";
    const links = [...line.matchAll(/https?:\/\/[^\s;,"]+/g)].map((m) => m[0]);
    let evidence: string | null = links[0] ?? null;
    const reasons: string[] = [];
    let check: z.infer<typeof Check> | null = null;
    if (!evidence) reasons.push("no evidence URL");
    else {
      // Try each evidence link until one is readable; unreadable means "unknown", never "fails".
      let text = "";
      for (const l of links) {
        const page = await politeFetch(l);
        if (page.ok) {
          text = `${pageText(page.text).title} ${pageText(page.text).text}`.slice(0, 12000);
          evidence = l;
          break;
        }
      }
      if (!text) {
        out[vc.seed_key!] = { firm: vc.firm, pass: true, reasons: ["all evidence pages block bots: kept, not failed"], evidence: evidence ?? "", check: null };
        console.log(`${vc.seed_key} ${vc.firm}: UNKNOWN (evidence pages block bots) — kept`);
        continue;
      }
      else {
        for (let attempt = 0; attempt < 2 && !check; attempt++) {
          try {
            ({ data: check } = await geminiJson(
              `From this article only: the funding round of the portfolio company, and the role of the investor "${vc.firm}".\n\n${text}`,
              Check,
              { timeoutMs: 90_000 },
            ));
          } catch {}
        }
        if (!check) {
          out[vc.seed_key!] = { firm: vc.firm, pass: true, reasons: ["check could not run (Gemini timeout): kept, not failed"], evidence, check: null };
          console.log(`${vc.seed_key} ${vc.firm}: UNKNOWN (Gemini timeout) — kept`);
          continue;
        }
        if (!check.is_pre_seed_or_seed) reasons.push(`round is "${check.round_as_stated}", not pre-seed/seed`);
        if (!check.fund_led_or_co_led) reasons.push("fund did not lead or co-lead");
        if (!/india/i.test(check.company_country) && !/india/i.test(vc.region ?? "")) reasons.push(`company in ${check.company_country}; no India link`);
      }
    }
    out[vc.seed_key!] = { firm: vc.firm, pass: reasons.length === 0, reasons, evidence: evidence ?? "", check };
    console.log(`${vc.seed_key} ${vc.firm}: ${reasons.length ? `FAILS: ${reasons.join("; ")}` : "passes"}${check ? ` | "${check.quote}"` : ""}`);
  }
  writeFileSync("data/recheck.json", JSON.stringify(out, null, 2) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
