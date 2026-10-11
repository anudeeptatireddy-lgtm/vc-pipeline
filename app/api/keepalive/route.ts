// Daily keep-alive (vercel.json cron): one cheap Neon query.
import { isCronAuthorized } from "@/lib/auth";
import { pingDatabases } from "@/lib/keepalive";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const r = await pingDatabases();
  return Response.json({ ok: r.neon.ok, ...r, at: new Date().toISOString() }, { status: r.neon.ok ? 200 : 500 });
}
