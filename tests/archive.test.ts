import { unzipSync } from "fflate";
import { beforeEach, describe, expect, it } from "vitest";
import { streamZip } from "@/lib/archive";
import { LIST_TYPES, ListType } from "@/lib/lists";
import * as normalize from "@/lib/normalize";
import { PEOPLE } from "@/lib/seed";
import { parseCsv } from "@/lib/csv";
import { seedTemp } from "./helpers";

beforeEach(() => {
  seedTemp();
});

async function collect(lists?: ListType[]): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = streamZip(lists).getReader();
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
  });

  it("honors a list subset", async () => {
    const zip = await collect([ListType.EMAIL, ListType.PHONE]);
    const names = Object.keys(unzipSync(zip)).sort();
    expect(names).toEqual(["20260312_4821_Email.csv", "20260312_4821_Phone.csv"]);
  });

  it("csv header and row count (one match + one missing)", async () => {
    const zip = await collect();
    const rows = parseCsv(readEntry(zip, "20260312_4821_Phone.csv"));
    expect(rows[0]).toEqual(["Id", "Hash"]);
    expect(rows.length).toBe(1 + 2);
  });

  it("matching row hashes a real persona; missing row does not", async () => {
    const zip = await collect();
    const [match, missing] = parseCsv(readEntry(zip, "20260312_4821_Email.csv")).slice(1);

    // Match: Id is a real 1-based position; hash matches that persona.
    const matchId = Number(match[0]);
    expect(matchId).toBeGreaterThanOrEqual(1);
    expect(matchId).toBeLessThanOrEqual(PEOPLE.personas.length);
    expect(match[1]).toBe(normalize.hashEmail(PEOPLE.personas[matchId - 1].email));

    // Missing: Id is beyond the dataset and its hash is not a real persona's.
    expect(Number(missing[0])).toBe(PEOPLE.personas.length + 1);
    const realHashes = new Set(PEOPLE.personas.map((p) => normalize.hashEmail(p.email)));
    expect(realHashes.has(missing[1])).toBe(false);
  });

  it("ids are stable per persona across all files", async () => {
    const zip = await collect();
    const unzipped = unzipSync(zip);
    // Same persona → same Id in every list file.
    const idSets = Object.values(unzipped).map((buf) =>
      parseCsv(new TextDecoder().decode(buf))
        .slice(1)
        .map((r) => r[0]),
    );
    // All files have the same Id column.
    for (const ids of idSets) {
      expect(ids).toEqual(idSets[0]);
    }
    // Ids are unique within a single file (one match + one missing).
    expect(new Set(idSets[0]).size).toBe(2);
  });

  it("deterministic across calls", async () => {
    const a = await collect();
    const b = await collect();
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});
