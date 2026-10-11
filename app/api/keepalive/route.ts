// Daily cron (vercel.json): one cheap Neon query, then upkeep of contacts and
// drafted messages (lib/maintenance.ts) inside the function's time limit.
import { isCronAuthorized } from "@/lib/auth";
import { pingDatabases } from "@/lib/keepalive";
import { runMaintenance } from "@/lib/maintenance";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const r = await pingDatabases();
  const upkeep = r.neon.ok ? await runMaintenance().catch((e) => ({ error: (e as Error).message })) : null;
  return Response.json({ ok: r.neon.ok, ...r, upkeep, at: new Date().toISOString() }, { status: r.neon.ok ? 200 : 500 });
}
