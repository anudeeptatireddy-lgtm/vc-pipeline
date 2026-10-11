// Right rail: ChangesPanel and SuggestedPanel (dashboard-design.md §4, §8).
import { ExternalLink } from "lucide-react";
import { istWeekday } from "@/lib/format";
import type { Dashboard, DashboardRow } from "@/lib/queries";

export function ChangesPanel({ rows, lastGood, previous }: { rows: DashboardRow[]; lastGood: Dashboard["lastGoodRun"]; previous: Dashboard["previousRun"] }) {
  if (!lastGood) return null;
  const since = istWeekday(previous?.started_at ?? lastGood.started_at);
  const n = lastGood.usage?.newSignals ?? 0;
  const mover = [...rows].filter((r) => (r.scoreDelta ?? 0) > 0).sort((a, b) => (b.scoreDelta ?? 0) - (a.scoreDelta ?? 0))[0];
  const quiet = rows.filter((r) => r.bucket === "parked" && (r.scoreDelta ?? 0) < 0).length;
  const parts: React.ReactNode[] = [];
  if (n) parts.push(`${n} new signal${n === 1 ? "" : "s"}.`);
  if (mover) parts.push(<span key="m"><a href={`#row-${mover.id}`}>{mover.firm}</a> moved up {mover.scoreDelta} points.</span>);
  if (quiet) parts.push(`${quiet} went quiet.`);
  return (
    <section className="panel" aria-labelledby="changes-h">
      <h2 id="changes-h">Since {since}</h2>
      <p>
        {parts.length === 0
          ? `No changes since ${since}.`
          : parts.map((p, i) => (
              <span key={i}>
                {i > 0 && " "}
                {p}
              </span>
            ))}
      </p>
    </section>
  );
}

export function SuggestedPanel({ items }: { items: Dashboard["suggested"] }) {
  if (items.length === 0) return null;
  return (
    <section className="panel" aria-labelledby="suggested-h">
      <h2 id="suggested-h">Not on your list yet</h2>
      <ul>
        {items.map((s) => (
          <li key={s.id}>
            <div className="display">{s.firm}</div>
            {s.reason && <p>{s.reason}</p>}
            {s.evidence_urls?.[0] && (
              <a className="meta" href={s.evidence_urls[0]} target="_blank" rel="noopener noreferrer">
                Evidence <ExternalLink size={12} aria-hidden />
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
