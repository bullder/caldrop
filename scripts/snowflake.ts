/**
 * Generate data/snowflake.sql — CREATE TABLE + INSERT statements for 1.2×
 * the seeded personal.csv record count (10 000 base → 12 000 total).
 *
 * Run with: npm run snowflake
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { generatePersona, makeLcg, PEOPLE } from "../src/lib/seed";
import { uuidv7Seeded } from "../src/lib/uuidv7";

const BASE_COUNT = PEOPLE.personas.length; // 10 000
const TOTAL = Math.ceil(BASE_COUNT * 1.2);  // 12 000
const EXTRA = TOTAL - BASE_COUNT;           // 2 000

// Base timestamp for extra UUIDs — starts right after the seed range.
const EXTRA_UUID_BASE_MS = 1735689600000 + BASE_COUNT;

const extraPersonaRng = makeLcg(9999);
const extraUuidRng = makeLcg(54321);

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

function row(id: string, p: { first: string; last: string; dob: string; zip: string; email: string; phone: string; maid: string; vin: string; ctvid: string }): string {
  return `(${[id, p.first, p.last, p.dob, p.zip, p.email, p.phone, p.maid, p.vin, p.ctvid].map(esc).join(",")})`;
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
\t"ctvid" VARCHAR(16777216)
);\n`;

const INSERT_HEADER = `INSERT INTO FIDES_DEMO.PUBLIC.PERSONAL ("Id","first","last","dob","zip","email","phone","maid","vin","ctvid")\nVALUES\n`;
const BATCH = 1000;

// Collect all rows
const allRows: string[] = [];

for (let i = 0; i < BASE_COUNT; i++) {
  allRows.push(row(PEOPLE.ids[i], PEOPLE.personas[i]));
}

for (let i = 0; i < EXTRA; i++) {
  const p = generatePersona(BASE_COUNT + i, extraPersonaRng);
  allRows.push(row(extraId(i), p));
}

// Build SQL in batches of BATCH rows per INSERT
const parts: string[] = [HEADER];
for (let start = 0; start < allRows.length; start += BATCH) {
  const slice = allRows.slice(start, start + BATCH);
  parts.push(INSERT_HEADER + slice.join(",\n") + ";\n");
}

const outPath = path.join(__dirname, "../data/snowflake.sql");
writeFileSync(outPath, parts.join("\n"), "utf8");
console.log(`Wrote ${outPath} (${allRows.length} records in ${Math.ceil(allRows.length / BATCH)} INSERT batches)`);
