"use client";
// The selected investor: why now, fit, activity, evidence, what to say, who to
// contact, the firm, how the score works, and your (read-only) notes.
import { Check, Copy, ExternalLink, Lock } from "lucide-react";
import Link from "next/link";
import { forwardRef, useState } from "react";
import { sourceLabel } from "@/lib/format";
import type { Evidence, TriageRow } from "@/lib/queries";
import { daysAgo, laneReason, LANE_CHIP, LANE_SHORT, plain, shortDate, TAG_LABELS, typeLabel, yoursText } from "./labels";
import { WhoToContact } from "./WhoToContact";

const TAG_STATE = { yes: "matches", part: "partly matches or not stated", no: "does not match" } as const;

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const a = document.createElement("textarea");
    a.value = text;
    document.body.appendChild(a);
    a.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    a.remove();
    return ok;
  }
}

function Tape({ days }: { days: number[] }) {
  const hits = new Set(days.filter((d) => d >= 0 && d < 30));
  const recent = hits.size ? Math.min(...hits) : null;
  const label =
    hits.size === 0
      ? "No signals in the last 30 days"
      : `Signals on ${hits.size} of the last 30 days; most recent ${recent === 0 ? "today" : recent === 1 ? "yesterday" : `${recent} days ago`}`;
  return (
    <>
      <div className="tape" role="img" aria-label={label}>
        {Array.from({ length: 30 }, (_, i) => 29 - i).map((d) => (
          <i key={d} className={hits.has(d) ? (d <= 7 ? "h" : "s") : undefined} />
        ))}
      </div>
      <div className="tape-l" aria-hidden>
        <span>30 days ago</span>
        <span>Today</span>
      </div>
    </>
  );
}

function EvidenceItem({ e, showSummary }: { e: Evidence; showSummary?: boolean }) {
  return (
    <li>
      <div className="ev-h">
        <a href={e.url} target="_blank" rel="noopener noreferrer">
          {sourceLabel(e.source, e.url)} <ExternalLink size={12} aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <span>{shortDate(e.date)}</span>
        <span className="ver">
          <Check size={13} aria-hidden style={{ verticalAlign: -2 }} /> Date and link checked
        </span>
      </div>
      {showSummary && <p>{e.summary}</p>}
      {e.quote ? <q>{e.quote}</q> : !showSummary && <p className="muted">{e.summary}</p>}
    </li>
  );
}

