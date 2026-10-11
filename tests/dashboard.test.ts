import { describe, expect, it } from "vitest";
import { fitText } from "@/components/FitLine";
import { countWord, freshness, nextRun } from "@/lib/format";
import { runState, sortRows, type DashboardRow, type RunRow } from "@/lib/queries";

const run = (o: Partial<RunRow>): RunRow => ({
  id: 1, started_at: new Date().toISOString(), finished_at: null, trigger: "cron", vcs_processed: 0, errors: [], usage: {}, ...o,
});

describe("run state (never blank, §9)", () => {
  const now = Date.parse("2026-10-11T12:00:00Z");
  it("classifies runs", () => {
    expect(runState(null, now)).toBe("none");
    expect(runState(run({ finished_at: "2026-10-11T11:00:00Z" }), now)).toBe("ok");
    expect(runState(run({ started_at: "2026-10-11T11:55:00Z" }), now)).toBe("running");
    expect(runState(run({ started_at: "2026-10-11T11:00:00Z" }), now)).toBe("failed"); // never finished
    expect(runState(run({ finished_at: "2026-10-11T11:00:00Z", errors: [{ message: "run failed: boom" }] }), now)).toBe("failed");
  });
});

describe("ordering (§6)", () => {
  const r = (id: string, bucket: DashboardRow["bucket"], score: number, date: string | null): DashboardRow =>
    ({ id, firm: id, bucket, score, lastSignalDate: date, top: null }) as DashboardRow;
  it("buckets first, then score, then most recent", () => {
    const out = sortRows([r("p", "parked", 90, null), r("n", "nudge", 70, null), r("a", "reach_out", 50, "2026-10-01"), r("b", "reach_out", 50, "2026-10-05"), r("c", "reach_out", 80, null)]);
    expect(out.map((x) => x.id)).toEqual(["c", "b", "a", "n", "p"]);
  });
});

describe("copy deck (§8)", () => {
  it("spells out nine and below", () => {
    expect(countWord(7)).toBe("Seven");
    expect(countWord(10)).toBe("10");
    expect(countWord(4, true)).toBe("four");
  });
  it("freshness", () => {
    const now = new Date("2026-10-11T10:00:00Z");
    expect(freshness("2026-10-11", now)).toBe("today");
    expect(freshness("2026-10-10", now)).toBe("yesterday");
    expect(freshness("2026-10-05", now)).toBe("6 days ago");
  });
  it("fit line", () => {
    expect(fitText({ sector: "fit", customer: "b2b", offering: "software", stage: "seed" }, "direct")).toBe("Fits: B2B, logistics, software, seed");
    expect(fitText({ sector: "fit", customer: "b2c", offering: "software", stage: "seed" }, "adjacent")).toBe("Partial fit: consumer logistics");
  });
  it("next run is Mon or Thu 08:00 IST", () => {
    expect(nextRun(new Date("2026-10-11T06:00:00Z")).toISOString()).toBe("2026-10-12T02:30:00.000Z"); // Sun → Mon
    expect(nextRun(new Date("2026-10-12T03:00:00Z")).toISOString()).toBe("2026-10-15T02:30:00.000Z"); // Mon after run → Thu
  });
});
