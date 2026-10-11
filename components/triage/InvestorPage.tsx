"use client";
// Full page for one investor (/vc/[id]): the same workspace, full width, plus every signal on record.
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { sourceLabel } from "@/lib/format";
import type { SignalFeedRow, TriageRow } from "@/lib/queries";
import { shortDate, typeLabel } from "./labels";
import { TopBar, type Pill, type SearchItem } from "./TopBar";
import { Workspace } from "./Workspace";

export function InvestorPage({ row, signals, items, pill, running }: { row: TriageRow; signals: SignalFeedRow[]; items: SearchItem[]; pill: Pill; running: boolean }) {
  const [toast, setToast] = useState<string | null>(null);
  return (
    <div className="app">
      <TopBar items={items} pill={pill} running={running} />
      <main className="page" id="main">
        <p style={{ margin: "0 0 16px" }}>
          <Link className="back-link" href={`/?vc=${row.id}`}>Back to this week</Link>
        </p>
        <article className="ws page-mode" aria-labelledby="ws-title">
          <Workspace row={row} pageMode onToast={(m) => { setToast(m); setTimeout(() => setToast(null), 1800); }} />
          <div className="ws-in" style={{ paddingTop: 0 }}>
            <div className="sec">
              <h2 id="all-h">Every signal on record ({signals.length})</h2>
              {signals.length === 0 ? (
                <p className="muted">No public activity found yet.</p>
              ) : (
                <ul className="ev timeline" aria-labelledby="all-h">
                  {signals.map((s) => (
                    <li key={s.id}>
                      <div className="ev-h">
                        <span>{typeLabel(s.signal_type)}</span>
                        <a href={s.source_url} target="_blank" rel="noopener noreferrer">
                          {sourceLabel(s.source_name, s.source_url)} <ExternalLink size={12} aria-hidden />
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                        <span>{shortDate(s.published_date)}</span>
                      </div>
                      <p>{s.summary}</p>
                      {s.evidence_quote && <q>{s.evidence_quote}</q>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </article>
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
