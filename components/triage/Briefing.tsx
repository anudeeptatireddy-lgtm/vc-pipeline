"use client";
// Briefing band: the one-sentence answer, the "since last run" line, and the
// yard map of every investor (click to select, hover for the name, legend chips filter).
import { useState } from "react";
import { countWord } from "@/lib/format";
import type { TriageRow } from "@/lib/queries";
import { LANES, type Lane } from "@/lib/triage";
import { LANE_CHIP, LANE_CLASS } from "./labels";

export interface Since {
  day: string | null;
  newSignals: number;
  mover: { id: string; firm: string; delta: number } | null;
  quiet: number;
}

export function headline(rows: TriageRow[]): { h: string; sub: string } {
  const n = (l: Lane) => rows.filter((r) => r.lane === l).length;
  const today = n("today");
  const follow = n("follow");
  const maybe = n("maybe");
  const h =
    today === 0 ? "No one needs a first message today." : today === 1 ? "One investor is worth a message today." : `${countWord(today)} investors are worth a message today.`;
  const parts: string[] = [];
  if (follow > 0) parts.push(`${countWord(follow)} ${follow === 1 ? "investor you're waiting on has" : "investors you're waiting on have"} news you can follow up with.`);
  if (maybe > 0) parts.push(`${countWord(maybe)} more ${maybe === 1 ? "is" : "are"} worth a look if you have time.`);
  if (parts.length === 0) parts.push("Nothing new and relevant in the last 30 days. Check back after the next update.");
  return { h, sub: parts.join(" ") };
}

export function Briefing({
  rows,
  since,
  sel,
  filter,
  onSelect,
  onFilter,
}: {
  rows: TriageRow[];
  since: Since;
  sel: string | null;
  filter: Lane | null;
  onSelect: (id: string) => void;
  onFilter: (l: Lane | null) => void;
}) {
  const { h, sub } = headline(rows);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const count = (l: Lane) => rows.filter((r) => r.lane === l).length;
  const sinceParts: React.ReactNode[] = [];
  if (since.newSignals) sinceParts.push(`${since.newSignals} new signal${since.newSignals === 1 ? "" : "s"}.`);
  if (since.mover)
    sinceParts.push(
      <span key="m">
        <a href={`/?vc=${since.mover.id}`} onClick={(e) => { e.preventDefault(); onSelect(since.mover!.id); }}>{since.mover.firm}</a> moved up {since.mover.delta} points.
      </span>,
    );
  if (since.quiet) sinceParts.push(`${since.quiet} went quiet.`);

  return (
    <section className="band" aria-labelledby="headline">
      <div>
        <h1 id="headline" className="headline">{h}</h1>
        <p className="sub">{sub}</p>
        {since.day && (
          <p className="since">
            <span className="dot" aria-hidden />
            <span>
              Since {since.day}:{" "}
              {sinceParts.length === 0 ? "no changes." : sinceParts.map((p, i) => <span key={i}>{i > 0 && " "}{p}</span>)}
            </span>
          </p>
        )}
      </div>
      <div className="yard-wrap">
        {/* One tab stop for the whole map; arrow keys move between squares (10 per row). */}
        <div
          className="yard"
          role="group"
          aria-label={`All ${rows.length} investors, grouped by what to do. Arrow keys move, Enter selects.`}
          onMouseLeave={() => setTip(null)}
          onKeyDown={(e) => {
            const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 10, ArrowUp: -10 }[e.key];
            if (!step) return;
            e.preventDefault();
            const btns = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
            const at = btns.indexOf(document.activeElement as HTMLButtonElement);
            btns[Math.min(btns.length - 1, Math.max(0, at + step))]?.focus();
          }}
        >
          {rows.map((r, i) => (
            <button
              key={r.id}
              type="button"
              className={`sq ${LANE_CLASS[r.lane]}${filter && filter !== r.lane ? " dim" : ""}${r.id === sel ? " sel" : ""}`}
              style={{ "--i": i } as React.CSSProperties}
              aria-label={`${r.firm}, ${LANE_CHIP[r.lane]}`}
              aria-pressed={r.id === sel}
              data-id={r.id}
              tabIndex={r.id === (sel ?? rows[0]?.id) ? 0 : -1}
              onClick={() => onSelect(r.id)}
              onMouseEnter={(e) => {
                const b = e.currentTarget.getBoundingClientRect();
                setTip({ text: `${r.firm} · ${LANE_CHIP[r.lane]}`, x: Math.max(8, Math.min(window.innerWidth - 270, b.left - 20)), y: b.top - 38 });
              }}
              onFocus={(e) => {
                const b = e.currentTarget.getBoundingClientRect();
                setTip({ text: `${r.firm} · ${LANE_CHIP[r.lane]}`, x: Math.max(8, Math.min(window.innerWidth - 270, b.left - 20)), y: b.top - 38 });
              }}
              onBlur={() => setTip(null)}
            />
          ))}
        </div>
        <div className="legend" role="group" aria-label="Filter the list">
          {LANES.map((l) => (
            <button key={l} type="button" className={`chip ${LANE_CLASS[l]}`} aria-pressed={filter === l} onClick={() => onFilter(filter === l ? null : l)}>
              <i aria-hidden />
              {LANE_CHIP[l]} <b>{count(l)}</b>
            </button>
          ))}
        </div>
      </div>
      {tip && (
        <div className="tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      )}
    </section>
  );
}
