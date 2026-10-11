// Manual keep-alive (same as /api/keepalive):  npm run keepalive
import { pingDatabases } from "../lib/keepalive";

const r = await pingDatabases();
console.log(JSON.stringify(r));
if (!r.neon.ok) process.exit(1);
