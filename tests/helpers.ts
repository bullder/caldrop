import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { config } from "@/lib/config";
import { seed } from "@/lib/seed";

export const API_KEY = "dev-key-123";

/** Point config at a fresh temp dir, pin the file date, and seed it. */
export function seedTemp(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "caldrop-"));
  config.dataDir = dir;
  config.personalCsv = path.join(dir, "personal.csv");
  config.fileDate = "20260312";
  seed();
  return dir;
}

export function authHeaders(key: string = API_KEY): Record<string, string> {
  return { "X-API-KEY": key };
}

export function csvUpload(name: string, body: string): FormData {
  const fd = new FormData();
  fd.append("files", new File([body], name, { type: "text/csv" }));
  return fd;
}
