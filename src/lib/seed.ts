/**
 * Seed the source personal-info CSV from the sample persona collection.
 *
 * The download endpoint hashes and streams on the fly from `personal.csv`,
 * so seeding only writes that one source file — no prebuilt archive.
 */

import { config } from "./config";
import { fileLabel, ListType } from "./lists";
import {
  type Persona,
  type PersonaCollection,
  readCsv,
  writeCsv,
} from "./persona";
import { uuidv7Seeded } from "./uuidv7";

function persona(
  first: string,
  last: string,
  dob: string,
  zip: string,
  email: string,
  phone: string,
  maid: string,
  vin: string,
  ctvid: string,
): Persona {
  return { first, last, dob, zip, email, phone, maid, vin, ctvid };
}

// Hand-crafted edge-case personas — kept verbatim for spec compliance tests.
const HAND_CRAFTED: Persona[] = [
  persona("Lily-Anne", "Nguyễn", "1988-04-12", "90210", "Lily.Anne@example.com",
    "+1 (415) 555-0182", "AB12CD34-EF56-7890", "1HGCM82633A004352", "ctv_aa-bb_1122"),
  persona("Marcus", "D'Amico", "1975-11-30", "10001", "marcus.damico@example.com",
    "212-555-0147", "ZZ99YY88-XX77-6655", "JH4KA8260MC000000", "CTV-9090-XYZ"),
  persona("Ella Jane", "Okafor", "1992-07-04", "60614", "ella.jane.okafor@example.com",
    "(773) 555 0199", "11aa22bb-33cc-44dd", "5YJSA1E26HF000337", "ext_skipme_0001"),
  persona("Михаил", "Petrov", "1969-01-23", "02134", "  mikhail.petrov@EXAMPLE.com ",
    "16175550123", "DEADBEEF-CAFE-BABE", "WBA3A5C50CF000000", "ctv:aa:bb:cc"),
  persona("Sofia", "Hernández", "2001-09-09", "33101", "sofia.hernandez@example.com",
    "305.555.0166", "00112233-4455-6677", "2C3CDXBG7DH000000", "ctv_777_abc"),
  persona("Wei", "Zhang", "1983-02-17", "94016", "wei.zhang@example.com",
    "+1 650-555-0110", "A1B2C3D4-E5F6-0011", "3FA6P0H73HR000000", "ctv_zh-201"),
  persona("Fatima", "Al-Sayed", "1996-12-05", "75201", "Fatima.AlSayed@example.com",
    "(214) 555-0173", "F00DCAFE-1234-5678", "1G1ZD5ST7JF000000", "CTV:fa:55:90"),
  persona("José", "Martínez", "1971-06-28", "07097", " jose.martinez@EXAMPLE.com ",
    "201-555-0188", "11112222-3333-4444", "5XYZU3LB6DG000000", "ctv_jose_42"),
  persona("Ananya", "Krishnan", "1990-03-14", "98052", "ananya.krishnan@example.com",
    "+1 (425) 555 0150", "ABCDEF01-2345-6789", "JTDKN3DU0E0000000", "ext_block_777"),
  persona("Łukasz", "Kowalski", "1985-08-21", "60601", "lukasz.kowalski@example.com",
    "312.555.0144", "DEAD0000-BEEF-1111", "WAUZZZ8K9CA000000", "ctv-pl-3344"),
  persona("Chloé", "Dubois", "1999-11-02", "02139", "chloe.dubois@example.com",
    "617-555-0121", "0a1b2c3d-4e5f-6789", "1N4AL3AP7JC000000", "ctv_fr_chloe"),
  persona("Mohammed", "Rahman", "1978-04-30", "11201", "mohammed.rahman@example.com",
    "+1 718 555 0137", "99887766-5544-3322", "KMHD84LF5JU000000", "ctv:md:rh:01"),
  persona("Grace", "O'Brien", "1993-07-19", "30301", "grace.obrien@example.com",
    "404.555.0199", "AAAA1111-BBBB-2222", "2T1BURHE8JC000000", "ctv_ga_grace9"),
  persona("Hiroshi", "Tanaka", "1965-10-11", "96813", "hiroshi.tanaka@example.com",
    "+1 (808) 555-0102", "12ab34cd-56ef-7890", "JN1BJ1CP7JW000000", "ctv_hi_tnk"),
  persona("Isabella", "Rossi", "2003-05-23", "89101", "isabella.rossi@example.com",
    "702-555-0164", "CAFE1234-5678-9ABC", "3VWDX7AJ5DM000000", "ctv_it_rossi3"),
];

// ---------------------------------------------------------------------------
// Bulk generator — deterministic LCG so the CSV is reproducible.
// ---------------------------------------------------------------------------

// Generation style ported from drop_seed_warehouse.ipynb (IdentityGen): small
// name pools with Unicode/apostrophe/suffix variants, four messy DOB formats,
// an example-domain email pattern with a shared/junk pool, raw 10-digit phones,
// and lowercase-UUID MAIDs. The flat one-row-per-persona schema and VIN/NVIN are
// kept (no notebook equivalent), so the upload/download contract is unchanged.
const FIRST_NAMES = ["James", "Mary", "Anne Marie", "José", "Quang", "Sophia", "Liam", "Ava"];
const LAST_NAMES = ["Smith", "Garcia", "Trần", "Smith Jr", "Harris", "O'Brien", "Johnson", "Parker"];

