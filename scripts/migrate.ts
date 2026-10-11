// Apply db/migrations/*.sql to Neon, once each, as the owner role.
//   npm run db:migrate
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error("DATABASE_URL_UNPOOLED (owner) is not set");
const pool = new Pool({ connectionString: url });

await pool.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz default now())");
const done = new Set((await pool.query("select name from schema_migrations")).rows.map((r) => r.name as string));
const dir = "db/migrations";
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(file)) continue;
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(readFileSync(join(dir, file), "utf8"));
    await client.query("insert into schema_migrations (name) values ($1)", [file]);
    await client.query("commit");
    console.log(`applied ${file}`);
  } catch (e) {
    await client.query("rollback");
    console.error(`FAILED ${file}: ${(e as Error).message}`);
    process.exitCode = 1;
    break;
  } finally {
    client.release();
  }
}
await pool.end();
