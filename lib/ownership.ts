// Who owns which column (docs/BRIEF.md requirement 4, README "Data ownership").
// Every system write is built from these allowlists, so a user-owned column can
// never appear in the scan's SQL. The database enforces the same split with
// column grants and a trigger (db/migrations/0008_data_ownership.sql);
// tests/ownership.int.test.ts checks the two stay in sync.

/** Vikram's columns on `vcs`. The system never writes these after a row is created. */
export const USER_OWNED_VCS_COLUMNS = [
  "name", "firm", "thesis", "status", "last_contact_date", "contact_history", "personal_notes",
] as const;

/** The four signal-derived columns the scan updates (via update_vc_signals), plus its timestamp. */
export const VCS_SIGNAL_COLUMNS = ["last_signal_date", "signal_summary", "follow_up_score", "recommended_action"] as const;
export const VCS_SYSTEM_TIMESTAMP = "updated_by_system_at" as const;

/** Identifier and archive columns, written only by setup scripts (via update_vc_identifiers). */
export const VCS_IDENTIFIER_COLUMNS = [
  "linkedin_url", "x_user_id", "bluesky_handle", "youtube_channel_id", "rss_url", "portfolio_url", "team_url",
  "sec_cik", "website", "partner_name", "partner_confidence", "priority", "region", "needs_review",
  "archived", "archived_reason",
] as const;

/** Columns a new `vcs` row is created with (seed_new_vcs), then never written again by the system. */
export const VCS_SEED_COLUMNS = ["seed_key", ...USER_OWNED_VCS_COLUMNS] as const;

/**
 * System tables and the columns the app may write in each. `vcs` is deliberately
 * absent: it is only ever changed through update_vc_signals / update_vc_identifiers
 * (system columns) and created through seed_new_vcs.
 */
export const SYSTEM_WRITE_COLUMNS = {
  signals: [
    "vc_id", "signal_type", "summary", "source_url", "source_name", "source_tier", "published_date", "evidence_quote",
    "company_name", "round_stage", "sector_fit", "customer_type", "offering_type", "logistics_relevance", "confidence",
    "corroborated_by", "opening_line", "nudge_line", "signal_value", "classification_votes",
  ],
  vc_score_history: ["vc_id", "run_id", "follow_up_score", "recommended_action"],
  pipeline_runs: ["trigger", "finished_at", "vcs_processed", "errors", "usage"],
  portfolio_snapshots: ["vc_id", "kind", "entries", "entries_hash"],
  vc_profiles: ["vc_id", "does_seed", "b2b_logistics_thesis", "investor_type", "typical_check", "geo_focus", "evidence_urls", "profiled_at"],
  vc_contacts: ["vc_id", "name", "title", "poc_level", "focus", "bio", "relevant", "rank", "linkedin_url", "x_url", "email", "email_source_url", "source_url"],
  vc_channels: ["vc_id", "pitch_url", "emails", "email_sources", "x_url", "contact_url", "email_hidden_from_bots", "updated_at"],
  vc_messages: ["vc_id", "contact_id", "signal_id", "kind", "subject", "body"],
  suggested_vcs: ["firm", "partner_name", "reason", "evidence_urls", "rubric_score", "deal_count", "summary", "caveat"],
} as const satisfies Record<string, readonly string[]>;

export type SystemTable = keyof typeof SYSTEM_WRITE_COLUMNS;
export type ColumnOf<T extends SystemTable> = (typeof SYSTEM_WRITE_COLUMNS)[T][number];

/** Tables whose rows the scan may delete (per-firm snapshots it rebuilds). */
const DELETABLE: ReadonlySet<SystemTable> = new Set(["vc_contacts", "vc_messages"]);

/** Columns that may appear in WHERE / ON CONFLICT (keys, never written). */
const KEY_COLUMNS: Record<SystemTable, readonly string[]> = {
  signals: ["id", "vc_id", "source_url"],
  vc_score_history: ["id"],
  pipeline_runs: ["id"],
  portfolio_snapshots: ["id"],
  vc_profiles: ["vc_id"],
  vc_contacts: ["id", "vc_id"],
  vc_channels: ["vc_id"],
  vc_messages: ["id", "vc_id", "contact_id"],
  suggested_vcs: ["id", "firm", "partner_name"],
};

