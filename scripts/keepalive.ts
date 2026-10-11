// Manual / backup keep-alive for the Supabase project (same query as
// /api/keepalive). Run it from any machine with .env.local:
//   npm run keepalive
import { db } from "../lib/db";

const { count, error } = await db().from("vcs").select("id", { count: "exact", head: true });
if (error) {
  console.error(`keepalive failed: ${error.message}`);
  process.exit(1);
}
console.log(`Supabase awake: ${count} VCs at ${new Date().toISOString()}`);
