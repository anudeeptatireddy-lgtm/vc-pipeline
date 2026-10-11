import { describe, expect, it } from "vitest";
import {
  firmFit, followUpScore, logisticsRelevance, OFF_THESIS_CAP, recommendedAction, signalSummary, signalValue,
  stageMultiplier, type ScorableSignal,
} from "@/lib/score";
import { RECOMMENDED_ACTIONS } from "@/lib/types";

const today = new Date("2026-10-11T06:00:00Z");

describe("§4.0 examples → relevance", () => {
  it("TMS seed → direct", () => expect(logisticsRelevance("fit", "b2b", "software")).toBe("direct"));
  it("warehouse robotics Series A → adjacent", () => {
    expect(logisticsRelevance("fit", "b2b", "hardware")).toBe("adjacent");
    expect(stageMultiplier("series-a")).toBe(1.0);
  });
  it("consumer parcel-delivery seed → adjacent", () => expect(logisticsRelevance("fit", "b2c", "software")).toBe("adjacent"));
  it("e-bike rental Series C → unrelated", () => {
    expect(logisticsRelevance("partial", "b2c", "asset_heavy")).toBe("unrelated");
    expect(stageMultiplier("series-b-plus")).toBe(0.5);
  });
  it("essay on freight-broker AI → direct", () => expect(logisticsRelevance("fit", "b2b", "software")).toBe("direct"));
  it("logistics fintech / software-led marketplace → thematic", () => {
    expect(logisticsRelevance("fit", "b2b", "fintech")).toBe("thematic");
    expect(logisticsRelevance("fit", "b2b2c", "marketplace")).toBe("thematic");
  });
  it("general B2B SaaS → adjacent; consumer anything else → unrelated", () => {
    expect(logisticsRelevance("partial", "b2b", "software")).toBe("adjacent");
    expect(logisticsRelevance("none", "b2b", "software")).toBe("unrelated");
  });
});

const sig = (o: Partial<ScorableSignal>): ScorableSignal => ({
  signal_type: "investment", logistics_relevance: "direct", round_stage: "seed", confidence: 0.85,
  published_date: "2026-10-05", source_name: "exa", company_name: "FreightCo", summary: "Led seed in FreightCo", corroborated_by: null, ...o,
});

describe("§8.3 score", () => {
  it("signal value follows the formula", () => {
    const v = signalValue(sig({}), today);
    expect(v).toBeCloseTo(40 * 1.5 * 1.3 * 0.85 * Math.exp(-6 / 14), 6);
  });
  it("direct seed investment from a seed-leading logistics fund scores high", () => {
    const fit = firmFit({ does_seed: "leads_seed", b2b_logistics_thesis: "core", investor_type: "seed_fund" });
    expect(followUpScore([sig({})], fit, today)).toBeGreaterThanOrEqual(60);
  });
  it("caps off-thesis activity at 45", () => {
    const loud = [1, 2, 3].map((d) => sig({ logistics_relevance: "unrelated", published_date: `2026-10-0${d + 6}`, confidence: 1, company_name: `C${d}` }));
    expect(followUpScore(loud, 2, today)).toBeLessThanOrEqual(OFF_THESIS_CAP);
  });
  it("adds 10 when two sources agree on a company", () => {
    const one = followUpScore([sig({ signal_type: "writing", round_stage: "not-a-deal", logistics_relevance: "thematic" })], 1, today);
    const two = followUpScore([sig({ signal_type: "writing", round_stage: "not-a-deal", logistics_relevance: "thematic", corroborated_by: "rss" })], 1, today);
    expect(two - one).toBe(10);
  });
  it("no signals → 0", () => expect(followUpScore([], 1.2, today)).toBe(0));
});

describe("§8.4 action", () => {
  it("maps score × status", () => {
    expect(recommendedAction(72, "yet_to_reach_out", null, today)).toBe(RECOMMENDED_ACTIONS.reachOut);
    expect(recommendedAction(72, "waiting_for_response", "2026-10-01", today)).toBe(RECOMMENDED_ACTIONS.nudge);
    expect(recommendedAction(45, null, null, today)).toBe(RECOMMENDED_ACTIONS.reachOutLower);
    expect(recommendedAction(45, "waiting_for_response", "2026-09-01", today)).toBe(RECOMMENDED_ACTIONS.nudgeLower);
    expect(recommendedAction(45, "waiting_for_response", "2026-10-05", today)).toBe(RECOMMENDED_ACTIONS.hold);
    expect(recommendedAction(10, "yet_to_reach_out", null, today)).toBe(RECOMMENDED_ACTIONS.quiet);
    expect(recommendedAction(10, "waiting_for_response", null, today)).toBe(RECOMMENDED_ACTIONS.hold);
  });
});

describe("summary", () => {
  it("leads with the best on-thesis signal", () => {
    const s = signalSummary([sig({ logistics_relevance: "unrelated", summary: "Series C in BikeCo", published_date: "2026-10-10" }), sig({})], today);
    expect(s).toBe("Led seed in FreightCo, 6 days ago");
  });
  it("says so when only unrelated activity exists", () => {
    expect(signalSummary([sig({ logistics_relevance: "unrelated", summary: "Series C in BikeCo.", published_date: "2026-10-10" })], today)).toBe(
      "Active, but no B2B logistics signal (last: Series C in BikeCo, yesterday)",
    );
  });
});
