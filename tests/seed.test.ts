import { describe, expect, it } from "vitest";
import { ListType } from "@/lib/lists";
import { hashFor } from "@/lib/persona";
import { buildPeople } from "@/lib/seed";

// EMAIL hashes copied from fidesplus fides_uploads/demo_drop/demo_drop_seed.ipynb,
// which seeds the first 500 personas of the seed stream into the warehouse.
const NOTEBOOK_ROW_1 = "xH5O+b5WR6TPr3/VcZGAUAEG7cikatxTqHnHJnHQdZ8="; // Lily.Anne@example.com
const NOTEBOOK_ROW_2 = "Rj3Jm6Cot9sYYp9hRuqpSS+wlNPbXfwmnVylGYNDWTk="; // marcus.damico@example.com
const NOTEBOOK_ROW_150 = "ELij/wdZucTuTMc8rX4eW1pxKoqMbT2jXCvw//Qb9fE="; // user134_0@example1.com
const NOTEBOOK_ROW_500 = "HJRbANSw8XsVDuimTreRDVOw9VONsfx4fRRxohHqwbs="; // user484_0@example9.com
// Shared/junk-pool emails the notebook also holds (rows 104, 171, 328).
const NOTEBOOK_POOL = [
  "vFxvQIrngs69jdRx6syFZLWJ4J4H3/fWeCo1JTjFOwU=", // info@shared.com
  "HVyC6u3zmxashvFrT0xyAc3ducrOrV2PBHdc6H4gwLk=", // household@shared.com
  "9mCrkS7BIdGx6Sigu0vGGxX1rUTV79xOHJKiXpm45Eo=", // test@test.com
];

describe("buildPeople (default)", () => {
  const people = buildPeople();
  const emails = people.personas.map((p) => hashFor(p, ListType.EMAIL));

  it("seeds 1500 records with unique ids", () => {
    expect(people.personas).toHaveLength(1500);
    expect(new Set(people.ids).size).toBe(1500);
  });

  it("places notebook rows 1-150 at every 10th row, in order", () => {
    expect(emails[0]).toBe(NOTEBOOK_ROW_1);
    expect(emails[10]).toBe(NOTEBOOK_ROW_2);
    expect(emails[1490]).toBe(NOTEBOOK_ROW_150);
    expect(emails).not.toContain(NOTEBOOK_ROW_500);
  });

  it("keeps notebook emails off the other 90% of rows", () => {
    const fillers = new Set(emails.filter((_, i) => i % 10 !== 0));
    const matches = emails.filter((_, i) => i % 10 === 0);
    expect(matches).toHaveLength(150);
    for (const h of [...matches, ...NOTEBOOK_POOL]) expect(fillers.has(h)).toBe(false);
  });

  it("is prefix-stable, so a smaller seed matches its head", () => {
    expect(buildPeople(25).ids).toEqual(people.ids.slice(0, 25));
  });
});
