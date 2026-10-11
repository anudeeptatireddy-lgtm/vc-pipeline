import { describe, expect, it } from "vitest";
import { headline } from "@/components/triage/Briefing";
import { queueLine } from "@/components/triage/labels";
import { countWord, freshness, nextRun } from "@/lib/format";
import { runState, sortRows, type RunRow, type TriageRow } from "@/lib/queries";
import { statusPill } from "@/lib/status";

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

const row = (id: string, lane: TriageRow["lane"], score: number, date: string | null, lead: TriageRow["lead"] = null): TriageRow =>
  ({ id, firm: id, lane, score, lastSignalDate: date, lead }) as TriageRow;

describe("ordering (§6)", () => {
  it("lanes first, then score, then most recent", () => {
    const out = sortRows([row("p", "parked", 90, null), row("n", "follow", 70, null), row("m", "maybe", 99, null), row("a", "today", 65, "2026-10-01"), row("b", "today", 65, "2026-10-05"), row("c", "today", 80, null)]);
    expect(out.map((x) => x.id)).toEqual(["c", "b", "a", "n", "m", "p"]);
  });
});

describe("briefing copy (§8)", () => {
  it("only lanes that pass the 60 rule count as worth a message", () => {
    expect(headline([row("a", "maybe", 58, null), row("b", "follow", 65, null)])).toEqual({
      h: "No one needs a first message today.",
      sub: "One investor you're waiting on has news you can follow up with. One more is worth a look if you have time.",
    });
    expect(headline([row("a", "today", 70, null), row("b", "today", 61, null)]).h).toBe("Two investors are worth a message today.");
  });
  it("queue line leads with deal facts", () => {
    const lead = { type: "investment", summary: "x", date: "2026-10-05", deal: { company: "Lantern", round: "Seed", size: "$7.0 million", role: "Co-led" }, url: "", source: "", quote: null, confirmed: false, line: null, lineKind: "opening" as const };
    expect(queueLine(row("a", "follow", 65, "2026-10-05", lead))).toBe("Co-led Lantern · Seed · $7.0 million");
    expect(queueLine(row("a", "follow", 65, "2026-10-05", { ...lead, type: "writing", deal: null, summary: "Wrote about freight" }))).toBe("Essay: Wrote about freight");
  });
  it("status pill is calm and counts sources", () => {
    const good = run({ id: 2, finished_at: "2026-10-11T17:38:00Z", vcs_processed: 50, errors: [{ source: "youtube", message: "youtube search 429 (skipped for the rest of this run)" }] });
    expect(statusPill({ runState: "ok", lastGoodRun: good, latestRun: good }).text).toBe("Checked 9 of 10 sources. Updated Sun 23:08 IST");
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
  it("next run is Mon or Thu 08:00 IST", () => {
    expect(nextRun(new Date("2026-10-11T06:00:00Z")).toISOString()).toBe("2026-10-12T02:30:00.000Z"); // Sun → Mon
    expect(nextRun(new Date("2026-10-12T03:00:00Z")).toISOString()).toBe("2026-10-15T02:30:00.000Z"); // Mon after run → Thu
  });
});
