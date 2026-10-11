"use server";
// Run now (dashboard-design.md §4, §9). No passcode (owner's decision: the
// professor must be able to use it). Guarded instead by the single-run lock
// and a cooldown, so a public page can't burn search credits.
import { revalidatePath } from "next/cache";
import { q } from "@/lib/sql";
import { RunLockedError, runPipeline } from "@/lib/run";

const COOLDOWN_MIN = 180;

export type RunNowResult =
  | { ok: true; newSignals: number; failedSources: string[]; changedIds: string[] }
  | { ok: false; reason: "cooldown" | "locked" | "error"; message: string };

export async function runNow(): Promise<RunNowResult> {
  const [last] = await q<{ mins: number }>(
    "select floor(extract(epoch from now() - max(finished_at)) / 60)::int as mins from pipeline_runs where finished_at is not null",
  );
  if (last?.mins != null && last.mins < COOLDOWN_MIN) {
    return { ok: false, reason: "cooldown", message: `Data was refreshed ${last.mins} minutes ago. Try again in ${COOLDOWN_MIN - last.mins} minutes.` };
  }
  try {
    const s = await runPipeline({ trigger: "manual" });
    revalidatePath("/");
    const failedSources = [...new Set(s.errors.map((e) => e.source).filter((x): x is string => !!x))];
    return {
      ok: true,
      newSignals: s.results.reduce((a, r) => a + r.newSignals, 0),
      failedSources,
      changedIds: s.results.filter((r) => r.newSignals > 0).map((r) => r.vcId),
    };
  } catch (e) {
    if (e instanceof RunLockedError) return { ok: false, reason: "locked", message: "A run is in progress" };
    return { ok: false, reason: "error", message: "The run didn't finish" };
  }
}
