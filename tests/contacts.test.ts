import { describe, expect, it } from "vitest";
import { findEmails, findPitchLinks, findXLink, firmEmails, isRelevant, personalEmail, pocLevel, profileLinksByName, rankContacts } from "@/lib/contacts";

describe("poc level", () => {
  it("maps titles", () => {
    expect(pocLevel("Managing Partner")).toBe("decision_maker");
    expect(pocLevel("Co-founder & General Partner")).toBe("decision_maker");
    expect(pocLevel("Partner")).toBe("partner");
    expect(pocLevel("Venture Partner")).toBe("partner");
    expect(pocLevel("Principal")).toBe("principal");
    expect(pocLevel("Vice President")).toBe("principal");
    expect(pocLevel("Investment Associate")).toBe("associate");
    expect(pocLevel("Head of Platform")).toBe("principal");
    expect(pocLevel("Office Manager")).toBe("other");
  });
});

describe("ranking", () => {
  it("puts relevant decision-makers first, then partners", () => {
    const people = [
      { n: "a", poc_level: "associate" as const, relevant: true },
      { n: "b", poc_level: "decision_maker" as const, relevant: false },
      { n: "c", poc_level: "partner" as const, relevant: true },
      { n: "d", poc_level: "decision_maker" as const, relevant: true },
    ];
    expect(rankContacts(people).map((p) => p.n)).toEqual(["d", "c", "b", "a"]);
    expect(isRelevant("Invests in supply chain and B2B SaaS")).toBe(true);
    expect(isRelevant("Consumer brands")).toBe(false);
  });
});

const html = `<body>
  <div class="card"><h3>Asha Rao</h3><p>Partner, supply chain</p><a href="https://www.linkedin.com/in/asharao?trk=x">in</a></div>
  <div class="card"><h3>Dev Iyer</h3><p>Principal</p><a href="https://x.com/deviyer">x</a></div>
  <div class="grid"><span>Ravi</span><span>Mina</span><a href="https://www.linkedin.com/in/ambiguous">in</a></div>
  <a href="mailto:pitch@fund.vc">Send your pitch</a> Contact asha@fund.vc or hello@fund.vc. <img src="logo@2x.png">
  <a href="/apply">Apply for funding</a> <a href="https://forms.gle/abc">Submit your pitch</a> <a href="https://evil.com/pitch">pitch</a>
  <a href="https://twitter.com/fundvc">Twitter</a>
</body>`;

describe("page extraction", () => {
  it("finds published emails, not image names", () => {
    expect(findEmails(html).sort()).toEqual(["asha@fund.vc", "hello@fund.vc", "pitch@fund.vc"]);
  });
  it("splits personal and firm emails by name", () => {
    expect(personalEmail("Asha Rao", findEmails(html))).toBe("asha@fund.vc");
    expect(firmEmails(findEmails(html), ["Asha Rao", "Dev Iyer"]).sort()).toEqual(["hello@fund.vc", "pitch@fund.vc"]);
  });
  it("finds pitch links on the firm's site or form hosts only", () => {
    expect(findPitchLinks(html, "https://fund.vc/")).toEqual(["mailto:pitch@fund.vc", "https://fund.vc/apply", "https://forms.gle/abc"].filter((u) => !u.startsWith("mailto")));
  });
  it("matches profile links to the right person, skipping ambiguous cards", () => {
    expect(profileLinksByName(html, ["Asha Rao", "Dev Iyer", "Ravi", "Mina"])).toEqual({
      "Asha Rao": { linkedin: "https://www.linkedin.com/in/asharao" },
      "Dev Iyer": { x: "https://x.com/deviyer" },
    });
    expect(findXLink(html)).toBe("https://x.com/deviyer");
  });
});

describe("message rules", () => {
  it("rejects exclamation marks, flattery, long notes and invented placeholders", async () => {
    const { checkDrafts } = await import("@/lib/messages");
    const founder = { founder_name: "Vikram", company: "[Company]", one_liner: "x", city: "Bengaluru", round: "Seed", traction: "[traction]", ask: "a call" };
    const ok = { email_subject: "CargoFL seed and Indian shipper software", email_body: "Hi Asha, I saw you led the CargoFL seed. I'm building [Company]. [traction]. Open to a call? Vikram", linkedin_note: "Saw the CargoFL seed. Building [Company] for Indian shippers.", follow_up: "" };
    expect(checkDrafts(ok, founder, false)).toEqual([]);
    expect(checkDrafts({ ...ok, email_body: ok.email_body + " Huge fan!" }, founder, false)).toEqual(["no exclamation marks", "no flattery"]);
    expect(checkDrafts({ ...ok, linkedin_note: "x".repeat(301) }, founder, false)[0]).toMatch(/301 chars/);
    expect(checkDrafts({ ...ok, email_body: ok.email_body.replace("[Company]", "Company") }, founder, false)).toEqual(["keep the placeholder [Company] exactly"]);
    expect(checkDrafts(ok, founder, true)).toEqual(["missing follow-up"]);
  });
});
