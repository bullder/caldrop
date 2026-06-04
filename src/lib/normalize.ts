/**
 * Canonicalization and hashing per the DROP Data Broker API spec.
 *
 * All identifiers hash with SHA-256 (UTF-8 input) and Base64 output.
 * Concatenated list types (NDZ, NVIN) hash each normalized field
 * independently, concatenate the Base64 digests with no separator, then
 * hash that concatenated UTF-8 string again.
 */

import { createHash } from "node:crypto";
import unidecode from "unidecode";

export function sha256B64(canonical: string): string {
  return createHash("sha256").update(canonical, "utf8").digest("base64");
}

export function normalizeEmail(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, "").toLowerCase();
}

export function normalizeDob(value?: string | null): string {
  // Accept anything date-ish; keep digits, expect YYYYMMDD.
  return (value ?? "").replace(/\D/g, "");
}

export function normalizePhone(value?: string | null): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function normalizeZip(value?: string | null): string {
  const cleaned = (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned.slice(0, 5).replace(/^0+/, "");
}

export function normalizeName(value?: string | null): string {
  const asciiOnly = unidecode(value ?? "").toLowerCase();
  return asciiOnly.replace(/[^a-z0-9]/g, "");
}

export function normalizeMaid(value?: string | null): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeVin(value?: string | null): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeCtvid(value?: string | null): string {
  return (value ?? "").toLowerCase().replace(/[_\-:]+/g, "");
}

/** Hash each field to Base64, concat digests, hash the result again. */
function concatHash(fields: string[]): string {
  const concatenated = fields.map(sha256B64).join("");
  return sha256B64(concatenated);
}

export function hashEmail(email: string): string {
  return sha256B64(normalizeEmail(email));
}

export function hashPhone(phone: string): string {
  return sha256B64(normalizePhone(phone));
}

export function hashMaid(maid: string): string {
  return sha256B64(normalizeMaid(maid));
}

export function hashCtvid(ctvid: string): string {
  return sha256B64(normalizeCtvid(ctvid));
}

export function hashNdz(first: string, last: string, dob: string, zipCode: string): string {
  return concatHash([
    normalizeName(first),
    normalizeName(last),
    normalizeDob(dob),
    normalizeZip(zipCode),
  ]);
}

export function hashNvin(first: string, last: string, vin: string): string {
  return concatHash([normalizeName(first), normalizeName(last), normalizeVin(vin)]);
}
