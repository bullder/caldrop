import { writeFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as preview } from "@/app/preview/route";
import { config } from "@/lib/config";
import { ListType } from "@/lib/lists";
import * as normalize from "@/lib/normalize";
import { csvFieldnames } from "@/lib/persona";
import { buildPeople } from "@/lib/seed";
import { SEED_COUNT, seedTemp } from "./helpers";

// Deterministic reference for what seedTemp() wrote (same count, same RNG).
const PEOPLE = buildPeople(SEED_COUNT);

let dir: string;
beforeEach(() => {
  dir = seedTemp();
});

describe("preview", () => {
  it("no auth required, returns html", async () => {
    const r = await preview();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/^text\/html/);
  });

  it("renders header and all rows", async () => {
    const text = await (await preview()).text();
    expect(text).toContain("<th>Id</th>");
    expect(text).toContain("<th>email</th>");
    expect(text).toContain(`${PEOPLE.personas.length} records`);
    expect((text.match(/<tr>/g) ?? []).length).toBe(1 + PEOPLE.personas.length);
  });

  it("renders all six hash columns", async () => {
    const text = await (await preview()).text();
    for (const lt of Object.values(ListType)) {
      expect(text).toContain(`<th>${lt}</th>`);
    }
  });

  it("hash cells match normalize", async () => {
    const text = await (await preview()).text();
    const person = PEOPLE.personas[0];
    expect(text).toContain(`<td>${normalize.hashEmail(person.email)}</td>`);
    expect(text).toContain(`<td>${normalize.hashPhone(person.phone)}</td>`);
  });

  it("escapes html in values", async () => {
    const fields = csvFieldnames();
    const row: Record<string, string> = {};
    for (const f of fields) row[f] = "x";
    row["Id"] = "1";
    row["first"] = "<script>alert(1)</script>";
    const header = fields.join(",");
    const line = fields.map((f) => row[f]).join(",");
    const csvPath = path.join(dir, "personal.csv");
    writeFileSync(csvPath, `${header}\n${line}\n`);
    config.personalCsv = csvPath;

    const text = await (await preview()).text();
    expect(text).not.toContain("<script>");
    expect(text).toContain("&lt;script&gt;");
  });

  it("500 when not seeded", async () => {
    config.personalCsv = path.join(dir, "missing.csv");
    const r = await preview();
    expect(r.status).toBe(500);
  });

  it("empty rows renders no data", async () => {
    const csvPath = path.join(dir, "personal.csv");
    writeFileSync(csvPath, "");
    config.personalCsv = csvPath;
    const r = await preview();
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("No data.");
  });
});
