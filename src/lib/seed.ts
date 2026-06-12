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

const FIRST_NAMES = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
  "William", "Barbara", "David", "Elizabeth", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Lisa", "Daniel", "Nancy",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
  "Steven", "Dorothy", "Paul", "Kimberly", "Andrew", "Emily", "Joshua", "Donna",
  "Kenneth", "Michelle", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
  "Timothy", "Deborah", "Ronald", "Stephanie", "Edward", "Rebecca", "Jason", "Sharon",
  "Jeffrey", "Laura", "Ryan", "Cynthia", "Jacob", "Kathleen", "Gary", "Amy",
  "Nicholas", "Angela", "Eric", "Shirley", "Jonathan", "Anna", "Stephen", "Brenda",
  "Larry", "Pamela", "Justin", "Emma", "Scott", "Nicole", "Brandon", "Helen",
  "Frank", "Samantha", "Raymond", "Katherine", "Gregory", "Christine", "Samuel", "Debra",
  "Patrick", "Rachel", "Alexander", "Carolyn", "Jack", "Janet", "Dennis", "Catherine",
  "Jerry", "Maria", "Tyler", "Heather", "Aaron", "Diane", "Jose", "Julie",
  "Henry", "Joyce", "Adam", "Victoria", "Douglas", "Kelly", "Nathan", "Christina",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas",
  "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White",
  "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young",
  "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
  "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
  "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz", "Parker",
  "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris", "Morales", "Murphy",
  "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper", "Peterson", "Bailey",
  "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward", "Richardson",
  "Watson", "Brooks", "Chavez", "Wood", "James", "Bennett", "Gray", "Mendoza",
  "Ruiz", "Hughes", "Price", "Alvarez", "Castillo", "Sanders", "Patel", "Myers",
  "Long", "Ross", "Foster", "Jimenez", "Powell", "Jenkins", "Perry", "Russell",
  "Sullivan", "Bell", "Coleman", "Butler", "Henderson", "Barnes", "Gonzales", "Fisher",
  "Vasquez", "Simmons", "Romero", "Jordan", "Patterson", "Hamilton", "Graham", "Reynolds",
];

const ZIPS = [
  "10001", "10002", "10011", "10019", "10022", "10036",
  "90001", "90210", "90211", "90245", "90266",
  "60601", "60602", "60603", "60606", "60614",
  "77001", "77002", "77004", "77006", "77019",
  "85001", "85002", "85004", "85006", "85016",
  "19101", "19102", "19103", "19104",
  "30301", "30303", "30305", "30306", "30309",
  "98101", "98102", "98103", "98104", "98121",
  "02101", "02103", "02115", "02116", "02134",
  "94101", "94102", "94103", "94105", "94107",
  "33101", "33109", "33125", "33130", "33132",
  "75201", "75202", "75203", "75204", "75205",
  "48201", "48202", "48203", "48204",
  "55401", "55402", "55403", "55405",
  "89101", "89102", "89103", "89109",
  "37201", "37203", "37204", "37205",
  "63101", "63103", "63104", "63105",
  "80201", "80202", "80203", "80205",
  "45201", "45202", "45203", "45204",
  "15201", "15203", "15205", "15206",
  "07097", "07302", "07306", "07030",
  "11201", "11205", "11211", "11215",
  "02139", "02140", "02141", "02142",
  "96813", "96814", "96815", "96816",
];

const AREA_CODES = [
  "212", "213", "214", "215", "216", "305", "310", "312", "313", "323",
  "404", "415", "425", "503", "510", "617", "650", "702", "713", "718",
  "773", "805", "808", "818", "832", "916", "917", "925", "949", "954",
  "972", "201", "202", "203", "206", "207", "209", "210", "217", "218",
];

const DOMAINS = [
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
  "aol.com", "protonmail.com", "me.com", "live.com", "msn.com",
];

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

export function generatePersona(i: number, rng: () => number): Persona {
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);

  const year = 1940 + Math.floor(rng() * 65);
  const month = 1 + Math.floor(rng() * 12);
  const day = 1 + Math.floor(rng() * 28);
  const dob = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const zip = pick(ZIPS);
  const domain = pick(DOMAINS);
  const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@${domain}`;

  const areaCode = pick(AREA_CODES);
  const line4 = String(i % 10000).padStart(4, "0");
  const phone = `+1 (${areaCode}) 555-${line4}`;

  // Embed i for guaranteed uniqueness.
  const maid = `${padHex(i, 8)}-${padHex(Math.floor(rng() * 0x10000), 4)}-${padHex(Math.floor(rng() * 0x10000), 4)}`;

  let vinPrefix = "";
  for (let j = 0; j < 12; j++) {
    vinPrefix += VIN_CHARS[Math.floor(rng() * VIN_CHARS.length)];
  }
  const vin = vinPrefix + String(i).padStart(5, "0");

  const ctvFormats = [
    `ctv_${padHex(i, 4).toLowerCase()}_${String(1000 + Math.floor(rng() * 9000))}`,
    `CTV-${String(i).padStart(6, "0")}-${String.fromCharCode(65 + Math.floor(rng() * 26))}${String.fromCharCode(65 + Math.floor(rng() * 26))}`,
    `ctv:${padHex(i, 2).toLowerCase()}:${padHex(Math.floor(rng() * 0x100), 2).toLowerCase()}:${padHex(Math.floor(rng() * 0x100), 2).toLowerCase()}`,
  ];
  const ctvid = ctvFormats[i % ctvFormats.length];

  return persona(first, last, dob, zip, email, phone, maid, vin, ctvid);
}

const TARGET_COUNT = 50;

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
