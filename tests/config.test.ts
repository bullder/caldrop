import { describe, expect, it } from "vitest";
import { config } from "@/lib/config";

describe("config", () => {
  it("has the baked-in API keys", () => {
    expect(config.apiKeys.has("dev-key-123")).toBe(true);
    expect(config.apiKeys.has("broker-4821-key")).toBe(true);
    expect(config.apiKeys.has("nope")).toBe(false);
  });

  it("has the baked-in broker id", () => {
    expect(config.dataBrokerId).toBe("4821");
  });

  it("defaults the file date to an 8-digit YYYYMMDD", () => {
    expect(config.fileDate).toMatch(/^\d{8}$/);
  });
});
