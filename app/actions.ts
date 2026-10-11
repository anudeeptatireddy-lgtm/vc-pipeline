"use server";
// Run now (dashboard-design.md §4, §9): passcode-protected, single-run lock.
// Starts the pipeline; it doesn't write rows itself.
import { revalidatePath } from "next/cache";
import { safeEqual } from "@/lib/auth";
import { RunLockedError, runPipeline } from "@/lib/run";

export type RunNowResult =
  | { ok: true; newSignals: number; failedSources: string[]; changedIds: string[] }
  | { ok: false; reason: "passcode" | "locked" | "error"; message: string };

export async function runNow(passcode: string): Promise<RunNowResult> {
  const expected = process.env.DEMO_PASSCODE;
  if (!expected || !safeEqual(passcode, expected)) {
    return { ok: false, reason: "passcode", message: "That passcode didn't match" };
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
