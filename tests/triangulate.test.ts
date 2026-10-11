import { describe, expect, it } from "vitest";
import { triangulate, type Triangulable } from "@/lib/triangulate";

const s = (o: Partial<Triangulable>): Triangulable => ({
  signal_type: "investment", source_tier: "C", source_name: "inc42", company_name: "FreightFox",
  published_date: "2026-10-05", confidence: 0.7, corroborated_by: null, ...o,
});

describe("§8.2 triangulation", () => {
  it("upgrades a D-tier post confirmed by press within 14 days", () => {
    const post = s({ source_tier: "D", source_name: "linkedin-index", confidence: 0.5, published_date: "2026-10-01" });
    const press = s({});
    triangulate([post, press], null);
    expect(post.confidence).toBe(0.85);
    expect(post.corroborated_by).toBe("inc42");
    expect(press.corroborated_by).toBe("linkedin-index");
  });
  it("doesn't link signals more than 14 days apart or from the same source", () => {
    const a = s({ published_date: "2026-09-01" });
    const b = s({ source_name: "exa", published_date: "2026-10-05" });
    const c = s({ published_date: "2026-10-04" }); // same source as a
    triangulate([a, b, c], null);
    expect(a.corroborated_by).toBeNull();
    expect(b.corroborated_by).toBe("inc42"); // matched c
  });
  it("caps an uncorroborated social 'investment' missing from a twice-snapshotted portfolio", () => {
    const claim = s({ source_tier: "D", source_name: "linkedin-index", confidence: 0.55, company_name: "Ghost Co" });
    triangulate([claim], { runs: 2, entries: [{ name: "Stord", domain: "stord.com" }] });
    expect(claim.confidence).toBe(0.5);
    const early = s({ source_tier: "D", source_name: "linkedin-index", confidence: 0.55, company_name: "Ghost Co" });
    triangulate([early], { runs: 1, entries: [] });
    expect(early.confidence).toBe(0.55);
  });
});
