/**
 * Neon (managed Postgres) connection for Vercel.
 *
 * Persistence is OPTIONAL: with no `DATABASE_URL` (local dev, tests, the Docker
 * image) `getSql()` returns null and all writes become no-ops. Set
 * `DATABASE_URL` in the Vercel project (Neon integration provides it) to record
 * every upload/amend.
 *
 * Uses the HTTP-based `neon()` query function — one round trip per statement,
 * no pool to manage. Ideal for serverless / edge request handlers.
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export type Sql = NeonQueryFunction<false, false>;

let cached: Sql | null = null;

/** Lazily build the query function; null when DATABASE_URL is unset. */
export function getSql(): Sql | null {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  cached = neon(url);
  return cached;
}

export function dbEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** DDL for the three tables. Idempotent — safe to run on every cold start. */
export const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS uploads (
     id          BIGSERIAL PRIMARY KEY,
     mode        TEXT        NOT NULL,
     file_name   TEXT        NOT NULL,
     broker_id   TEXT        NOT NULL,
     sandbox     BOOLEAN     NOT NULL DEFAULT FALSE,
     accepted    BOOLEAN     NOT NULL,
     message     TEXT        NOT NULL,
     row_count   INTEGER     NOT NULL DEFAULT 0,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS upload_records (
     id          BIGSERIAL PRIMARY KEY,
     upload_id   BIGINT  NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
     consumer_id TEXT    NOT NULL,
     status      INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_upload_records_upload
     ON upload_records(upload_id)`,
  `CREATE INDEX IF NOT EXISTS idx_upload_records_consumer
     ON upload_records(consumer_id)`,
  // Current state per consumer. Keyed by (consumer_id, sandbox) so sandbox
  // submissions never collide with real ones.
  `CREATE TABLE IF NOT EXISTS records (
     consumer_id TEXT        NOT NULL,
     sandbox     BOOLEAN     NOT NULL DEFAULT FALSE,
     status      INTEGER     NOT NULL,
     source_file TEXT        NOT NULL,
     mode        TEXT        NOT NULL,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (consumer_id, sandbox)
   )`,
];

let schemaReady: Promise<void> | null = null;

/** Create tables once per process instance (cached). No-op without a DB. */
export function ensureSchema(sql: Sql): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const ddl of SCHEMA_SQL) await sql(ddl);
    })().catch((e) => {
      // Reset so a transient failure can be retried on the next request.
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}
