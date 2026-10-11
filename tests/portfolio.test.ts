import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canonical, confirmedAdditions, diffPortfolio, extractEntries, extractEntriesFromMarkdown, hashEntries,
} from "@/lib/portfolio";

const run1 = extractEntries(readFileSync("tests/fixtures/portfolio-run1.html", "utf8"), "https://dynamo.vc/portfolio");
const run2 = extractEntries(readFileSync("tests/fixtures/portfolio-run2.html", "utf8"), "https://dynamo.vc/portfolio");

describe("portfolio extraction", () => {
  it("keeps outbound company links and child profile pages, drops other own-site links, social, nav and scripts", () => {
    expect(run1).toEqual([
      { name: "Stord", domain: "stord.com" },
      { name: "Raft", domain: "raft.ai" },
      { name: "Leaf Logistics", domain: "leaflogistics.com" },
      { name: "Internal", domain: "dynamo.vc/portfolio/x" },
      { name: "Flock Freight", domain: "flock.example.com" },
    ]);
  });
  it("reads Jina markdown", () => {
    expect(extractEntriesFromMarkdown("[![Stord](x.png)](https://stord.com) [Home](https://dynamo.vc/)", "https://dynamo.vc/p")).toEqual([
      { name: "Stord", domain: "stord.com" },
    ]);
  });
  it("canonicalises names when there's no domain", () => {
    expect(canonical({ name: "Acme Technologies Pvt. Ltd." })).toBe("acme");
  });
});

describe("diff and debounce", () => {
  it("detects exactly the added company", () => {
    expect(diffPortfolio(run1, run2)).toEqual({ added: [{ name: "FreightFox", domain: "freightfox.example" }], removed: [] });
    expect(hashEntries(run1)).not.toBe(hashEntries(run2));
    expect(hashEntries(run1)).toBe(hashEntries([...run1].reverse()));
  });
  it("alerts only after the addition shows up in two consecutive runs", () => {
    expect(confirmedAdditions([run1])).toEqual([]);
    expect(confirmedAdditions([run1, run2])).toEqual([]); // seen once
    expect(confirmedAdditions([run1, run2, run2])).toEqual([{ name: "FreightFox", domain: "freightfox.example" }]);
    expect(confirmedAdditions([run2, run2, run2])).toEqual([]); // already known, no repeat alert
    expect(confirmedAdditions([run1, run2, run1])).toEqual([]); // flicker (A/B test, broken render)
  });
});

describe("internal profile pages", () => {
  it("counts /portfolio/<slug> children and ignores generic link text", () => {
    const html = `<main><a href="/portfolio/freight-fox">View Website</a><a href="/portfolio/stord">Stord</a>
      <a href="/portfolio/stord/team">deeper</a><a href="/about">About</a><a href="https://acme.io">here</a></main>`;
    expect(extractEntries(html, "https://firm.vc/portfolio/")).toEqual([
      { name: "freight fox", domain: "firm.vc/portfolio/freight-fox" },
      { name: "Stord", domain: "firm.vc/portfolio/stord" },
      { name: "acme.io", domain: "acme.io" },
    ]);
  });
});

describe("logo walls", () => {
  it("reads company names from image alt text, skipping generic alts and the firm itself", async () => {
    const { extractLogoEntries } = await import("@/lib/portfolio");
    const html = `<header><img alt="Peak XV logo"></header><main>
      <img alt="Zepto logo"><img alt="Pine Labs"><img alt="arrow"><img alt="company-logo.png"><img alt="Peak XV Partners">
      <img alt="A very long alternative text describing a photo of people"></main>`;
    expect(extractLogoEntries(html, "Peak XV Partners").map((e) => e.name)).toEqual(["Zepto", "Pine Labs"]);
  });
});
