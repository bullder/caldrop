import { describe, expect, it } from "vitest";
import { fileLabel, LIST_TYPES, ListType, parseLists } from "@/lib/lists";

describe("lists", () => {
  it("file labels match spec casing", () => {
    expect(fileLabel(ListType.EMAIL)).toBe("Email");
    expect(fileLabel(ListType.NDZ)).toBe("NDZ");
    expect(fileLabel(ListType.PHONE)).toBe("Phone");
    expect(fileLabel(ListType.NVIN)).toBe("NameVIN");
  });

  it("has all six list types in spec order", () => {
    expect(LIST_TYPES).toEqual([
      ListType.NDZ,
      ListType.EMAIL,
      ListType.PHONE,
      ListType.MAID,
      ListType.NVIN,
      ListType.CTVID,
    ]);
  });

  it("parses a comma-separated value, trimming and upcasing", () => {
    expect(parseLists(" email , ndz ")).toEqual([ListType.EMAIL, ListType.NDZ]);
  });

  it("skips empty tokens", () => {
    expect(parseLists("EMAIL,,PHONE")).toEqual([ListType.EMAIL, ListType.PHONE]);
  });

  it("throws on unknown token", () => {
    expect(() => parseLists("EMAIL,BOGUS")).toThrow(/Unknown list type 'BOGUS'/);
  });
});
