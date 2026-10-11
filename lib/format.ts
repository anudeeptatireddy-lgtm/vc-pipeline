// Display helpers for the dashboard copy deck (docs/dashboard-design.md §8).

const TZ = "Asia/Kolkata";

/** "Thu 8:02 IST" */
export function istStamp(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const day = date.toLocaleDateString("en-GB", { weekday: "short", timeZone: TZ });
  const time = date.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: false, timeZone: TZ });
  return `${day} ${time.replace(/^0/, "")} IST`;
}

/** "Monday" */
export function istWeekday(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { weekday: "long", timeZone: TZ });
}

/** Next cron run: Mon and Thu 08:00 IST (02:30 UTC), see vercel.json. */
export function nextRun(now = new Date()): Date {
  for (let i = 0; i < 8; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i, 2, 30));
    const dow = d.getUTCDay();
    if ((dow === 1 || dow === 4) && d > now) return d;
  }
  throw new Error("unreachable");
}

/** "Mon 8:00" (copy deck drops the zone in the status line) */
export function shortStamp(d: Date): string {
  return istStamp(d).replace(" IST", "");
}

const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

/** Nine and below spelled out, ten and above as digits. */
export function countWord(n: number, lower = false): string {
  const w = n >= 0 && n <= 9 ? WORDS[n]! : String(n);
  return lower ? w.toLowerCase() : w;
}

export function daysSince(date: string, now = new Date()): number {
  const d = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((t - d) / 86_400_000));
}

export function freshness(date: string, now = new Date()): string {
  const n = daysSince(date, now);
  return n === 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`;
}

/** Human source names for chips. */
export function sourceLabel(name: string, url: string): string {
  const known: Record<string, string> = {
    inc42: "Inc42", yourstory: "YourStory", "supply-chain-dive": "Supply Chain Dive", "the-loadstar": "The Loadstar",
    "et-infra": "ET Infra", joc: "JOC", "firm-rss": "Blog", "podcast-index": "Podcast", youtube: "YouTube",
    "sec-form-d": "SEC filing", "linkedin-index": "LinkedIn", "portfolio-diff": "Portfolio page",
  };
  if (known[name]) return known[name]!;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.endsWith("linkedin.com")) return "LinkedIn";
    if (host.endsWith("substack.com")) return "Newsletter";
    return host;
  } catch {
    return "Source";
  }
}