// Shared-email pool (~0.5%) collides across personas to trip the household
// guard; junk pool (~0.2%) is the noise the pipeline must filter.
const SHARED_EMAILS = ["family@shared.com", "info@shared.com", "household@shared.com"];
const JUNK_EMAILS = ["test@test.com", "noreply@example.com"];

// Valid VIN chars — spec excludes I, O, Q.
const VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";

export function makeLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function padHex(n: number, len: number): string {
  return n.toString(16).padStart(len, "0").toUpperCase();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// 32 lowercase hex digits formatted 8-4-4-4-12, mirroring the notebook's
// str(uuid.UUID(int=rng.getrandbits(128))).lower().
function uuidLike(rng: () => number): string {
  let hex = "";
  for (let j = 0; j < 32; j++) hex += Math.floor(rng() * 16).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function generatePersona(i: number, rng: () => number): Persona {
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);

  // Notebook PII zip: zero-padded 5-digit numeric (1..99950).
  const zip = String(1 + Math.floor(rng() * 99950)).padStart(5, "0");

  // Notebook _dob: 1925..2010 in one of four formats so the digit order varies.
  const year = 1925 + Math.floor(rng() * 86);
  const month = 1 + Math.floor(rng() * 12);
  const day = 1 + Math.floor(rng() * 28);
  const dobFmt = 1 + Math.floor(rng() * 4);
  const dob =
    dobFmt === 1 ? `${year}${pad2(month)}${pad2(day)}`        // YYYYMMDD
    : dobFmt === 2 ? `${pad2(month)}/${pad2(day)}/${year}`     // MM/DD/YYYY
    : dobFmt === 3 ? `${pad2(day)}-${pad2(month)}-${year}`     // DD-MM-YYYY
    : `${year}-${pad2(month)}-${pad2(day)}`;                   // ISO

  // Notebook _email: ~0.5% shared, ~0.2% junk, else user<aa>_<n>@example<d>.com.
  const r = Math.floor(rng() * 1000);
  const email =
    r < 5 ? pick(SHARED_EMAILS)
    : r < 7 ? pick(JUNK_EMAILS)
    : `user${i}_0@example${1 + Math.floor(rng() * 9)}.com`;

  // Notebook PHONE: raw 10-digit string, no formatting.
  const phone = String(2000000000 + Math.floor(rng() * 8000000000));

  // Notebook MAID: lowercase UUID.
  const maid = uuidLike(rng);

  // VIN (no notebook source) — embed i for guaranteed uniqueness.
  let vinPrefix = "";
  for (let j = 0; j < 12; j++) {
    vinPrefix += VIN_CHARS[Math.floor(rng() * VIN_CHARS.length)];
  }
  const vin = vinPrefix + String(i).padStart(5, "0");

  // CTVID (no notebook per-person source) — cycle the messy formats, embed i.
  const ctvFormats = [
    `ctv_${padHex(i, 4).toLowerCase()}_${String(1000 + Math.floor(rng() * 9000))}`,
    `CTV-${String(i).padStart(6, "0")}-${String.fromCharCode(65 + Math.floor(rng() * 26))}${String.fromCharCode(65 + Math.floor(rng() * 26))}`,
    `ctv:${padHex(i, 2).toLowerCase()}:${padHex(Math.floor(rng() * 0x100), 2).toLowerCase()}:${padHex(Math.floor(rng() * 0x100), 2).toLowerCase()}`,
  ];
  const ctvid = ctvFormats[i % ctvFormats.length];

  return persona(first, last, dob, zip, email, phone, maid, vin, ctvid);
}

const TARGET_COUNT = 200;

// Base timestamp for seeded UUIDs: 2025-01-01T00:00:00.000Z
const ID_BASE_MS = 1735689600000;

function buildCollection(): PersonaCollection {
  const personaRng = makeLcg(42);
  const personas: Persona[] = [...HAND_CRAFTED];
  for (let i = 0; i < TARGET_COUNT - HAND_CRAFTED.length; i++) {
    personas.push(generatePersona(i, personaRng));
  }

  const uuidRng = makeLcg(1337);
  const ids = personas.map((_, i) =>
    uuidv7Seeded(
      ID_BASE_MS + i,
      Math.floor(uuidRng() * 0x1000),
      Math.floor(uuidRng() * 0x40000000),
      (uuidRng() * 0x100000000) >>> 0,
    ),
  );

  return { personas, ids };
}

// Sample consumers with personal information used to derive the hashed lists.
export const PEOPLE: PersonaCollection = buildCollection();

// Status codes the upload endpoints accept (spec StatusCode enum).
export const VALID_STATUS = new Set([2, 3, 4, 5]);

export function fileName(listType: ListType): string {
  return `${config.fileDate}_${config.dataBrokerId}_${fileLabel(listType)}.csv`;
}

/** Read the seeded personal records back into a collection. */
export function loadPersonas(): PersonaCollection {
  return readCsv(config.personalCsv);
}

export function seed(): void {
  writeCsv(PEOPLE, config.personalCsv);
}
