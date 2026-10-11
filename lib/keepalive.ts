// Keep-alive pings. Neon (primary) wakes on demand, but a daily query keeps
// the run history honest; the Supabase project is kept as a fallback and,
// on the free tier, pauses after 7 idle days, so it gets one cheap REST read.
import { q } from "./sql";

export interface PingResult {
  neon: { ok: boolean; vcs?: number; error?: string };
  supabase: { ok: boolean; skipped?: boolean; error?: string };
}

export async function pingDatabases(): Promise<PingResult> {
  const out: PingResult = { neon: { ok: false }, supabase: { ok: false } };
  try {
    const [row] = await q<{ n: number }>("select count(*)::int as n from vcs");
    out.neon = { ok: true, vcs: row?.n };
  } catch (e) {
    out.neon = { ok: false, error: (e as Error).message };
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    out.supabase = { ok: false, skipped: true };
  } else {
    try {
      const res = await fetch(`${url}/rest/v1/vcs?select=id&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(15000),
      });
      out.supabase = res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
    } catch (e) {
      out.supabase = { ok: false, error: (e as Error).message };
    }
  }
  return out;
}
