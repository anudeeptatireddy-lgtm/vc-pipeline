// Majority vote over repeated Gemini classifications of the same page.
// Gemini 3 has no temperature control, so the same article can come back
// "fit" one run and "partial" the next. Each run adds one vote; the stored
// classification is the verdict with the most votes (ties keep the current one).

export interface Verdict {
  sector_fit: string;
  customer_type: string;
  offering_type: string;
  round_stage: string;
}

export const verdictKey = (v: Verdict) => [v.sector_fit, v.customer_type, v.offering_type, v.round_stage].join("|");

export function parseVerdict(key: string): Verdict {
  const [sector_fit, customer_type, offering_type, round_stage] = key.split("|") as [string, string, string, string];
  return { sector_fit, customer_type, offering_type, round_stage };
}

/** Add a vote; return the new tallies and the winning verdict key. */
export function vote(current: Verdict, votes: Record<string, number>, incoming: Verdict): { votes: Record<string, number>; winner: string } {
  const tally = { ...votes };
  const currentKey = verdictKey(current);
  if (Object.keys(tally).length === 0) tally[currentKey] = 1; // rows stored before voting existed
  const inKey = verdictKey(incoming);
  tally[inKey] = (tally[inKey] ?? 0) + 1;
  let winner = currentKey;
  for (const [k, n] of Object.entries(tally)) if (n > (tally[winner] ?? 0)) winner = k;
  return { votes: tally, winner };
}