export class OwnershipError extends Error {}

function assertWritable<T extends SystemTable>(table: T, cols: readonly string[]): void {
  if (!(table in SYSTEM_WRITE_COLUMNS)) throw new OwnershipError(`${table} is not a system table`);
  const allowed = SYSTEM_WRITE_COLUMNS[table] as readonly string[];
  for (const c of cols) if (!allowed.includes(c)) throw new OwnershipError(`${table}.${c} is not on the system write allowlist`);
}

function assertKeys(table: SystemTable, cols: readonly string[]): void {
  for (const c of cols) if (!KEY_COLUMNS[table].includes(c)) throw new OwnershipError(`${table}.${c} can't be used as a key`);
}

const list = (cols: readonly string[]) => cols.join(", ");

/** `insert into t (cols) values ($1..$n)` with optional ON CONFLICT handling and RETURNING. */
export function insertSql<T extends SystemTable>(
  table: T,
  cols: readonly ColumnOf<T>[],
  opts: { conflict?: readonly string[]; update?: readonly ColumnOf<T>[]; doNothing?: boolean; returning?: string } = {},
): string {
  assertWritable(table, cols);
  let s = `insert into public.${table} (${list(cols)}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`;
  s += conflictClause(table, opts);
  if (opts.returning) s += ` returning ${opts.returning}`;
  return s;
}

/**
 * `insert into t (cols) select cols from jsonb_populate_recordset(null::t, $1::jsonb)`:
 * bulk insert from a JSON array. Only the listed columns are read from the JSON.
 */
export function insertFromJsonSql<T extends SystemTable>(
  table: T,
  cols: readonly ColumnOf<T>[],
  opts: { conflict?: readonly string[]; update?: readonly ColumnOf<T>[]; doNothing?: boolean } = {},
): string {
  assertWritable(table, cols);
  return `insert into public.${table} (${list(cols)}) select ${list(cols)} from jsonb_populate_recordset(null::public.${table}, $1::jsonb)${conflictClause(table, opts)}`;
}

function conflictClause<T extends SystemTable>(table: T, opts: { conflict?: readonly string[]; update?: readonly ColumnOf<T>[]; doNothing?: boolean }): string {
  if (!opts.conflict) return "";
  assertKeys(table, opts.conflict);
  if (opts.doNothing || !opts.update?.length) return ` on conflict (${list(opts.conflict)}) do nothing`;
  assertWritable(table, opts.update);
  return ` on conflict (${list(opts.conflict)}) do update set ${opts.update.map((c) => `${c} = excluded.${c}`).join(", ")}`;
}

/** `update t set c1 = $1, ... where k1 = $n+1 and ...`. */
export function updateSql<T extends SystemTable>(table: T, set: readonly ColumnOf<T>[], where: readonly string[]): string {
  assertWritable(table, set);
  assertKeys(table, where);
  const n = set.length;
  return `update public.${table} set ${set.map((c, i) => `${c} = $${i + 1}`).join(", ")} where ${where.map((k, i) => `${k} = $${n + i + 1}`).join(" and ")}`;
}

/** `delete from t where k1 = $1 ...`, only for tables the scan rebuilds per firm. */
export function deleteSql(table: SystemTable, where: readonly string[]): string {
  if (!DELETABLE.has(table)) throw new OwnershipError(`rows in ${table} can't be deleted by the app`);
  assertKeys(table, where);
  return `delete from public.${table} where ${where.map((k, i) => `${k} = $${i + 1}`).join(" and ")}`;
}

/** Pick only allowlisted columns from an object, in allowlist order (for JSON payloads). */
export function pickColumns<T extends SystemTable>(table: T, row: Record<string, unknown>, cols: readonly ColumnOf<T>[]): Record<string, unknown> {
  assertWritable(table, cols);
  return Object.fromEntries(cols.map((c) => [c, row[c] ?? null]));
}
