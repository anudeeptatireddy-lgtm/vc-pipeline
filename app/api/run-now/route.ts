// Manual demo trigger (Phase 6). Same auth as the cron route.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json({ ok: false, error: "pipeline not implemented yet" }, { status: 501 });
}
