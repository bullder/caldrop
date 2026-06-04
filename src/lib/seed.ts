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

// Sample consumers with personal information used to derive the hashed lists.
export const PEOPLE: PersonaCollection = {
  firstId: 679,
  personas: [
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
  ],
};

// Status codes the upload endpoints accept (spec StatusCode enum).
export const VALID_STATUS = new Set([2, 3, 4, 5]);

export const FIRST_ID = PEOPLE.firstId;

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
