import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as normalize from "@/lib/normalize";

// SHA-256("") in Base64 — a fixed, well-known vector.
const EMPTY_SHA256_B64 = "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=";

function refSha256B64(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("base64");
}

describe("sha256B64", () => {
  it("empty string known vector", () => {
    expect(normalize.sha256B64("")).toBe(EMPTY_SHA256_B64);
  });

  it("matches reference implementation", () => {
    for (const s of ["abc", "lilyanne", "Михаил", "919==", ""]) {
      expect(normalize.sha256B64(s)).toBe(refSha256B64(s));
    }
  });

  it("output is valid base64", () => {
    const out = normalize.sha256B64("anything");
    expect(out.length).toBe(44);
    expect(Buffer.from(out, "base64")).toEqual(createHash("sha256").update("anything").digest());
  });
});

describe("normalizeEmail", () => {
  it.each([
    ["User@Example.COM", "user@example.com"],
    ["  spaced @ example .com ", "spaced@example.com"],
    ["\tNoTabs@x.com\n", "notabs@x.com"],
    ["already@clean.com", "already@clean.com"],
  ])("remove whitespace then lowercase %s", (raw, expected) => {
    expect(normalize.normalizeEmail(raw)).toBe(expected);
  });

  it("null safe", () => {
    expect(normalize.normalizeEmail(null)).toBe("");
  });
});

describe("normalizeDob", () => {
  it.each([
    ["1988-04-12", "19880412"],
    ["1988/04/12", "19880412"],
    ["19880412", "19880412"],
    ["2001.09.09", "20010909"],
  ])("digits only %s", (raw, expected) => {
    expect(normalize.normalizeDob(raw)).toBe(expected);
  });
});

describe("normalizePhone", () => {
  it.each([
    ["+1 (415) 555-0182", "4155550182"],
    ["212-555-0147", "2125550147"],
    ["16175550123", "6175550123"],
    ["(773) 555 0199", "7735550199"],
    ["555 0199", "5550199"],
  ])("digits only last ten %s", (raw, expected) => {
    expect(normalize.normalizePhone(raw)).toBe(expected);
  });
});

describe("normalizeZip", () => {
  it.each([
    ["90210", "90210"],
    ["10001", "10001"],
    ["02134", "2134"],
    ["90210-1234", "90210"],
    ["K1A 0B1", "k1a0b"],
    ["00123", "123"],
  ])("alnum lower trunc5 striplead0 %s", (raw, expected) => {
    expect(normalize.normalizeZip(raw)).toBe(expected);
  });

  it("all zero collapses to empty", () => {
    expect(normalize.normalizeZip("00000")).toBe("");
  });
});

describe("normalizeName", () => {
  it.each([
    ["Lily-Anne", "lilyanne"],
    ["D'Amico", "damico"],
    ["Ella Jane", "ellajane"],
    ["Nguyễn", "nguyen"],
    ["Михаил", "mikhail"],
    ["Hernández", "hernandez"],
  ])("spec examples %s", (raw, expected) => {
    expect(normalize.normalizeName(raw)).toBe(expected);
  });
});

describe("normalizeMaid", () => {
  it.each([
    ["AB12CD34-EF56-7890", "ab12cd34ef567890"],
    ["11aa22bb-33cc-44dd", "11aa22bb33cc44dd"],
    ["DEADBEEF-CAFE-BABE", "deadbeefcafebabe"],
  ])("lowercase strip nonalnum %s", (raw, expected) => {
    expect(normalize.normalizeMaid(raw)).toBe(expected);
  });
});

describe("normalizeVin", () => {
  it.each([
    ["1HGCM82633A004352", "1hgcm82633a004352"],
    ["JH4-KA8260 MC000000", "jh4ka8260mc000000"],
  ])("lowercase strip nonalnum %s", (raw, expected) => {
    expect(normalize.normalizeVin(raw)).toBe(expected);
  });
});

describe("normalizeCtvid", () => {
  it.each([
    ["ctv_aa-bb_1122", "ctvaabb1122"],
    ["CTV-9090-XYZ", "ctv9090xyz"],
    ["ctv:aa:bb:cc", "ctvaabbcc"],
    ["ext_skipme_0001", "extskipme0001"],
  ])("lowercase strip separators %s", (raw, expected) => {
    expect(normalize.normalizeCtvid(raw)).toBe(expected);
  });
});

describe("single field hashers", () => {
  it("hashEmail normalizes first", () => {
    expect(normalize.hashEmail("  User@Example.COM ")).toBe(normalize.sha256B64("user@example.com"));
  });
  it("hashPhone normalizes first", () => {
    expect(normalize.hashPhone("+1 (415) 555-0182")).toBe(normalize.sha256B64("4155550182"));
  });
  it("hashMaid normalizes first", () => {
    expect(normalize.hashMaid("AB12CD34-EF56-7890")).toBe(normalize.sha256B64("ab12cd34ef567890"));
  });
  it("hashCtvid normalizes first", () => {
    expect(normalize.hashCtvid("CTV-9090-XYZ")).toBe(normalize.sha256B64("ctv9090xyz"));
  });
});

describe("concat hashes", () => {
  it("ndz matches manual algorithm", () => {
    const digests = ["lilyanne", "nguyen", "19880412", "90210"].map(refSha256B64).join("");
    expect(normalize.hashNdz("Lily-Anne", "Nguyễn", "1988-04-12", "90210")).toBe(refSha256B64(digests));
  });
  it("nvin matches manual algorithm", () => {
    const digests = ["marcus", "damico", "jh4ka8260mc000000"].map(refSha256B64).join("");
    expect(normalize.hashNvin("Marcus", "D'Amico", "JH4KA8260MC000000")).toBe(refSha256B64(digests));
  });
  it("concat is double hash not single", () => {
    const single = normalize.sha256B64("lilyannenguyen198804129021");
    expect(normalize.hashNdz("Lily-Anne", "Nguyễn", "1988-04-12", "90210")).not.toBe(single);
  });
  it("deterministic", () => {
    expect(normalize.hashNvin("Marcus", "D'Amico", "JH4KA8260MC000000")).toBe(
      normalize.hashNvin("Marcus", "D'Amico", "JH4KA8260MC000000"),
    );
  });
  it("field order matters", () => {
    expect(normalize.hashNvin("A", "B", "V")).not.toBe(normalize.hashNvin("B", "A", "V"));
  });
});
