// Sample values for Vikram's manual columns (docs/assumptions.md A3).
// Written once, on insert only; every value is prefixed [DEMO].
import type { VcStatus } from "../types";
import type { SeedRow } from "./csv";

export interface DemoManualColumns {
  status: VcStatus;
  last_contact_date: string | null;
  contact_history: string | null;
  personal_notes: string;
}

// Deterministic per row so re-seeding a fresh DB gives the same demo.
function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

const WAITING_SHARE: Record<SeedRow["priority"], number> = { P1: 0.5, P2: 0.35, P3: 0.15 };

const CHANNELS = [
  "cold email to the partner",
  "warm intro from a portfolio founder",
  "intro via an angel in the round",
  "met at a Bengaluru founder meetup, followed up by email",
  "LinkedIn message after a podcast episode",
];

const NOTES: Record<SeedRow["priority"], string[]> = {
  P1: [
    "Strong thesis fit. Ask about their view on mid-market shipper software in India",
    "Backed a freight visibility company. Mention our carrier onboarding numbers",
    "Leads seed rounds. Want them as lead, not follow-on",
  ],
  P2: [
    "B2B SaaS generalist. Lead with revenue, not logistics jargon",
    "Has a logistics deal in portfolio but no stated thesis. Test interest with a short note",
    "Good for follow-on. Keep warm",
  ],
  P3: [
    "Probably off-thesis or later-stage. Track only",
    "Corporate/strategic. Useful for partnerships more than the seed round",
    "Low priority unless they post about supply chain",
  ],
};

export function demoManualColumns(row: SeedRow, today = new Date()): DemoManualColumns {
  const h = hash(row.id);
  const waiting = (h % 100) / 100 < WAITING_SHARE[row.priority];
  const notes = NOTES[row.priority];
  const personal_notes = `[DEMO] ${notes[h % notes.length]}`;
  if (!waiting) {
    return { status: "yet_to_reach_out", last_contact_date: null, contact_history: null, personal_notes };
  }
  const daysAgo = 4 + (h % 38); // 4–41 days: mixes "contacted recently" and "> 14 days"
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  const date = d.toISOString().slice(0, 10);
  const channel = CHANNELS[h % CHANNELS.length];
  return {
    status: "waiting_for_response",
    last_contact_date: date,
    contact_history: `[DEMO] ${date}: ${channel}; sent the deck, no reply yet`,
    personal_notes,
  };
}
