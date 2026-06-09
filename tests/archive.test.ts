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

  it("csv header and row count", async () => {
    const zip = await collect();
    const rows = parseCsv(readEntry(zip, "20260312_4821_Phone.csv"));
    expect(rows[0]).toEqual(["Id", "Hash"]);
    expect(rows.length).toBe(1 + PEOPLE.personas.length);
  });

  it("hashes match normalize", async () => {
    const zip = await collect();
    const rows = parseCsv(readEntry(zip, "20260312_4821_Email.csv")).slice(1);
    const expected = PEOPLE.personas.map((p) => normalize.hashEmail(p.email));
    expect(rows.map(([, h]) => h)).toEqual(expected);
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
    // Ids are unique within a single file.
    expect(new Set(idSets[0]).size).toBe(PEOPLE.personas.length);
  });

  it("deterministic across calls", async () => {
    const a = await collect();
    const b = await collect();
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});
