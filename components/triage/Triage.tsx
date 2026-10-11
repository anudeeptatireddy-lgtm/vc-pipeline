"use client";
// The dashboard (docs/dashboard-design.md §3): top bar, briefing band and four
// views over the same 50 rows. Read-only; state lives in the URL (?view=, ?vc=)
// so links and the back button work. Keyboard: j/k move, c copies, / searches.
import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Suggestion, TriageRow } from "@/lib/queries";
import { LANES, type Lane } from "@/lib/triage";
import { Briefing, type Since } from "./Briefing";
import { daysAgo, LANE_ACTION, LANE_CHIP, LANE_CLASS, LANE_SHORT, LANE_TITLE, queueLine, shortDate } from "./labels";
import { TopBar, type Pill, type View } from "./TopBar";
import { copyText, Workspace } from "./Workspace";

interface Props {
  rows: TriageRow[];
  suggested: Suggestion[];
  since: Since;
  pill: Pill;
  running: boolean;
  nextUpdate: string;
  initialView: View;
  initialVc: string | null;
}

const isMobile = () => typeof window !== "undefined" && window.innerWidth <= 1000;

export function Triage({ rows, suggested, since, pill, running, nextUpdate, initialView, initialVc }: Props) {
  const firstActive = rows.find((r) => r.lane !== "parked")?.id ?? rows[0]?.id ?? null;
  const [view, setView] = useState<View>(initialView);
  const [sel, setSel] = useState<string | null>(initialVc && rows.some((r) => r.id === initialVc) ? initialVc : firstActive);
  const [filter, setFilter] = useState<Lane | null>(null);
  const [showParked, setShowParked] = useState(() => rows.find((r) => r.id === initialVc)?.lane === "parked");
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const backBtn = useRef<HTMLButtonElement>(null);
  const row = rows.find((r) => r.id === sel) ?? null;

  const say = useCallback((m: string) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  // Keep the URL in step (replace, so j/k doesn't flood the history).
  useEffect(() => {
    const p = new URLSearchParams();
    if (view !== "focus") p.set("view", view);
    if (sel && sel !== firstActive) p.set("vc", sel);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `/?${qs}` : "/");
  }, [view, sel, firstActive]);

  const select = useCallback(
    (id: string, opts: { openSheet?: boolean } = {}) => {
      setSel(id);
      setView("focus");
      if (rows.find((r) => r.id === id)?.lane === "parked") setShowParked(true);
      if (opts.openSheet ?? isMobile()) setSheet(true);
      requestAnimationFrame(() => document.querySelector(`[data-qid="${id}"]`)?.scrollIntoView({ block: "nearest" }));
    },
    [rows],
  );

  // Phone: focus the Back button when the sheet opens; Esc closes it.
  useEffect(() => {
    if (sheet) backBtn.current?.focus();
  }, [sheet, sel]);

  const visibleIds = useMemo(() => {
    const out: string[] = [];
    for (const l of LANES) {
      if (filter && filter !== l) continue;
      if (l === "parked" && !showParked && filter !== "parked") continue;
      out.push(...rows.filter((r) => r.lane === l).map((r) => r.id));
    }
    return out;
  }, [rows, filter, showParked]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".modal, dialog[open]")) return;
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      if (e.key === "Escape" && sheet) {
        setSheet(false);
        document.querySelector<HTMLElement>(`[data-qid="${sel}"]`)?.focus();
        return;
      }
      if (view !== "focus") return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const i = sel ? visibleIds.indexOf(sel) : -1;
        const n = e.key === "j" ? Math.min(visibleIds.length - 1, i + 1) : Math.max(0, i - 1);
        const id = visibleIds[n];
        if (id) {
          setSel(id);
          requestAnimationFrame(() => {
            const el = document.querySelector<HTMLElement>(`[data-qid="${id}"]`);
            el?.scrollIntoView({ block: "nearest" });
            if (document.activeElement?.closest(".queue")) el?.focus();
          });
        }
      } else if (e.key === "c" && row?.lead?.line && row.lane !== "parked") {
        e.preventDefault();
        void copyText(row.lead.line).then((ok) => say(ok ? "Copied to clipboard" : "Select the text and copy it"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, sel, visibleIds, row, sheet, say]);

  const items = useMemo(() => rows.map((r) => ({ id: r.id, firm: r.firm, partner: r.partnerName, lane: r.lane })), [rows]);
  const showBand = view !== "discover";

  return (
    <div className="app">
      <TopBar view={view} onView={(v) => { setView(v); setSheet(false); window.scrollTo(0, 0); }} items={items} onPick={(id) => { setFilter(null); select(id); }} pill={pill} running={running} />
      <main className="page" id="main">
        <a className="pill pill-m" href="/runs">
          <span className={`dot${pill.warn ? " warn" : ""}`} aria-hidden />
          <span>{pill.text}</span>
        </a>
        {showBand && <Briefing rows={rows} since={since} sel={sel} filter={filter} onSelect={(id) => select(id)} onFilter={setFilter} />}
        <div id="view-panel" role="tabpanel" aria-label={`${view[0]!.toUpperCase()}${view.slice(1)} view`}>
          {view === "focus" && (
            <div className={`focus${sheet ? " m-open" : ""}`}>
              <Queue rows={rows} sel={sel} filter={filter} showParked={showParked} onToggleParked={() => setShowParked(!showParked)} onSelect={select} nextUpdate={nextUpdate} />
              <aside className="ws" aria-labelledby="ws-title" role={sheet ? "dialog" : undefined} aria-modal={sheet ? true : undefined}>
                {row ? (
                  <Workspace key={row.id} ref={backBtn} row={row} onToast={say} onBack={() => { setSheet(false); document.querySelector<HTMLElement>(`[data-qid="${row.id}"]`)?.focus(); }} />
                ) : (
                  <div className="ws-in"><p className="muted">Pick an investor from the list.</p></div>
                )}
              </aside>
            </div>
          )}
          {view === "board" && <Board rows={rows} filter={filter} onSelect={select} />}
          {view === "table" && <Table rows={rows} filter={filter} onSelect={select} />}
          {view === "discover" && <Discover items={suggested} />}
        </div>
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Age({ r }: { r: TriageRow }) {
  if (!r.lead || r.lane === "parked") return <span />;
  const d = daysAgo(r.lead.date);
  return <span className={`age${d <= 7 ? " hot" : ""}`}>{d <= 7 ? `Fresh · ${d}d` : `${d}d`}<span className="sr-only"> ago</span></span>;
}

function Queue({
  rows, sel, filter, showParked, onToggleParked, onSelect, nextUpdate,
}: {
  rows: TriageRow[]; sel: string | null; filter: Lane | null; showParked: boolean; onToggleParked: () => void; onSelect: (id: string) => void; nextUpdate: string;
}) {
  const by = (l: Lane) => rows.filter((r) => r.lane === l);
  const shown = (l: Lane) => !filter || filter === l;
  const parked = by("parked");
  const parkedOpen = showParked || filter === "parked";
  const item = (r: TriageRow, rank?: number) => (
    <button key={r.id} type="button" className={`qi ${LANE_SHORT[r.lane]}`} data-qid={r.id} aria-current={r.id === sel} onClick={() => onSelect(r.id)}>
      <span className="rank" aria-hidden={rank === undefined}>{rank ?? ""}</span>
      <span>
        <span className="qf">{r.firm}</span>
        <span className="ql">{queueLine(r)}</span>
      </span>
      <Age r={r} />
    </button>
  );
  const section = (l: Lane, empty: string) =>
    shown(l) && (
      <section key={l} aria-labelledby={`q-${l}`}>
        <h2 id={`q-${l}`}>{LANE_TITLE[l]} <span>{by(l).length}</span></h2>
        {by(l).length === 0 ? <p className="empty">{empty}</p> : by(l).map((r, i) => item(r, l === "today" ? i + 1 : undefined))}
      </section>
    );
  return (
    <nav className="queue" aria-label="Investors to work through">
      {section("today", "No one scored 60 or more with a confirmed fit this week.")}
      {section("follow", "No one you're waiting on has new, relevant news.")}
      {section("maybe", "Nothing in the 30 to 59 range.")}
      {shown("parked") && (
        <section aria-labelledby="q-parked">
          <h2 id="q-parked">Parked <span>{parked.length}</span></h2>
          <button type="button" className="parked-toggle" aria-expanded={parkedOpen} aria-controls="parked-list" onClick={onToggleParked}>
            <span>{parked.length} parked. No strong signal this month, so no need to spend time here.</span>
            <span>{parkedOpen ? "Hide" : "Show"}</span>
          </button>
          {parkedOpen && (
            <div id="parked-list">
              {parked.map((r) => (
                <button key={r.id} type="button" className="pk" data-qid={r.id} aria-current={r.id === sel} onClick={() => onSelect(r.id)}>
                  <span>{r.firm}</span>
                  <span>{r.lastSignalDate ? `Last signal ${shortDate(r.lastSignalDate)}` : "Quiet"}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      <p className="end">That&apos;s everything for this week. Next update {nextUpdate}.</p>
      <p className="small">Your status, notes and contact history are [DEMO] sample data. Investor names, signals and links are live.</p>
    </nav>
  );
}

function Board({ rows, filter, onSelect }: { rows: TriageRow[]; filter: Lane | null; onSelect: (id: string, o?: { openSheet?: boolean }) => void }) {
  return (
    <div className="board">
      {LANES.filter((l) => !filter || filter === l).map((l) => {
        const items = rows.filter((r) => r.lane === l);
        const lim = l === "parked" ? 8 : 99;
        return (
          <section key={l} className={`col ${LANE_CLASS[l]}`} aria-labelledby={`col-${l}`}>
            <h2 id={`col-${l}`}><i aria-hidden />{LANE_CHIP[l]} <span>{items.length}</span></h2>
            {items.length === 0 && <p className="empty">No one here this week.</p>}
            {items.slice(0, lim).map((r) => (
              <button key={r.id} type="button" className={`tile ${LANE_CLASS[l]}`} onClick={() => onSelect(r.id)}>
                <span className="qf">{r.firm}</span>
                <span className="ql">{queueLine(r)}</span>
              </button>
            ))}
            {items.length > lim && <p className="ql">{items.length - lim} more in the Table view.</p>}
          </section>
        );
      })}
    </div>
  );
}

type SortKey = "firm" | "lane" | "score" | "status" | "last";

function Table({ rows, filter, onSelect }: { rows: TriageRow[]; filter: Lane | null; onSelect: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; d: 1 | -1 }>({ k: "lane", d: 1 });
  const order: Record<Lane, number> = { today: 0, follow: 1, maybe: 2, parked: 3 };
  const list = rows
    .filter((r) => (!filter || r.lane === filter) && (!q || `${r.firm} ${r.partnerName ?? ""}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => {
      const v = (r: TriageRow): string | number =>
        sort.k === "firm" ? r.firm.toLowerCase() : sort.k === "score" ? -r.score : sort.k === "status" ? (r.status ?? "") : sort.k === "last" ? -(Date.parse(r.lastSignalDate ?? "1970-01-01")) : order[r.lane] * 1000 - r.score;
      const x = v(a);
      const y = v(b);
      return (x > y ? 1 : x < y ? -1 : 0) * sort.d;
    });
  const th = (k: SortKey, label: string) => (
    <th scope="col" aria-sort={sort.k === k ? (sort.d === 1 ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => setSort(sort.k === k ? { k, d: sort.d === 1 ? -1 : 1 } : { k, d: 1 })}>
        {label}{sort.k === k ? (sort.d === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
  return (
    <>
      <div className="tools">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by firm or partner" aria-label="Filter investors by firm or partner" />
        <span className="ql" role="status">{list.length} of {rows.length} investors{filter ? `, ${LANE_CHIP[filter]} only` : ""}</span>
      </div>
      <div className="tbl-wrap" tabIndex={0} role="region" aria-label="All investors">
        <table>
          <thead>
            <tr>
              {th("firm", "Firm")}
              <th scope="col">Region</th>
              {th("lane", "Lane")}
              {th("score", "Score")}
              {th("status", "Your status")}
              {th("last", "Last signal")}
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="clickrow" onClick={() => onSelect(r.id)}>
                <td>
                  <button type="button" className="firm-btn" onClick={(e) => { e.stopPropagation(); onSelect(r.id); }}>{r.firm}</button>
                  {r.partnerName && <><br /><span className="ql">{r.partnerName}</span></>}
                </td>
                <td>{r.region ?? "-"}</td>
                <td><span className={`bdg ${LANE_CLASS[r.lane]}`}><i aria-hidden />{LANE_CHIP[r.lane]}</span></td>
                <td className="num">{r.score}</td>
                <td>{r.status === "waiting_for_response" ? "Waiting for a reply" : "Yet to reach out"}</td>
                <td>{r.lastSignalDate ? shortDate(r.lastSignalDate) : "None found"}</td>
                <td>{LANE_ACTION[r.lane]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Discover({ items }: { items: Suggestion[] }) {
  return (
    <>
      <h1 className="view-title">Not on your list yet</h1>
      <p className="note">
        Investors who aren&apos;t on your list but have backed B2B logistics software at seed in the last year. Ranked by the same rubric used to
        build your list: each deal counts more when they led it, when it&apos;s seed, and when it&apos;s recent. These are suggestions; adding one happens outside this page.
      </p>
      {items.length === 0 ? (
        <p className="muted">No suggestions yet.</p>
      ) : (
        <div className="disc">
          {items.map((d) => (
            <article key={d.id} className="disc-i">
              <div>
                <h3>
                  {d.firm}
                  {d.rubricScore != null && d.rubricScore >= 70 && <span className="band-tag">Strong match</span>}
                </h3>
                <p>{d.summary ?? d.reason}</p>
                {d.caveat && <p className="muted">{d.caveat}</p>}
              </div>
              <div className="score">
                {d.rubricScore != null ? Math.round(d.rubricScore) : "-"}
                <small>rubric score{d.dealCount ? ` · ${d.dealCount} deal${d.dealCount === 1 ? "" : "s"}` : ""}</small>
              </div>
              {d.evidenceUrls.length > 0 && (
                <div className="links">
                  {d.evidenceUrls.map((u, i) => {
                    let host = u;
                    try {
                      host = new URL(u).hostname.replace(/^www\./, "");
                    } catch {}
                    return (
                      <a key={u} className="chip" href={u} target="_blank" rel="noopener noreferrer">
                        {i === 0 ? "Evidence: " : ""}{host} <ExternalLink size={12} aria-hidden />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    );
                  })}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
