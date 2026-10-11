import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isAllowed, parseRobots } from "@/lib/http";
import { parseCsv, toSeedRows } from "@/lib/seed/csv";
import { demoManualColumns } from "@/lib/seed/demo";
import {
  extractSiteLinks, feedForBlog, firmTokens, normaliseLinkedinProfile, pageMatchesFirm, youtubeChannelId,
} from "@/lib/seed/site";

const home = readFileSync("tests/fixtures/firm-home.html", "utf8");

describe("csv", () => {
  it("handles quotes, escaped quotes and commas", () => {
    const rows = parseCsv('a,b\n"x, y","say ""hi"""\r\n1,2\n');
    expect(rows).toEqual([{ a: "x, y", b: 'say "hi"' }, { a: "1", b: "2" }]);
  });
  it("parses the real seed list: 50 active rows, archived rows kept, unique ids", () => {
    const rows = toSeedRows(parseCsv(readFileSync("data/vc-seed-list.csv", "utf8")));
    expect(rows.filter((r) => r.archived !== "yes")).toHaveLength(50);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    for (const r of rows.filter((x) => x.archived === "yes")) expect(r.archived_reason).toBeTruthy();
  });
});

describe("firm matching", () => {
  it("keeps distinctive tokens", () => {
    expect(firmTokens("Peak XV Partners (Surge)")).toEqual(["peak", "xv"]);
    expect(firmTokens("Z47 (Matrix Partners India)")).toEqual(["z47"]);
    expect(firmTokens("8VC")).toEqual(["8vc"]);
    expect(firmTokens("Accel India")).toEqual(["accel"]);
  });
  it("matches the right page and ignores script text", () => {
    expect(pageMatchesFirm(home, "Dynamo Ventures")).toBe(true);
    expect(pageMatchesFirm(home, "Fake Capital")).toBe(false);
    expect(pageMatchesFirm("<title>Accelerate</title>", "Accel India")).toBe(false);
  });
});

describe("site links", () => {
  const links = extractSiteLinks(home, "https://dynamo.vc/");
  it("finds portfolio, team, feeds and socials", () => {
    expect(links.portfolio).toEqual(["https://dynamo.vc/portfolio"]);
    expect(links.team).toEqual(["https://dynamo.vc/team"]);
    expect(links.feeds).toEqual(["https://dynamo.vc/blog/rss.xml"]);
    expect(links.substackOrMedium).toEqual(["https://dynamo.substack.com/p/hello"]);
    expect(links.youtube).toEqual(["https://www.youtube.com/@dynamovc"]);
    expect(links.linkedinCompany).toEqual(["https://www.linkedin.com/company/dynamo-ventures/"]);
  });
  it("maps blogs to feeds", () => {
    expect(feedForBlog("https://dynamo.substack.com/p/hello")).toBe("https://dynamo.substack.com/feed");
    expect(feedForBlog("https://medium.com/@someone/post-123")).toBe("https://medium.com/feed/@someone");
  });
  it("reads youtube channel ids", () => {
    expect(youtubeChannelId("https://www.youtube.com/channel/UC1234567890123456789012")).toBe("UC1234567890123456789012");
    expect(youtubeChannelId("https://www.youtube.com/@x", '"externalId":"UCabcdefghijklmnopqrstuv"')).toBe("UCabcdefghijklmnopqrstuv");
    expect(youtubeChannelId("https://www.youtube.com/@x", "nothing")).toBeNull();
  });
  it("normalises linkedin person profiles only", () => {
    expect(normaliseLinkedinProfile("https://in.linkedin.com/in/jane-doe-123?trk=x")).toBe("https://www.linkedin.com/in/jane-doe-123");
    expect(normaliseLinkedinProfile("https://www.linkedin.com/company/acme")).toBeNull();
  });
});

describe("robots.txt", () => {
  const rules = parseRobots(`User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /private\nAllow: /private/ok\nDisallow: /*.pdf$\n`);
  it("applies only the * group with longest match", () => {
    expect(isAllowed(rules, "/")).toBe(true);
    expect(isAllowed(rules, "/private/x")).toBe(false);
    expect(isAllowed(rules, "/private/ok/y")).toBe(true);
    expect(isAllowed(rules, "/deck.pdf")).toBe(false);
    expect(isAllowed(rules, "/deck.pdf?x=1")).toBe(true);
  });
});

describe("demo manual columns", () => {
  const rows = toSeedRows(parseCsv(readFileSync("data/vc-seed-list.csv", "utf8"))).filter((r) => r.archived !== "yes");
  const today = new Date("2026-10-11T00:00:00Z");
  it("labels everything [DEMO] and is deterministic", () => {
    for (const r of rows) {
      const d = demoManualColumns(r, today);
      expect(d.personal_notes.startsWith("[DEMO] ")).toBe(true);
      if (d.contact_history) expect(d.contact_history.startsWith("[DEMO] ")).toBe(true);
      expect(d.status === "waiting_for_response").toBe(d.last_contact_date !== null);
      expect(demoManualColumns(r, today)).toEqual(d);
    }
  });
  it("mixes statuses", () => {
    const waiting = rows.filter((r) => demoManualColumns(r, today).status === "waiting_for_response").length;
    expect(waiting).toBeGreaterThan(5);
    expect(waiting).toBeLessThan(35);
  });
});

describe("isFirmSite", () => {
  it("rejects a same-name site that isn't an investor", async () => {
    const { isFirmSite } = await import("@/lib/seed/site");
    expect(isFirmSite("<title>Mela Water | Purifiers</title><body>Buy RO purifiers</body>", "Mela Ventures")).toBe(false);
    expect(isFirmSite("<title>Mela Ventures</title><body>Our portfolio</body>", "Mela Ventures")).toBe(true);
  });
});