export const Workspace = forwardRef<HTMLButtonElement, { row: TriageRow; onBack?: () => void; onToast: (m: string) => void; pageMode?: boolean }>(function Workspace(
  { row: r, onBack, onToast, pageMode },
  backRef,
) {
  const cls = LANE_SHORT[r.lane];
  const lead = r.lead;
  const [copied, setCopied] = useState(false);
  // Section headings sit one level under the name: h3 in the Focus panel, h2 on the full page.
  const Sub = pageMode ? "h2" : "h3";

  return (
    <div className="ws-in" data-vc={r.id}>
      {onBack && (
        <button ref={backRef} type="button" className="btn ws-back" onClick={onBack}>
          Back to list
        </button>
      )}
      {pageMode ? <h1 className="name" id="ws-title">{r.firm}</h1> : <h2 className="name" id="ws-title">{r.firm}</h2>}
      <p className="who">{[r.partnerName, r.region].filter(Boolean).join(" · ") || " "}</p>
      <span className="status-chip">
        <Lock size={13} aria-hidden /> {yoursText(r)}
      </span>
      <span className={`band-tag ${cls}`}>{LANE_CHIP[r.lane]}</span>

      {r.lane === "parked" || !lead ? (
        <div className="why p">
          <p>{lead ? lead.summary : r.lastSignalDate ? `Last signal ${shortDate(r.lastSignalDate)}.` : "No activity found in the last 30 days."}</p>
          <p className="ql">{laneReason(r)}</p>
        </div>
      ) : (
        <>
          <div className={`why ${cls}`}>
            <p>{lead.summary}</p>
            {lead.deal ? (
              <dl className="facts">
                {lead.deal.company && <div><dt>Company</dt><dd>{lead.deal.company}</dd></div>}
                {(lead.deal.round || lead.deal.size) && <div><dt>Round</dt><dd>{[lead.deal.round, lead.deal.size].filter(Boolean).join(" · ")}</dd></div>}
                {lead.deal.role && <div><dt>Their role</dt><dd>{lead.deal.role}</dd></div>}
                <div><dt>Announced</dt><dd>{shortDate(lead.date)}</dd></div>
              </dl>
            ) : (
              <dl className="facts">
                <div><dt>Type</dt><dd>{typeLabel(lead.type)}</dd></div>
                <div><dt>Published</dt><dd>{shortDate(lead.date)}</dd></div>
                <div><dt>Where</dt><dd>{sourceLabel(lead.source, lead.url)}</dd></div>
              </dl>
            )}
            <p className="ql" style={{ marginTop: 12 }}>{laneReason(r)}</p>
          </div>

          {r.tags && (
            <div className="sec">
              <Sub>Does it fit you?</Sub>
              <div className="fit">
                {(Object.keys(TAG_LABELS) as (keyof typeof TAG_LABELS)[]).map((k) => (
                  <span key={k} className={`tag ${r.tags![k]}`}>
                    <i aria-hidden />
                    {TAG_LABELS[k]}
                    <span className="sr-only">: {TAG_STATE[r.tags![k]]}</span>
                    {r.tags![k] === "part" && <small aria-hidden>partly</small>}
                    {r.tags![k] === "no" && <small aria-hidden>no</small>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="sec">
        <Sub>Activity in the last 30 days</Sub>
        <Tape days={r.tape} />
      </div>

      {lead && r.evidence.length > 0 && (
        <div className="sec">
          <Sub>Evidence</Sub>
          {lead.confirmed && (
            <div className="two">
              <Check size={15} aria-hidden /> Confirmed by 2 sources
            </div>
          )}
          <ul className="ev">
            {r.evidence.map((e) => <EvidenceItem key={e.id} e={e} />)}
          </ul>
          {r.other.length > 0 && (
            <details className="more-box" style={{ marginTop: 12 }}>
              <summary>Other activity this month ({r.other.length})</summary>
              <ul className="ev">
                {r.other.map((e) => <EvidenceItem key={e.id} e={e} showSummary />)}
              </ul>
            </details>
          )}
        </div>
      )}

      {lead && r.lane !== "parked" && (
        <div className="sec">
          <Sub>What to say</Sub>
          <div className="say">
            {lead.line ? (
              <>
                <p id="line">{lead.line}</p>
                <button
                  type="button"
                  className="btn primary copy-line"
                  aria-keyshortcuts="c"
                  onClick={async () => {
                    const ok = await copyText(lead.line!);
                    setCopied(ok);
                    onToast(ok ? "Copied to clipboard" : "Select the text and copy it");
                  }}
                >
                  <Copy size={14} aria-hidden />
                  {lead.lineKind === "nudge" ? "Copy nudge line" : "Copy opening line"}
                  <span className="kbd" aria-hidden>c</span>
                </button>
                <small>{copied ? "Copied. " : ""}Written from the evidence above. Check it before you send.</small>
              </>
            ) : (
              <p className="muted" style={{ margin: 0 }}>No line drafted for this signal. The drafts under Who to contact are written for each person.</p>
            )}
          </div>
        </div>
      )}

      <WhoToContact vcId={r.id} level={pageMode ? 2 : 3} />

      <div className="sec">
        <Sub>The firm</Sub>
        <dl className="prof">
          <div><dt>Seed behaviour</dt><dd>{plain(r.profile.doesSeed)}</dd></div>
          <div><dt>Typical cheque</dt><dd>{r.profile.cheque ?? "Not stated"}</dd></div>
          <div><dt>Where they invest</dt><dd>{r.profile.geo ?? "Not stated"}</dd></div>
          <div><dt>Logistics thesis</dt><dd>{plain(r.profile.thesis)}</dd></div>
          <div><dt>Type</dt><dd>{plain(r.profile.type)}</dd></div>
        </dl>
      </div>

      <div className="sec">
        <details className="more-box">
          <summary>How the score works</summary>
          <p className="small" style={{ margin: "0 0 8px" }}>
            Score {r.score} of 100: the top three signals below{r.agreeBonus ? ", plus 10 because two sources agree," : ""} times the firm fit ({r.fit.toFixed(2)}).
            Capped at 45 when nothing in the last 30 days is about B2B logistics. 60 or more, with a confirmed fit, means a message today.
          </p>
          {r.scoreParts.length > 0 ? (
            <ul className="parts">
              {r.scoreParts.map((p, i) => (
                <li key={i}><span>{p.summary}</span><b>{p.value.toFixed(1)}</b></li>
              ))}
            </ul>
          ) : (
            <p className="small">No signals in the last 30 days.</p>
          )}
        </details>
      </div>

      <div className="sec">
        <Sub>Your notes</Sub>
        <div className="lock">
          <Lock size={18} aria-hidden />
          <div>
            <b>Yours. This page never edits it.</b>
            <p>{r.personalNotes ?? "No notes yet."}</p>
            {r.contactHistory && <p>History: {r.contactHistory}</p>}
            <p>
              Last contact: {r.lastContactDate ? `${shortDate(r.lastContactDate)} (${daysAgo(r.lastContactDate)} days ago)` : "No contact yet"}
            </p>
          </div>
        </div>
      </div>

      {!pageMode && (
        <p className="small" style={{ marginTop: 22 }}>
          <Link href={`/vc/${r.id}`}>Open the full page</Link> for every signal on record.
        </p>
      )}
    </div>
  );
});
