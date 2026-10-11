import { describe, expect, it } from "vitest";
import { dealFacts, fitConfirmed, fitTags, laneOf, sourcesChecked } from "@/lib/triage";

const full = { sector: "fit", customer: "b2b", offering: "software", stage: "seed" };

describe("fit tags", () => {
  it("fills, half-fills or hollows each tag", () => {
    expect(fitTags(full)).toEqual({ seed: "yes", b2b: "yes", logistics: "yes", software: "yes" });
    expect(fitTags({ ...full, stage: "series-a", sector: "partial", customer: "b2c", offering: "hardware" })).toEqual({ seed: "no", b2b: "no", logistics: "part", software: "no" });
    // An essay has no round: the firm's seed behaviour decides between partial and no.
    expect(fitTags({ ...full, stage: "not-a-deal" }, "leads_seed").seed).toBe("part");
    expect(fitTags({ ...full, stage: "not-a-deal" }, "series_a_plus_only").seed).toBe("no");
  });
  it("confirms only B2B + logistics with no clear mismatch", () => {
    expect(fitConfirmed(fitTags(full))).toBe(true);
    expect(fitConfirmed(fitTags({ ...full, stage: "series-a" }))).toBe(false);
    expect(fitConfirmed(fitTags({ ...full, sector: "partial" }))).toBe(false);
  });
});

describe("lanes", () => {
  const tags = fitTags(full);
  const base = { score: 70, status: "yet_to_reach_out" as const, hasSignal: true, tags, action: "Reach out this week" };
  it("only 60+ with a confirmed fit is worth a message today", () => {
    expect(laneOf(base)).toBe("today");
    expect(laneOf({ ...base, score: 59 })).toBe("maybe");
    expect(laneOf({ ...base, tags: fitTags({ ...full, stage: "series-a" }) })).toBe("maybe");
  });
  it("waiting rows need a nudge action and a confirmed fit", () => {
    expect(laneOf({ ...base, status: "waiting_for_response", action: "Nudge now" })).toBe("follow");
    expect(laneOf({ ...base, status: "waiting_for_response", score: 40, action: "Light nudge" })).toBe("follow");
    expect(laneOf({ ...base, status: "waiting_for_response", score: 40, action: "Hold" })).toBe("maybe");
  });
  it("parks low scores and rows without a signal", () => {
    expect(laneOf({ ...base, score: 29 })).toBe("parked");
    expect(laneOf({ ...base, hasSignal: false })).toBe("parked");
  });
});

describe("deal facts", () => {
  it("reads size and role from the summary only when stated", () => {
    expect(dealFacts({ summary: "Fuel Ventures led a £454,287 Pre-Seed funding round for Doris.", company_name: "Doris", round_stage: "pre-seed" }))
      .toEqual({ company: "Doris", round: "Pre-seed", size: "£454,287", role: "Led" });
    expect(dealFacts({ summary: "Primary co-led a $7.0 million seed round for Lantern.", company_name: "Lantern", round_stage: "seed" }).size).toBe("$7.0 million");
    expect(dealFacts({ summary: "Backed Acme in its seed round.", company_name: "Acme", round_stage: "seed" })).toMatchObject({ size: null, role: "Joined" });
  });
});

describe("sources checked", () => {
  it("counts a source as missed only when it was skipped for the run", () => {
    const r = sourcesChecked([
      { source: "youtube", message: "youtube search 429 (skipped for the rest of this run)" },
      { source: "gemini-grounding", message: "grounded call timed out; classified collected items only" },
    ]);
    expect(r).toEqual({ checked: 9, total: 10, missed: ["youtube"] });
  });
});
