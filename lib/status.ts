// Status pill and "since last run" line for the dashboard (calm wording, §8).
import { istStamp, istWeekday } from "./format";
import type { Triage } from "./queries";
import { sourcesChecked } from "./triage";

export function statusPill(t: Pick<Triage, "runState" | "lastGoodRun" | "latestRun">): { text: string; warn: boolean } {
  const updated = t.lastGoodRun?.finished_at ? `Updated ${istStamp(t.lastGoodRun.finished_at)}` : null;
  if (t.runState === "running") return { text: `Checking sources now.${updated ? ` Last ${updated.toLowerCase()}` : ""}`, warn: false };
  if (t.runState === "failed" && t.latestRun && t.latestRun.id !== t.lastGoodRun?.id && (t.latestRun.vcs_processed ?? 0) >= 40) {
    return { text: `The last check didn't finish. Showing data from ${t.lastGoodRun?.finished_at ? istStamp(t.lastGoodRun.finished_at) : "earlier"}.`, warn: true };
  }
  if (!t.lastGoodRun) return { text: "Not checked yet.", warn: true };
  const s = sourcesChecked(t.lastGoodRun.errors);
  return { text: `Checked ${s.checked} of ${s.total} sources. ${updated}`, warn: false };
}

export function sinceLine(t: Triage) {
  const mover = [...t.rows].filter((r) => (r.scoreDelta ?? 0) > 0).sort((a, b) => (b.scoreDelta ?? 0) - (a.scoreDelta ?? 0))[0];
  return {
    day: t.previousRun ? istWeekday(t.previousRun.started_at) : t.lastGoodRun ? istWeekday(t.lastGoodRun.started_at) : null,
    newSignals: t.lastGoodRun?.usage?.newSignals ?? 0,
    mover: mover ? { id: mover.id, firm: mover.firm, delta: mover.scoreDelta ?? 0 } : null,
    quiet: t.rows.filter((r) => r.lane === "parked" && (r.scoreDelta ?? 0) < 0).length,
  };
}
