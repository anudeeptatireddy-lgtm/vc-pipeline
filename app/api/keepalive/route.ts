// Keeps the free-tier Supabase project from pausing after 7 idle days.
// Vercel Cron calls this daily (vercel.json), independent of the pipeline
// cron, so the database stays awake even if a pipeline run fails or is off.
import { isCronAuthorized } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  // One cheap read through the API; this counts as project activity.
  const { count, error } = await db().from("vcs").select("id", { count: "exact", head: true });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, vcs: count, at: new Date().toISOString() });
}
