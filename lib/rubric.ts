// The candidate-ranking rubric (docs/swap-log.md "The rubric used"), shared by
// scripts/reverse-lookup.ts and scripts/roundup-lookup.ts so both rounds score
// investors identically.
//   per qualifying deal: 40 (investment) × 1.5 (direct) × 1.3 (seed)
//                        × lead factor (1.0 sole lead, 0.85 co-lead) × exp(-days/180)

export interface Deal {
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
  via?: string; // "web" (reverse lookup) | "roundup"
}

export interface RankedInvestor {
  name: string;
  score: number;
  deals: (Deal & { role: string })[];
  kind: string;
  india: boolean;
  onList: string | null;
}

const SUFFIX = /\b(ventures?|venture partners|capital|partners|fund|funds|vc|llp|llc|pvt|ltd|inc|advisors|management|investments?|the|group|india)\b/g;
export const canon = (n: string) =>
  n.toLowerCase().replace(/\(.*?\)/g, " ").replace(/&/g, " and ").replace(SUFFIX, " ").replace(/[^a-z0-9]+/g, " ").trim();

export function dealValue(role: "led" | "co-led", date: string, now = Date.now()): number {
  const ageDays = (now - Date.parse(date)) / 86_400_000;
  return 40 * 1.5 * 1.3 * (role === "led" ? 1 : 0.85) * Math.exp(-ageDays / 180);
}

export function rankInvestors(
  deals: Deal[],
  kinds: Map<string, string>,
  existing: { alias: string; firm: string }[],
): RankedInvestor[] {
  const inv = new Map<string, RankedInvestor>();
  for (const d of deals) {
    for (const lead of d.leads) {
      const key = canon(lead);
      if (!key) continue;
      const role = d.leads.length > 1 ? "co-led" : "led";
      const cur = inv.get(key) ?? {
        name: lead, score: 0, deals: [], kind: kinds.get(key) ?? "unknown", india: false,
        onList: existing.find((e) => e.alias === key || e.alias.startsWith(`${key} `) || key.startsWith(`${e.alias} `))?.firm ?? null,
      };
      cur.score += dealValue(role, d.date);
      cur.deals.push({ ...d, role });
      cur.india ||= /india/i.test(d.country);
      inv.set(key, cur);
    }
  }
  return [...inv.values()].sort((a, b) => b.score - a.score).map((c) => ({ ...c, score: Number(c.score.toFixed(1)) }));
}
