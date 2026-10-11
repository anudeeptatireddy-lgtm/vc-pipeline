// Proof the data is live: run history with per-source counts and errors.
import Link from "next/link";
import { istStamp } from "@/lib/format";
import { getRuns, runState } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const runs = await getRuns();
  return (
    <div className="shell">
      <main>
        <Link className="back" href="/">Back to this week</Link>
        <h1 className="headline display" style={{ margin: "12px 0 16px" }}>Run history</h1>
        {runs.length === 0 ? (
          <p className="meta">No runs yet.</p>
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Run history table">
            <table>
              <thead>
                <tr><th>Started</th><th>Trigger</th><th>Result</th><th>Investors</th><th>New signals</th><th>Per source</th><th>Errors</th></tr>
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
