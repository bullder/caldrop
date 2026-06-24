import { describe, expect, it } from "vitest";
import { config } from "@/lib/config";

describe("config", () => {
  it("has the baked-in broker id", () => {
    expect(config.dataBrokerId).toBe("4821");
  });

  it("defaults the file date to an 8-digit YYYYMMDD", () => {
    expect(config.fileDate).toMatch(/^\d{8}$/);
  });
});
