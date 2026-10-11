// Firm-level fit (docs/signal-sources.md §4.5): one Gemini call per VC with
// URL context on the firm's site + portfolio page, and Google Search for
// anything the site doesn't say. Evidence URLs are kept only if they resolve.
//
//   npm run profile                # profile VCs that have no profile yet
//   npm run profile -- --only=vc01,vc09
//   npm run profile -- --force     # re-profile everyone (monthly refresh)
import { z } from "zod";
import { loadVcProfiles, loadVcs, upsertVcProfile, writeVcIdentifiers, type VcProfile } from "../lib/db";
import { geminiJson, geminiUsage } from "../lib/gemini";
import { mapLimit, politeFetch } from "../lib/http";
import type { Vc } from "../lib/types";

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const force = args.includes("--force");

const Profile = z.object({
  does_seed: z.enum(["leads_seed", "participates_seed", "series_a_plus_only", "unknown"]),
  b2b_logistics_thesis: z.enum(["core", "explicit", "portfolio_only", "none"]),
  investor_type: z.enum(["seed_fund", "multi_stage", "cvc_strategic", "angel_syndicate", "accelerator"]),
  typical_check: z.string().nullable().describe('e.g. "$500K–$2M" or "₹2–8 Cr"; null if not stated'),
  geo_focus: z.string().nullable().describe('e.g. "India", "US, Europe"; null if not stated'),
  logistics_portfolio_examples: z.array(z.string()).describe("B2B logistics/supply-chain software companies in the portfolio, max 5"),
  evidence_urls: z.array(z.string()).describe("pages that support the answers above, max 5"),
});

function prompt(vc: Vc): string {
  const pages = [vc.website, vc.portfolio_url, vc.team_url].filter(Boolean).join("\n");
  return `Profile the venture investor "${vc.firm}" for a founder in Bengaluru raising a SEED round for a B2B logistics SaaS (software sold to shippers, carriers and 3PLs).

Read these pages first:
${pages || "(no verified website; use Google Search)"}
Use Google Search only for what those pages don't say (recent rounds, check sizes, stage).

Answer from evidence, not reputation:
- does_seed: "leads_seed" if they lead seed or pre-seed rounds; "participates_seed" if they join seed rounds but rarely lead; "series_a_plus_only" if their earliest typical round is Series A or later (venture-debt funds count here); "unknown" if you can't tell.
- b2b_logistics_thesis: "core" = a dedicated supply-chain/logistics fund; "explicit" = logistics or supply chain is named in their stated thesis or focus areas; "portfolio_only" = they have B2B logistics/supply-chain software companies but no stated thesis; "none" = neither.
- investor_type: "cvc_strategic" for corporate venture arms.
- evidence_urls: the exact pages (firm site, portfolio page, press coverage) that support your answers. Never invent URLs.`;
}

async function verifiedUrls(urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const u of urls.slice(0, 5)) {
    if (!/^https?:\/\//.test(u)) continue;
    const r = await politeFetch(u);
    // A 403 from a bot-blocking site still proves the page exists; 404s and junk don't.
    if (r.ok || r.status === 403) out.push(r.ok ? r.finalUrl : u);
  }
  return [...new Set(out)];
}

interface Result {
  key: string;
  firm: string;
  profile?: Omit<VcProfile, "vc_id">;
  examples?: string[];
  flagged?: string;
  error?: string;
}

async function profileVc(vc: Vc): Promise<Result> {
  const base = { key: vc.seed_key ?? vc.id, firm: vc.firm };
  try {
    const { data } = await geminiJson(prompt(vc), Profile, { search: true, urlContext: true });
    const evidence = await verifiedUrls(data.evidence_urls);
    const profile = {
      does_seed: data.does_seed,
      b2b_logistics_thesis: data.b2b_logistics_thesis,
      investor_type: data.investor_type,
      typical_check: data.typical_check,
      geo_focus: data.geo_focus,
      evidence_urls: evidence,
    };
    await upsertVcProfile({ vc_id: vc.id, ...profile });

    const flagged =
      profile.does_seed === "series_a_plus_only"
        ? "series_a_plus_only"
        : profile.b2b_logistics_thesis === "none"
          ? "no B2B logistics thesis"
          : evidence.length === 0
            ? "no verifiable evidence"
            : undefined;
    // Only ever raise the flag here; clearing it is the seed script's call.
    if (flagged) await writeVcIdentifiers(vc.id, { needs_review: true });
    return { ...base, profile, examples: data.logistics_portfolio_examples, flagged };
  } catch (e) {
    return { ...base, error: (e as Error).message.slice(0, 300) };
  }
}

async function main() {
  const vcs = await loadVcs();
  const profiled = new Set((await loadVcProfiles()).map((p) => p.vc_id));
  const todo = vcs.filter((v) => (only ? only.includes(v.seed_key ?? "") : force || !profiled.has(v.id)));
  console.log(`Profiling ${todo.length} of ${vcs.length} VCs...`);

  const results = await mapLimit(todo, 4, async (vc) => {
    const r = await profileVc(vc);
    if (r.error) console.log(`${r.key} ${r.firm}: ERROR ${r.error}`);
    else
      console.log(
        `${r.key} ${r.firm}: ${r.profile!.does_seed} / ${r.profile!.b2b_logistics_thesis} / ${r.profile!.investor_type}` +
          ` / ${r.profile!.typical_check ?? "-"} / ${r.profile!.geo_focus ?? "-"} / evidence ${r.profile!.evidence_urls.length}` +
          (r.examples?.length ? ` / e.g. ${r.examples.slice(0, 3).join(", ")}` : "") +
          (r.flagged ? `  FLAG: ${r.flagged}` : ""),
      );
    return r;
  });

  const all = await loadVcProfiles();
  const seedFit = all.filter(
    (p) => (p.does_seed === "leads_seed" || p.does_seed === "participates_seed") && p.b2b_logistics_thesis !== "none",
  );
  console.log("\n--- Profile report (whole table) ---");
  console.log(`Profiles: ${all.length} of ${vcs.length}`);
  console.log(`Seed fit confirmed (does seed + some logistics thesis): ${seedFit.length} (target >= 35)`);
  console.log(`Flagged this run: ${results.filter((r) => r.flagged).map((r) => `${r.key} (${r.flagged})`).join(", ") || "none"}`);
  console.log(`Errors this run: ${results.filter((r) => r.error).map((r) => r.key).join(", ") || "none"}`);
  console.log(`Gemini: ${geminiUsage.calls} calls, ${geminiUsage.inputTokens} in / ${geminiUsage.outputTokens} out tokens.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
