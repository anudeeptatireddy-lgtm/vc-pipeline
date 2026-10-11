import { describe, expect, it } from "vitest";
import { verdictKey, vote } from "@/lib/classify";

const fit = { sector_fit: "fit", customer_type: "b2b", offering_type: "software", round_stage: "not-a-deal" };
const partial = { ...fit, sector_fit: "partial" };

describe("classification majority vote", () => {
  it("a single flip doesn't change the stored verdict (tie keeps current)", () => {
    const r = vote(fit, {}, partial);
    expect(r.winner).toBe(verdictKey(fit));
    expect(r.votes).toEqual({ [verdictKey(fit)]: 1, [verdictKey(partial)]: 1 });
  });
  it("a wrong first call is corrected once the other verdict wins the majority", () => {
    let votes: Record<string, number> = {};
    let current = partial; // wrong first call
    for (let i = 0; i < 2; i++) {
      const r = vote(current, votes, fit);
      votes = r.votes;
      if (r.winner !== verdictKey(current)) current = fit;
    }
    expect(current).toEqual(fit);
    expect(votes[verdictKey(fit)]).toBe(2);
  });
});
