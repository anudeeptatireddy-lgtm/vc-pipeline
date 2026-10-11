// Keep-alive for Neon (the only database). Neon's free plan never pauses a
// project for inactivity: its compute sleeps after ~5 idle minutes and wakes on
// the next query in under a second. The daily ping (vercel.json cron) keeps the
// project in active use and proves the connection works, even in weeks when
// nobody opens the dashboard.
import { q } from "./sql";

export interface PingResult {
  neon: { ok: boolean; vcs?: number; error?: string };
}

export async function pingDatabases(): Promise<PingResult> {
  try {
    const [row] = await q<{ n: number }>("select count(*)::int as n from vcs where not archived");
    return { neon: { ok: true, vcs: row?.n } };
  } catch (e) {
    return { neon: { ok: false, error: (e as Error).message } };
  }
}
