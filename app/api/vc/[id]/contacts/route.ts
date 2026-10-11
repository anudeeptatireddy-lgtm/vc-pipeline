// Who to contact at one firm, for the dashboard workspace. Read-only.
import { NextResponse } from "next/server";
import { getContacts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getContacts(id);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=60" } });
}
