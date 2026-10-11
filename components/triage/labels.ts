// Display copy for the triage dashboard (docs/dashboard-design.md §8). Client-safe.
import type { TriageRow } from "@/lib/queries";
import type { Lane } from "@/lib/triage";

export const LANE_CLASS: Record<Lane, string> = { today: "b-today", follow: "b-follow", maybe: "b-maybe", parked: "b-parked" };
export const LANE_SHORT: Record<Lane, string> = { today: "", follow: "f", maybe: "m", parked: "p" };
export const LANE_TITLE: Record<Lane, string> = {
  today: "Message today",
  follow: "Waiting on a reply, with something new to say",
  maybe: "Maybe, if you have time",
  parked: "Parked",
};
export const LANE_CHIP: Record<Lane, string> = { today: "Message today", follow: "Follow up", maybe: "Maybe", parked: "Parked" };
export const LANE_ACTION: Record<Lane, string> = { today: "Reach out", follow: "Nudge", maybe: "If time allows", parked: "Skip this week" };

const TYPE: Record<string, string> = {
  investment: "Deal", writing: "Essay", interview: "Interview", event: "Talk", fund_close: "New fund",
  team_change: "Team change", social_post: "Post", other: "News",
};
export const typeLabel = (t: string) => TYPE[t] ?? "News";

const PLAIN: Record<string, string> = {
  leads_seed: "Leads seed rounds", participates_seed: "Joins seed rounds, rarely leads", series_a_plus_only: "Series A and later",
  unknown: "Not clear", core: "Dedicated supply-chain fund", explicit: "Logistics is in the stated thesis",
  portfolio_only: "Logistics deals, no stated thesis", none: "No logistics focus", seed_fund: "Seed fund",
  multi_stage: "Multi-stage fund", cvc_strategic: "Corporate venture arm", angel_syndicate: "Angel network", accelerator: "Accelerator",
};
export const plain = (s: string | null) => (s ? (PLAIN[s] ?? s) : "Not known");

/** "4 Oct" */
export function shortDate(d: string): string {
  return new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function daysAgo(d: string, now = new Date()): number {
  const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((t - Date.parse(`${d.slice(0, 10)}T00:00:00Z`)) / 86_400_000));
}

/** One line under the firm name in the queue, board and search. */
export function queueLine(r: TriageRow): string {
  if (!r.lead || r.lane === "parked") return r.lastSignalDate ? `Last signal ${shortDate(r.lastSignalDate)}` : "No activity found in 30 days";
  const d = r.lead.deal;
  if (d && d.company) return [`${d.role ?? "Invested in"} ${d.company}`, d.round, d.size].filter(Boolean).join(" · ");
  return `${typeLabel(r.lead.type)}: ${r.lead.summary}`;
}

export function yoursText(r: Pick<TriageRow, "status" | "lastContactDate">): string {
  if (r.status === "waiting_for_response") {
    return r.lastContactDate ? `Yours: waiting for ${daysAgo(r.lastContactDate)} days` : "Yours: waiting for a reply";
  }
  return "Yours: yet to reach out";
}

const TAG_NAME = { seed: "Seed", b2b: "B2B", logistics: "Logistics", software: "Software" } as const;

/** Why a row sits where it does, in one calm sentence (no raw scores as the headline). */
export function laneReason(r: TriageRow): string {
  if (r.lane === "today") return "Fresh, on-thesis and a confirmed fit. Worth a first message this week.";
  if (r.lane === "follow") return "You're waiting on a reply, and this gives you a natural reason to follow up.";
  if (r.lane === "parked") return "No B2B logistics signal strong enough in the last 30 days, so there is nothing to act on this week.";
  const misses = r.tags ? (Object.keys(TAG_NAME) as (keyof typeof TAG_NAME)[]).filter((k) => r.tags![k] !== "yes").map((k) => TAG_NAME[k]) : [];
  if (r.status === "waiting_for_response" && /hold/i.test(r.action)) return "You contacted them recently. Give it a few more days before following up.";
  if (r.score >= 60) return `Strong activity, but the fit isn't confirmed on ${misses.join(", ")}. Check before you message.`;
  return misses.length
    ? `Worth a look if you have time. Not yet strong enough for a message today, and the fit isn't confirmed on ${misses.join(", ")}.`
    : "Worth a look if you have time. Relevant, but not yet strong enough for a message today.";
}

export const TAG_LABELS = TAG_NAME;
