import { unzipSync } from "fflate";
import { beforeEach, describe, expect, it } from "vitest";
import { type DownloadOpts, streamZip } from "@/lib/archive";
import { LIST_TYPES, ListType } from "@/lib/lists";
import * as normalize from "@/lib/normalize";
import { buildPeople } from "@/lib/seed";
import { parseCsv } from "@/lib/csv";
import { SEED_COUNT, seedTemp } from "./helpers";

// Deterministic reference for what seedTemp() wrote (same count, same RNG).
const PEOPLE = buildPeople(SEED_COUNT);

beforeEach(() => {
  seedTemp();
});

async function collect(lists?: ListType[], opts?: DownloadOpts): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = streamZip(lists, opts).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function readEntry(zip: Uint8Array, name: string): string {
  return new TextDecoder().decode(unzipSync(zip)[name]);
}

describe("streamZip", () => {
  it("produces a valid zip with one CSV per list (default: all)", async () => {
    const zip = await collect();
    const names = Object.keys(unzipSync(zip));
    expect(names.length).toBe(LIST_TYPES.length);
    expect(names).toContain("20260312_4821_Email.csv");
    expect(names).toContain("20260312_4821_NameVIN.csv");
    expect(names).not.toContain("20260312_4821_NVIN.csv");
  });

  it("honors a list subset", async () => {
    const zip = await collect([ListType.EMAIL, ListType.PHONE]);
    const names = Object.keys(unzipSync(zip)).sort();
    expect(names).toEqual(["20260312_4821_Email.csv", "20260312_4821_Phone.csv"]);
  });

  it("csv header and row count (every persona + one missing)", async () => {
    const zip = await collect();
    const rows = parseCsv(readEntry(zip, "20260312_4821_Phone.csv"));
    expect(rows[0]).toEqual(["Id", "Hash"]);
    expect(rows.length).toBe(1 + PEOPLE.personas.length + 1);
  });

  it("matching rows hash every real persona; missing row does not", async () => {
    const zip = await collect();
    const rows = parseCsv(readEntry(zip, "20260312_4821_Email.csv")).slice(1);
    const count = PEOPLE.personas.length;

    // One matching row per persona, in order: Id is the 1-based position and
    // the hash matches that persona.
    for (let idx = 0; idx < count; idx++) {
      expect(Number(rows[idx][0])).toBe(idx + 1);
      expect(rows[idx][1]).toBe(normalize.hashEmail(PEOPLE.personas[idx].email));
    }

    // Trailing missing row: Id is beyond the dataset; hash is not a real one.
    const missing = rows[count];
    expect(Number(missing[0])).toBe(count + 1);
    const realHashes = new Set(PEOPLE.personas.map((p) => normalize.hashEmail(p.email)));
    expect(realHashes.has(missing[1])).toBe(false);
  });

  it("?limit caps matching rows; ?missing sets synthetic count", async () => {
    const zip = await collect(undefined, { limit: 3, missing: 2 });
    const rows = parseCsv(readEntry(zip, "20260312_4821_Email.csv")).slice(1);
    expect(rows.length).toBe(3 + 2);
    expect(rows.slice(0, 3).map((r) => Number(r[0]))).toEqual([1, 2, 3]);
    // Missing rows carry Ids just past the seeded range.
    const missingIds = rows.slice(3).map((r) => Number(r[0]));
    expect(missingIds).toEqual([PEOPLE.personas.length + 1, PEOPLE.personas.length + 2]);
  });

  it("deterministic across calls", async () => {
    const a = await collect();
    const b = await collect();
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});
