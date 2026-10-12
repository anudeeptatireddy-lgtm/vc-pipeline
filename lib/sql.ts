// Neon client for the app. Connects as vc_runtime (APP_DATABASE_URL): it can
// read everything and write system tables, but has no UPDATE/DELETE on vcs,
// so every change to vcs goes through the two security-definer functions.
// Server-only; never import from client components.
import { neon, types, type NeonQueryFunction } from "@neondatabase/serverless";

// Keep values in the shapes the rest of the app already uses:
// dates as "YYYY-MM-DD", timestamps as ISO strings, numerics/bigints as numbers.
const OVERRIDES: Record<number, (v: string) => unknown> = {
  1082: (v) => v, // date
  1114: (v) => new Date(`${v.replace(" ", "T")}Z`).toISOString(), // timestamp
  1184: (v) => new Date(v.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")).toISOString(), // timestamptz
  1700: (v) => Number(v), // numeric
  20: (v) => Number(v), // int8 (bigserial ids, counts)
};

export const TYPES = {
  getTypeParser: ((oid: number, format?: unknown) =>
    OVERRIDES[oid] ?? (types.getTypeParser as (o: number, f?: unknown) => unknown)(oid, format)) as typeof types.getTypeParser,
};

let client: NeonQueryFunction<false, false> | undefined;

export function sql(): NeonQueryFunction<false, false> {
  if (client) return client;
  const url = process.env.APP_DATABASE_URL;
  if (!url) throw new Error("APP_DATABASE_URL must be set");
  client = neon(url);
  return client;
}

/**
 * Run a parameterised query and return its rows. Type parsers are passed per
 * query: @neondatabase/serverless 1.2 ignores `types` given to neon() when
 * calling .query(), which left dates as IST-shifted Date objects.
 */
export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const opts = { types: TYPES } as unknown as Parameters<NeonQueryFunction<false, false>["query"]>[1];
  return (await (sql().query as (t: string, p: unknown[], o: unknown) => Promise<unknown>)(text, params, opts)) as T[];
}
