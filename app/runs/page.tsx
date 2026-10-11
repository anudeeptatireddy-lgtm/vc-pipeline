// Proof the data is live: run history with per-source counts and errors.
import Link from "next/link";
import { TopBar } from "@/components/triage/TopBar";
import { istStamp } from "@/lib/format";
import { getRuns, getTriage, runState } from "@/lib/queries";
import { statusPill } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const [runs, t] = await Promise.all([getRuns(), getTriage()]);
  return (
    <div className="app">
      <TopBar items={t.rows.map((r) => ({ id: r.id, firm: r.firm, partner: r.partnerName, lane: r.lane }))} pill={statusPill(t)} running={t.runState === "running"} />
      <main className="page" id="main">
        <p style={{ margin: "0 0 16px" }}>
          <Link className="back-link" href="/">Back to this week</Link>
        </p>
        <h1 className="view-title">Run history</h1>
        <p className="note">Every check the pipeline ran: scheduled (Monday and Thursday, 8:00 IST), Run now, or a script. Each source that didn&apos;t answer is listed under errors; the rest of the run still finishes.</p>
        {runs.length === 0 ? (
          <p className="muted">No runs yet.</p>
        ) : (
          <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Run history table">
            <table>
              <thead>
                <tr><th scope="col">Started</th><th scope="col">Trigger</th><th scope="col">Result</th><th scope="col">Investors</th><th scope="col">New signals</th><th scope="col">Per source</th><th scope="col">Errors</th></tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const st = runState(r);
                  return (
                    <tr key={r.id}>
                      <td>{istStamp(r.started_at)}</td>
                      <td>{r.trigger === "cron" ? "Schedule" : r.trigger === "manual" ? "Run now" : "Script"}</td>
                      <td className={st === "failed" ? "error-text" : undefined}>
                        {st === "ok" ? `Finished in ${Math.round((r.usage?.durationMs ?? 0) / 1000)}s` : st === "running" ? "Running" : "Didn't finish"}
                      </td>
                      <td>{r.vcs_processed ?? 0}{r.usage?.skippedForTime ? ` (${r.usage.skippedForTime} skipped for time)` : ""}</td>
                      <td>{r.usage?.newSignals ?? 0}</td>
                      <td>
                        {Object.entries(r.usage?.perSource ?? {})
                          .map(([k, n]) => `${k} ${n}`)
                          .join(", ") || "-"}
                      </td>
                      <td>
                        {r.errors?.length ? (
                          <details>
                            <summary>{r.errors.length}</summary>
                            <pre className="errors">{r.errors.map((e) => `${e.source ?? ""} ${e.message}`).join("\n")}</pre>
                          </details>
                        ) : (
                          "0"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
