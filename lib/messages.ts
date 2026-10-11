// Draft outreach for one contact (Gemini is the only AI). Messages use only:
// the person's title/focus/bio from the firm's site, the firm's best real
// signal, and data/founder.json. Code validates every draft; anything that
// fails is regenerated once, then dropped (never stored broken).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { geminiJson } from "./gemini";

export interface Founder {
  founder_name: string;
  company: string;
  one_liner: string;
  city: string;
  round: string;
  traction: string;
  ask: string;
}

export function loadFounder(): Founder {
  return JSON.parse(readFileSync(join(process.cwd(), "data/founder.json"), "utf8")) as Founder;
}

export interface ContactFacts {
  name: string;
  title: string | null;
  poc_level: string;
  focus: string | null;
  bio: string | null;
}

export interface SignalFacts {
  summary: string;
  date: string;
  evidence: string | null;
  source: string;
  relevance: string;
}

export const Drafts = z.object({
  email_subject: z.string(),
  email_body: z.string(),
  linkedin_note: z.string(),
  follow_up: z.string().describe("empty unless asked for"),
});
export type Drafts = z.infer<typeof Drafts>;

const FLATTERY = /\b(huge fan|big fan|admire|love what you|amazing|incredible|impressive work|thought leader|visionary)\b/i;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const placeholders = (s: string) => [...s.matchAll(/\[[^\]]+\]/g)].map((m) => m[0]);

/** Rules from docs/dashboard-design.md §7, applied to every draft. Returns the problems found. */
export function checkDrafts(d: Drafts, founder: Founder, wantFollowUp: boolean): string[] {
  const problems: string[] = [];
  const all = `${d.email_subject} ${d.email_body} ${d.linkedin_note} ${d.follow_up}`;
  if (all.includes("!")) problems.push("no exclamation marks");
  if (FLATTERY.test(all)) problems.push("no flattery");
  if (d.linkedin_note.length > 300) problems.push(`LinkedIn note is ${d.linkedin_note.length} chars (max 300)`);
  if (words(d.email_body) > 160) problems.push(`email is ${words(d.email_body)} words (max 160)`);
  if (words(d.email_subject) > 12) problems.push("subject too long");
  if (wantFollowUp && !d.follow_up.trim()) problems.push("missing follow-up");
  if (wantFollowUp && words(d.follow_up) > 80) problems.push("follow-up too long (max 80 words)");
  // Unknown founder facts must stay as visible [placeholders], not be invented.
  for (const p of [founder.company, founder.traction].flatMap(placeholders)) {
    if (d.email_body.includes(p.slice(1, -1)) && !d.email_body.includes(p)) problems.push(`keep the placeholder ${p} exactly`);
  }
  return problems;
}

export function buildPrompt(c: ContactFacts, firm: string, signal: SignalFacts | null, founder: Founder, wantFollowUp: boolean): string {
  return `Write cold outreach from a founder to one investor. Plain, specific, short. First person ("I"), from ${founder.founder_name}.

FOUNDER (use exactly; keep any [bracketed] text exactly as written, do not fill it in)
- Company: ${founder.company}, ${founder.one_liner}, based in ${founder.city}
- Raising: ${founder.round}
- Traction: ${founder.traction}
- Ask: ${founder.ask}

INVESTOR
- ${c.name}, ${c.title ?? "investor"} at ${firm} (${c.poc_level.replace("_", " ")})
- Focus (from their firm's site): ${c.focus ?? "not stated"}
- Bio (from their firm's site): ${c.bio ?? "not stated"}

WHY NOW (a real, dated public signal about the firm or this person)
${signal ? `- ${signal.summary} (${signal.date}, via ${signal.source}; fit: ${signal.relevance})${signal.evidence ? `\n- Evidence quote: "${signal.evidence}"` : ""}` : "- No recent signal. Refer only to their stated focus."}

RULES
- Mention only facts given above. Never invent a shared connection, a meeting, a compliment, or their intentions.
- Open with the signal (or their stated focus), then one sentence on why a B2B logistics SaaS at seed fits it, then the ask.
- No exclamation marks, no flattery ("big fan", "admire", "impressive"), no filler.
- email_subject: max 10 words. email_body: 70–140 words, greeting "Hi ${c.name.split(" ")[0]},", sign off with ${founder.founder_name}.
- linkedin_note: max 280 characters, for a connection request.
- follow_up: ${wantFollowUp ? "max 60 words; acknowledge the earlier message, reference the signal, no guilt or pressure." : "empty string."}`;
}

/** Draft, validate, retry once with the problems listed; null if still failing. */
export async function draftMessages(
  c: ContactFacts,
  firm: string,
  signal: SignalFacts | null,
  wantFollowUp: boolean,
  founder = loadFounder(),
): Promise<Drafts | null> {
  let prompt = buildPrompt(c, firm, signal, founder, wantFollowUp);
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data } = await geminiJson(prompt, Drafts, { timeoutMs: 60_000 });
    const d = { ...data, follow_up: wantFollowUp ? data.follow_up : "" };
    const problems = checkDrafts(d, founder, wantFollowUp);
    if (problems.length === 0) return d;
    prompt += `\n\nYour previous draft broke these rules; fix them: ${problems.join("; ")}`;
  }
  return null;
}
