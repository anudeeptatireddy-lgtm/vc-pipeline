// Cron entry: auth → load VCs → batch → sources → verify → score → RPC.
import { isCronAuthorized } from "@/lib/auth";
import { RunLockedError, runPipeline } from "@/lib/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  try {
    const s = await runPipeline({ trigger: "cron" });
    return Response.json({
      ok: true, runId: s.runId, processed: s.processed, skipped: s.skipped, errors: s.errors.length, durationMs: s.durationMs,
    });
  } catch (e) {
    if (e instanceof RunLockedError) return Response.json({ ok: false, error: e.message }, { status: 409 });
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
