/**
 * Record uploads to Postgres. Writes three things per accepted file:
 *   - one `uploads` audit row (kept for every file, accepted or rejected),
 *   - one `upload_records` row per parsed (Id,Status) — full submission history,
 *   - an upsert into `records` — the current status per consumer.
 *
 * No-op when DATABASE_URL is unset. Callers should treat a thrown error as
 * non-fatal (log and still return the API response) — see handlers.ts.
 */

import { ensureSchema, getSql, type Sql } from "./db";

export interface ParsedRow {
  consumerId: number;
  status: number;
}

export interface FileOutcome {
  fileName: string;
  accepted: boolean;
  message: string;
  /** Parsed data rows; only populated for accepted files. */
  rows: ParsedRow[];
}

export interface PersistContext {
  mode: "new" | "amend";
  brokerId: string;
  sandbox: boolean;
}

/** Persist every file's outcome. Returns true if anything was written. */
export async function persistUpload(
  ctx: PersistContext,
  files: FileOutcome[],
): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  await ensureSchema(sql);
  for (const f of files) await persistFile(sql, ctx, f);
  return true;
}

/**
 * Drop all previously uploaded data: the audit log, full history, and current
 * state. No-op without a DB. Returns true if a truncate ran.
 */
export async function eraseRecords(): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  await ensureSchema(sql);
  // upload_records cascades from uploads, but truncate all three explicitly.
  await sql(`TRUNCATE upload_records, uploads, records RESTART IDENTITY`);
  return true;
}

async function persistFile(
  sql: Sql,
  ctx: PersistContext,
  file: FileOutcome,
): Promise<void> {
  const inserted = (await sql(
    `INSERT INTO uploads (mode, file_name, broker_id, sandbox, accepted, message, row_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [ctx.mode, file.fileName, ctx.brokerId, ctx.sandbox, file.accepted, file.message, file.rows.length],
  )) as { id: number }[];
  const uploadId = inserted[0].id;

  if (!file.accepted || file.rows.length === 0) return;

  // Full history: one row per parsed line.
  const ids = file.rows.map((r) => r.consumerId);
  const statuses = file.rows.map((r) => r.status);
  await sql(
    `INSERT INTO upload_records (upload_id, consumer_id, status)
     SELECT $1, c, s FROM UNNEST($2::bigint[], $3::int[]) AS t(c, s)`,
    [uploadId, ids, statuses],
  );

  // Current state: upsert. Dedup within the file (last status wins) so a single
  // statement never touches the same conflict target twice.
  const latest = new Map<number, number>();
  for (const r of file.rows) latest.set(r.consumerId, r.status);
  const uids = [...latest.keys()];
  const ustatuses = uids.map((id) => latest.get(id)!);
  await sql(
    `INSERT INTO records (consumer_id, sandbox, status, source_file, mode)
     SELECT c, $1, s, $2, $3 FROM UNNEST($4::bigint[], $5::int[]) AS t(c, s)
     ON CONFLICT (consumer_id, sandbox)
     DO UPDATE SET status = EXCLUDED.status, source_file = EXCLUDED.source_file,
                   mode = EXCLUDED.mode, updated_at = now()`,
    [ctx.sandbox, file.fileName, ctx.mode, uids, ustatuses],
  );
}
