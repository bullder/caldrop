/** Persona type and the collection helpers that back the sample data. */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseCsv, stringifyRow } from "./csv";
import { ListType } from "./lists";
import {
  hashCtvid,
  hashEmail,
  hashMaid,
  hashNdz,
  hashNvin,
  hashPhone,
} from "./normalize";

/** One sample consumer's personal information. */
export interface Persona {
  first: string;
  last: string;
  dob: string;
  zip: string;
  email: string;
  phone: string;
  maid: string;
  vin: string;
  ctvid: string;
}

/** Persona field names, in declaration order. */
export const PERSONAL_FIELDS: (keyof Persona)[] = [
  "first",
  "last",
  "dob",
  "zip",
  "email",
  "phone",
  "maid",
  "vin",
  "ctvid",
];

/** Field values in declaration order (matches PERSONAL_FIELDS). */
export function personaValues(p: Persona): string[] {
  return PERSONAL_FIELDS.map((f) => p[f]);
}

/** Spec hash of this persona's identifier for the given list type. */
export function hashFor(p: Persona, listType: ListType): string {
  switch (listType) {
    case ListType.EMAIL:
      return hashEmail(p.email);
    case ListType.PHONE:
      return hashPhone(p.phone);
    case ListType.MAID:
      return hashMaid(p.maid);
    case ListType.CTVID:
      return hashCtvid(p.ctvid);
    case ListType.NDZ:
      return hashNdz(p.first, p.last, p.dob, p.zip);
    case ListType.NVIN:
      return hashNvin(p.first, p.last, p.vin);
  }
}

/** A collection of personas with stable UUIDv7 IDs. */
export interface PersonaCollection {
  personas: Persona[];
  ids: string[];
}

export function csvFieldnames(): string[] {
  return ["Id", ...PERSONAL_FIELDS];
}

/** Yield [id, persona] pairs. */
export function* numbered(
  c: PersonaCollection,
): Generator<[string, Persona]> {
  for (let i = 0; i < c.personas.length; i++) {
    yield [c.ids[i], c.personas[i]];
  }
}

export function writeCsv(c: PersonaCollection, filePath: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const lines = [stringifyRow(csvFieldnames())];
  for (const [recordId, persona] of numbered(c)) {
    lines.push(stringifyRow([recordId, ...personaValues(persona)]));
  }
  writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

export function readCsv(filePath: string): PersonaCollection {
  const text = readFileSync(filePath, "utf8");
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { personas: [], ids: [] };
  }
  const header = rows[0];
  const index: Record<string, number> = {};
  header.forEach((name, i) => (index[name] = i));

  const dataRows = rows.slice(1).filter((r) => r.length > 1);
  const personas: Persona[] = dataRows.map((row) => {
    const p = {} as Persona;
    for (const name of PERSONAL_FIELDS) {
      p[name] = row[index[name]] ?? "";
    }
    return p;
  });
  const ids = dataRows.map((row) => row[index["Id"]] ?? "");
  return { personas, ids };
}
