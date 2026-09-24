import { describe, expect, it } from "vitest";
import { ListType } from "@/lib/lists";
import { hashFor } from "@/lib/persona";
import { buildPeople } from "@/lib/seed";

// EMAIL hashes copied from fidesplus fides_uploads/demo_drop/demo_drop_seed.ipynb,
// which seeds the first 500 personas of the seed stream into the warehouse.
const NOTEBOOK_ROW_1 = "xH5O+b5WR6TPr3/VcZGAUAEG7cikatxTqHnHJnHQdZ8="; // Lily.Anne@example.com
const NOTEBOOK_ROW_2 = "Rj3Jm6Cot9sYYp9hRuqpSS+wlNPbXfwmnVylGYNDWTk="; // marcus.damico@example.com
const NOTEBOOK_ROW_20 = "D2kTQQ0U6ICGe6Qc1nDOUQWd3AVbIS4onvKJHzqOAhI="; // user4_0@example8.com
const NOTEBOOK_ROW_21 = "5KbGK59xVD+VQdkkELQ2t2MLsIWNNPWMmUCLDBYm6q4="; // user5_0@example1.com
// Shared/junk-pool emails the notebook also holds (rows 104, 171, 328).
const NOTEBOOK_POOL = [
  "vFxvQIrngs69jdRx6syFZLWJ4J4H3/fWeCo1JTjFOwU=", // info@shared.com
  "HVyC6u3zmxashvFrT0xyAc3ducrOrV2PBHdc6H4gwLk=", // household@shared.com
  "9mCrkS7BIdGx6Sigu0vGGxX1rUTV79xOHJKiXpm45Eo=", // test@test.com
];

describe("buildPeople (default)", () => {
  const people = buildPeople();
  const emails = people.personas.map((p) => hashFor(p, ListType.EMAIL));

  it("seeds 200 records with unique ids", () => {
    expect(people.personas).toHaveLength(200);
    expect(new Set(people.ids).size).toBe(200);
  });

  it("places notebook rows 1-20 at every 10th row, in order", () => {
    expect(emails[0]).toBe(NOTEBOOK_ROW_1);
    expect(emails[10]).toBe(NOTEBOOK_ROW_2);
    expect(emails[190]).toBe(NOTEBOOK_ROW_20);
    expect(emails).not.toContain(NOTEBOOK_ROW_21);
  });

  it("keeps notebook emails off the other 90% of rows", () => {
    const fillers = new Set(emails.filter((_, i) => i % 10 !== 0));
    const matches = emails.filter((_, i) => i % 10 === 0);
    expect(matches).toHaveLength(20);
    for (const h of [...matches, ...NOTEBOOK_POOL]) expect(fillers.has(h)).toBe(false);
  });

  it("is prefix-stable, so a smaller seed matches its head", () => {
    expect(buildPeople(25).ids).toEqual(people.ids.slice(0, 25));
  });
});
