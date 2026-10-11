import { describe, expect, it } from "vitest";
import { TYPES } from "@/lib/sql";

describe("Neon type parsers", () => {
  const p = (oid: number) => TYPES.getTypeParser(oid, "text") as (v: string) => unknown;
  it("keeps dates as YYYY-MM-DD (no timezone shift)", () => expect(p(1082)("2026-09-14")).toBe("2026-09-14"));
  it("returns numerics and bigints as numbers", () => {
    expect(p(1700)("0.807")).toBe(0.807);
    expect(p(20)("42")).toBe(42);
  });
  it("returns timestamptz as ISO", () => {
    expect(p(1184)("2026-10-11 11:39:01.556+00")).toBe("2026-10-11T11:39:01.556Z");
    expect(p(1184)("2026-10-11 17:09:01+05:30")).toBe("2026-10-11T11:39:01.000Z");
  });
});
