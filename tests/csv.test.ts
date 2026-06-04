import { describe, expect, it } from "vitest";
import { parseCsv, stringifyRow } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses simple rows, no trailing empty row", () => {
    expect(parseCsv("Id,Status\n679,2\n")).toEqual([
      ["Id", "Status"],
      ["679", "2"],
    ]);
  });

  it("keeps interior blank lines as empty rows", () => {
    expect(parseCsv("a\n\nb\n")).toEqual([["a"], [], ["b"]]);
  });

  it("empty string yields no rows", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("handles quoted fields with commas and escaped quotes", () => {
    expect(parseCsv('a,"b,c","d""e"')).toEqual([["a", "b,c", 'd"e']]);
  });

  it("preserves leading/trailing spaces", () => {
    expect(parseCsv(" x , y ")).toEqual([[" x ", " y "]]);
  });
});

describe("stringifyRow", () => {
  it("quotes only when needed", () => {
    expect(stringifyRow(["a", "b,c", 'd"e', 679])).toBe('a,"b,c","d""e",679');
  });

  it("leaves spaces unquoted", () => {
    expect(stringifyRow([" x ", "y"])).toBe(" x ,y");
  });
});
