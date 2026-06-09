/**
 * Generate data/snowflake.sql — CREATE TABLE + INSERT statements for 1.2×
 * the seeded personal.csv record count (5 000 base → 6 000 total).
 *
 * 50% of rows (3 000) come from personal.csv; the other 50% (3 000) are
 * freshly generated with distinct UUIDs — no overlap with personal.csv.
 *
 * Run with: npm run snowflake
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { generatePersona, makeLcg, PEOPLE } from "../src/lib/seed";
import { uuidv7Seeded } from "../src/lib/uuidv7";

const BASE_COUNT = PEOPLE.personas.length;      // 5 000
const TOTAL = Math.ceil(BASE_COUNT * 1.2);       // 6 000
const OVERLAP = Math.floor(TOTAL * 0.5);         // 3 000 — from personal.csv
const NO_OVERLAP = TOTAL - OVERLAP;              // 3 000 — not in personal.csv

// Base timestamp for non-overlapping UUIDs — well after the seed range.
const EXTRA_UUID_BASE_MS = 1735689600000 + BASE_COUNT + 10_000;

const extraPersonaRng = makeLcg(9999);
const extraUuidRng = makeLcg(54321);
const exemptRng = makeLcg(7777);

const EXEMPT_PROBABILITY = 0.0001; // 0.01%

function extraId(i: number): string {
  return uuidv7Seeded(
    EXTRA_UUID_BASE_MS + i,
    Math.floor(extraUuidRng() * 0x1000),
    Math.floor(extraUuidRng() * 0x40000000),
    (extraUuidRng() * 0x100000000) >>> 0,
  );
}

function esc(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

function row(
  id: string,
  p: { first: string; last: string; dob: string; zip: string; email: string; phone: string; maid: string; vin: string; ctvid: string },
  exempt: boolean,
): string {
  const cols = [id, p.first, p.last, p.dob, p.zip, p.email, p.phone, p.maid, p.vin, p.ctvid].map(esc);
  cols.push(exempt ? "TRUE" : "FALSE");
  return `(${cols.join(",")})`;
}

const HEADER = `create or replace TABLE FIDES_DEMO.PUBLIC.PERSONAL (
\t"Id" VARCHAR(16777216),
\t"first" VARCHAR(16777216),
\t"last" VARCHAR(16777216),
\t"dob" VARCHAR(16777216),
\t"zip" VARCHAR(16777216),
\t"email" VARCHAR(16777216),
\t"phone" VARCHAR(16777216),
\t"maid" VARCHAR(16777216),
\t"vin" VARCHAR(16777216),
\t"ctvid" VARCHAR(16777216),
\t"exempt" BOOLEAN
);\n`;

const COLS = `"Id","first","last","dob","zip","email","phone","maid","vin","ctvid","exempt"`;
const INSERT_HEADER = `INSERT INTO FIDES_DEMO.PUBLIC.PERSONAL (${COLS})\nVALUES\n`;
const BATCH = 1000;

const allRows: string[] = [];

// 50% overlap: first OVERLAP records from personal.csv (same UUIDs).
for (let i = 0; i < OVERLAP; i++) {
  allRows.push(row(PEOPLE.ids[i], PEOPLE.personas[i], exemptRng() < EXEMPT_PROBABILITY));
}

// 50% no-overlap: freshly generated records with distinct UUIDs not in personal.csv.
for (let i = 0; i < NO_OVERLAP; i++) {
  const p = generatePersona(BASE_COUNT + i, extraPersonaRng);
  allRows.push(row(extraId(i), p, exemptRng() < EXEMPT_PROBABILITY));
}

// Build SQL in batches of BATCH rows per INSERT
const parts: string[] = [HEADER];
for (let start = 0; start < allRows.length; start += BATCH) {
  const slice = allRows.slice(start, start + BATCH);
  parts.push(INSERT_HEADER + slice.join(",\n") + ";\n");
}

const exemptCount = allRows.filter((r) => r.endsWith("TRUE)")).length;
const outPath = path.join(__dirname, "../data/snowflake.sql");
writeFileSync(outPath, parts.join("\n"), "utf8");
console.log(
  `Wrote ${outPath} (${allRows.length} records: ${OVERLAP} overlap + ${NO_OVERLAP} no-overlap, ` +
  `${exemptCount} exempt, in ${Math.ceil(allRows.length / BATCH)} batches)`,
);
