// Why this VC is ranked where it is (dashboard-design.md §4, components-map §3.2).
// Order: headline reason, SignalTimeline, FirmProfileCard, Vikram's notes, score breakdown.
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fitText } from "@/components/FitLine";
import { FreshnessChip } from "@/components/FreshnessChip";
import { SignalTape } from "@/components/SignalTape";
import { WhoToContact } from "@/components/WhoToContact";
import { YoursChip } from "@/components/YoursChip";
import { daysSince, sourceLabel } from "@/lib/format";
import { getVcDetail } from "@/lib/queries";
import { daysAgo, firmFit, RELEVANCE_MULT, signalValue, stageMultiplier, TYPE_WEIGHT } from "@/lib/score";
import type { RoundStage, SignalType } from "@/lib/types";

export const dynamic = "force-dynamic";

const PLAIN: Record<string, string> = {
  leads_seed: "Leads seed rounds", participates_seed: "Joins seed rounds, rarely leads", series_a_plus_only: "Series A and later",
  unknown: "Not clear", core: "Dedicated supply-chain fund", explicit: "Logistics is in the stated thesis",
  portfolio_only: "Has logistics companies, no stated thesis", none: "No logistics focus", seed_fund: "Seed fund",
  multi_stage: "Multi-stage fund", cvc_strategic: "Corporate venture arm", angel_syndicate: "Angel network", accelerator: "Accelerator",
  investment: "Investment", fund_close: "New fund", writing: "Writing", interview: "Interview", event: "Event",
  team_change: "Team change", social_post: "Post", other: "Other",
};
const plain = (s: string | null) => (s ? (PLAIN[s] ?? s) : "Not known");

export default async function VcPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getVcDetail(id);
  if (!d) notFound();
  const { vc, signals, contacts, channels } = d;
  const today = new Date();
  const window = signals.filter((s) => daysAgo(s.published_date, today) <= 30);
  const fit = firmFit(
    vc.does_seed && vc.b2b_logistics_thesis && vc.investor_type
      ? { does_seed: vc.does_seed as never, b2b_logistics_thesis: vc.b2b_logistics_thesis as never, investor_type: vc.investor_type as never }
      : null,
  );
  const ranked = [...window]
    .map((s) => ({ s, v: signalValue({ ...s, signal_type: s.signal_type as SignalType, round_stage: s.round_stage as RoundStage, logistics_relevance: s.logistics_relevance as never }, today) }))
    .sort((a, b) => b.v - a.v);

  return (
    <div className="shell">
      <main className="main">
        <Link className="back" href="/">Back to this week</Link>
        <h1 className="headline display" style={{ marginTop: 12 }}>{vc.firm}</h1>
        <p className="subline">
          {[vc.partner_name, vc.region].filter(Boolean).join(" · ")}
        </p>
        <p className="reason" style={{ marginTop: 12 }}>{vc.signal_summary ?? "Not checked yet"}</p>
        <SignalTape daysAgo={window.map((s) => daysAgo(s.published_date, today))} tone="act" />

        <section className="section" aria-labelledby="tl-h">
          <h2 id="tl-h">Signals</h2>
          {signals.length === 0 ? (
            <p className="meta">No public activity found yet.</p>
          ) : (
            <ul className="list timeline">
              {signals.map((s) => (
                <li key={s.id}>
                  <div className="row-head">
                    <span className="meta">{plain(s.signal_type)}</span>
                    <FreshnessChip date={s.published_date} />
                  </div>
                  <p className="reason">{s.summary}</p>
                  {s.evidence_quote && <blockquote className="quote">{s.evidence_quote}</blockquote>}
                  <p className="fit">
                    {fitText({ sector: s.sector_fit, customer: s.customer_type, offering: s.offering_type, stage: s.round_stage }, s.logistics_relevance) ?? ""}
                    {s.corroborated_by ? " · Confirmed by 2 sources" : s.source_tier === "D" ? " · Unconfirmed, check the source" : ""}
                  </p>
                  <div className="row-foot">
                    <a className="chip chip-src" href={s.source_url} target="_blank" rel="noopener noreferrer">
                      {sourceLabel(s.source_name, s.source_url)} <ExternalLink size={12} aria-hidden />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                    <span className="meta">{s.published_date}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <WhoToContact contacts={contacts} channels={channels} />

        <section className="section panel" aria-labelledby="firm-h">
          <h2 id="firm-h">The firm</h2>
          <dl className="kv">
            <dt>Seed</dt><dd>{plain(vc.does_seed)}</dd>
            <dt>Logistics</dt><dd>{plain(vc.b2b_logistics_thesis)}</dd>
            <dt>Type</dt><dd>{plain(vc.investor_type)}</dd>
            <dt>Typical cheque</dt><dd>{vc.typical_check ?? "Not stated"}</dd>
            <dt>Geography</dt><dd>{vc.geo_focus ?? "Not stated"}</dd>
          </dl>
        </section>

        <section className="section panel" aria-labelledby="yours-h">
          <h2 id="yours-h">Yours</h2>
          <p style={{ margin: "0 0 10px" }}>
            <YoursChip status={vc.status} lastContactDate={vc.last_contact_date} />
          </p>
          <dl className="kv">
            <dt>Last contact</dt>
            <dd>{vc.last_contact_date ? `${vc.last_contact_date} (${daysSince(vc.last_contact_date)} days ago)` : "None yet"}</dd>
            <dt>History</dt><dd>{vc.contact_history ?? "None"}</dd>
            <dt>Notes</dt><dd>{vc.personal_notes ?? "None"}</dd>
          </dl>
          <p className="meta" style={{ marginTop: 10 }}>Read-only here. The pipeline never changes these.</p>
        </section>

        <section className="section panel" aria-labelledby="score-h">
          <h2 id="score-h">How the score works</h2>
          <p className="meta" style={{ marginBottom: 10 }}>
            Score {vc.follow_up_score ?? 0} of 100: the top three signals below, plus 10 if two sources agree, times the firm fit
            ({fit.toFixed(2)}). Capped at 45 when nothing in the last 30 days is about B2B logistics.
          </p>
          {ranked.length > 0 && (
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Score breakdown table">
              <table>
                <thead>
                  <tr><th>Signal</th><th>Type</th><th>Fit</th><th>Stage</th><th>Recency</th><th>Value</th></tr>
                </thead>
                <tbody>
                  {ranked.slice(0, 5).map(({ s, v }) => (
                    <tr key={s.id}>
                      <td>{s.summary.slice(0, 60)}{s.summary.length > 60 ? "…" : ""}</td>
                      <td>{TYPE_WEIGHT[s.signal_type as SignalType] ?? "-"}</td>
                      <td>×{RELEVANCE_MULT[s.logistics_relevance as keyof typeof RELEVANCE_MULT] ?? "-"}</td>
                      <td>×{stageMultiplier(s.round_stage as RoundStage)}</td>
                      <td>×{Math.exp(-daysAgo(s.published_date, today) / 14).toFixed(2)}</td>
                      <td>{v.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
