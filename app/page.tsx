// Dashboard home (docs/dashboard-design.md §3). Read-only: data comes from
// lib/queries.ts over the SQL views.
import { RankedRow } from "@/components/RankedRow";
import { ChangesPanel, SuggestedPanel } from "@/components/Panels";
import { ParkedList } from "@/components/ParkedList";
import { PipelineStrip } from "@/components/PipelineStrip";
import { ShowMore } from "@/components/ShowMore";
import { StatusBar } from "@/components/StatusBar";
import { countWord, daysSince, istStamp, nextRun } from "@/lib/format";
import { getDashboard } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // the Run now server action runs the pipeline

export default async function Home() {
  const d = await getDashboard();
  const reach = d.rows.filter((r) => r.bucket === "reach_out");
  // Nudges worth showing: waiting on a reply AND something new to say.
  const nudge = d.rows.filter((r) => r.bucket === "nudge");
  const parked = d.rows.filter((r) => r.bucket === "parked");
  const anySignal = d.rows.some((r) => r.top);
  const staleDays = d.lastGoodRun?.finished_at ? daysSince(d.lastGoodRun.finished_at.slice(0, 10)) : null;
  const next = istStamp(nextRun()).replace(/ IST$/, " IST");

  const n = reach.length;
  const headline =
    n === 0 ? "No one stands out this week" : n === 1 ? "One investor is worth a message this week" : `${countWord(n)} investors are worth a message this week`;

  if (d.rows.length === 0) {
    return (
      <div className="shell">
        <StatusBar state={d.runState} lastGood={d.lastGoodRun} latest={d.latestRun} />
        <main className="main">
          <h1 className="headline display">Nothing to show yet. Run now to check your investors.</h1>
        </main>
      </div>
    );
  }

  return (
    <div className="shell">
      <StatusBar state={d.runState} lastGood={d.lastGoodRun} latest={d.latestRun} />
      {d.fixtures && <p className="notice">Showing sample data from fixtures/dashboard.sample.json.</p>}
      {staleDays !== null && staleDays > 5 && <p className="notice">This data is {staleDays} days old. Run now to refresh.</p>}

      <div className="grid">
        <main className="main">
          <h1 className="headline display">{headline}</h1>
          {n === 0 ? (
            <p className="subline">Nothing new and relevant in the last 30 days. Check back after the next update.</p>
          ) : (
            nudge.length > 0 && (
              <p className="subline">
                {countWord(nudge.length)} more {nudge.length === 1 ? "is" : "are"} waiting on a reply and {nudge.length === 1 ? "has" : "have"} news you can follow up with.
              </p>
            )
          )}
          <PipelineStrip items={d.rows.map((r) => ({ id: r.id, firm: r.firm, bucket: r.bucket }))} />

          {reach.length > 0 && (
            <section className="section" aria-labelledby="reach-h">
              <h2 id="reach-h">Reach out this week</h2>
              <ShowMore label="Reach out this week">
                {reach.map((r, i) => (
                  <RankedRow key={r.id} row={r} rank={i + 1} variant={i === 0 ? "top" : "compact"} kind="reach_out" />
                ))}
              </ShowMore>
            </section>
          )}

          {nudge.length > 0 && (
            <section className="section" aria-labelledby="nudge-h">
              <h2 id="nudge-h">Waiting on a reply, with something new to say</h2>
              <ShowMore label="Waiting on a reply">
                {nudge.map((r) => (
                  <RankedRow key={r.id} row={r} variant="compact" kind="nudge" />
                ))}
              </ShowMore>
            </section>
          )}

          <div className="section rail-mobile">
            <aside className="rail-panels" aria-label="Changes and suggestions">
              <ChangesPanel rows={d.rows} lastGood={d.lastGoodRun} previous={d.previousRun} />
              <SuggestedPanel items={d.suggested} />
            </aside>
          </div>

          <div className="section">
            <ParkedList
              items={parked.map((p) => ({ id: p.id, firm: p.firm, lastSignalDate: p.lastSignalDate }))}
              defaultOpen={!anySignal}
            />
          </div>

          <footer className="endnote">
            <p style={{ margin: 0 }}>That&apos;s everything for this week. Next update {next}.</p>
            <p className="meta" style={{ marginTop: 6 }}>
              Your status, notes and contact history are [DEMO] sample data. Investor names, signals and links are live.
            </p>
          </footer>
        </main>
        <div className="rail rail-desktop">
          <aside className="rail-panels" aria-label="Changes and suggestions">
            <ChangesPanel rows={d.rows} lastGood={d.lastGoodRun} previous={d.previousRun} />
            <SuggestedPanel items={d.suggested} />
          </aside>
        </div>
      </div>
    </div>
  );
}
