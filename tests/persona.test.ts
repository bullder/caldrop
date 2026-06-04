import { describe, expect, it } from "vitest";
import { ListType } from "@/lib/lists";
import * as normalize from "@/lib/normalize";
import {
  csvFieldnames,
  hashFor,
  type Persona,
  personaValues,
  PERSONAL_FIELDS,
} from "@/lib/persona";

const sample: Persona = {
  first: "Lily-Anne",
  last: "Nguyễn",
  dob: "1988-04-12",
  zip: "90210",
  email: "Lily.Anne@example.com",
  phone: "+1 (415) 555-0182",
  maid: "AB12CD34-EF56-7890",
  vin: "1HGCM82633A004352",
  ctvid: "ctv_aa-bb_1122",
};

describe("persona", () => {
  it("values follow declaration order", () => {
    expect(personaValues(sample)).toEqual([
      "Lily-Anne",
      "Nguyễn",
      "1988-04-12",
      "90210",
      "Lily.Anne@example.com",
      "+1 (415) 555-0182",
      "AB12CD34-EF56-7890",
      "1HGCM82633A004352",
      "ctv_aa-bb_1122",
    ]);
  });

  it("csv fieldnames lead with Id", () => {
    expect(csvFieldnames()).toEqual(["Id", ...PERSONAL_FIELDS]);
  });

  it("hashFor dispatches per list type", () => {
    expect(hashFor(sample, ListType.EMAIL)).toBe(normalize.hashEmail(sample.email));
    expect(hashFor(sample, ListType.PHONE)).toBe(normalize.hashPhone(sample.phone));
    expect(hashFor(sample, ListType.MAID)).toBe(normalize.hashMaid(sample.maid));
    expect(hashFor(sample, ListType.CTVID)).toBe(normalize.hashCtvid(sample.ctvid));
    expect(hashFor(sample, ListType.NDZ)).toBe(
      normalize.hashNdz(sample.first, sample.last, sample.dob, sample.zip),
    );
    expect(hashFor(sample, ListType.NVIN)).toBe(
      normalize.hashNvin(sample.first, sample.last, sample.vin),
    );
  });
});
