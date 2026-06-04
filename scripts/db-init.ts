/**
 * Create the Postgres schema (tables + indexes) for upload persistence.
 *
 * Usage: DATABASE_URL=postgres://... npm run db:init
 *
 * Schema is also created lazily on the first write (see db.ts `ensureSchema`),
 * so this script is optional — handy for provisioning a fresh Neon database.
 */

import { ensureSchema, getSql } from "../src/lib/db";

const sql = getSql();
if (!sql) {
  console.error("DATABASE_URL is not set — nothing to do.");
  process.exit(1);
}

await ensureSchema(sql);
console.log("Schema ready (uploads, upload_records, records).");
