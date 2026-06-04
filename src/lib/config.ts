/**
 * Static runtime config. No environment variables — the broker id and API
 * keys are baked in; the download archive's list selection is a per-request
 * query param (see the /data/download route).
 *
 * `dataDir` / `personalCsv` / `fileDate` stay mutable so tests can repoint
 * them at a temp dir and pin a deterministic date.
 */

import path from "node:path";

function todayYyyymmdd(): string {
  const now = new Date();
  const y = now.getFullYear().toString().padStart(4, "0");
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  return `${y}${m}${d}`;
}

const BASE_DIR = process.cwd();
const DATA_DIR = path.join(BASE_DIR, "data");

export interface Config {
  /** Valid API keys for X-API-KEY auth. */
  apiKeys: Set<string>;
  /** Embedded in CSV file names: <YYYYMMDD>_<DataBrokerId>_<DataType>.csv */
  dataBrokerId: string;
  /** Defaults to today (YYYYMMDD); tests pin it for deterministic file names. */
  fileDate: string;
  dataDir: string;
  personalCsv: string;
}

export const config: Config = {
  apiKeys: new Set(["dev-key-123", "broker-4821-key"]),
  dataBrokerId: "4821",
  fileDate: todayYyyymmdd(),
  dataDir: DATA_DIR,
  personalCsv: path.join(DATA_DIR, "personal.csv"),
};
