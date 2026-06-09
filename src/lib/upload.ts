/** Upload / amend CSV validation and response shaping. */

import { parseCsv } from "./csv";
import type { FileOutcome, ParsedRow } from "./persist";
import { VALID_STATUS } from "./seed";

export interface FileResult {
  fileName: string;
  message: string;
}

export interface UploadResponse {
  mode: string;
  acceptedCount: number;
  rejectedCount: number;
  accepted: FileResult[];
  rejected: FileResult[];
}

/** Result of processing: the client-facing response plus per-file outcomes
 *  (with parsed rows) for persistence. */
export interface ProcessResult {
  response: UploadResponse;
  outcomes: FileOutcome[];
}

/** Parse + validate a CSV. On success returns the data rows; on failure the
 *  error message (rows empty). */
export function parseAndValidate(raw: Uint8Array): { error: string | null; rows: ParsedRow[] } {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    return { error: "Could not decode file as UTF-8 text.", rows: [] };
  }
  // Strip a leading UTF-8 BOM (utf-8-sig parity).
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { error: "Empty file.", rows: [] };
  }

  const header = rows[0].map((c) => c.trim());
  if (!(header.length === 2 && header[0] === "Id" && header[1] === "Status")) {
    return { error: "Invalid CSV header. Expected: Id,Status", rows: [] };
  }

  const parsed: ParsedRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const lineNo = i + 1;
    const row = rows[i];
    if (row.length === 0 || row.every((c) => c.trim() === "")) {
      continue;
    }
    if (row.length !== 2) {
      return { error: `Row ${lineNo}: expected 2 columns (Id,Status).`, rows: [] };
    }
    if (!isInteger(row[0])) {
      return { error: `Row ${lineNo}: Id must be an integer.`, rows: [] };
    }
    if (!isInteger(row[1])) {
      return { error: `Row ${lineNo}: Status must be an integer.`, rows: [] };
    }
    const status = parseInt(row[1], 10);
    if (!VALID_STATUS.has(status)) {
      return { error: `Row ${lineNo}: invalid status ${status} (expected 2, 3, 4, or 5).`, rows: [] };
    }
    parsed.push({ consumerId: parseInt(row[0], 10), status });
  }
  return { error: null, rows: parsed };
}

function isInteger(value: string): boolean {
  return /^[+-]?\d+$/.test(value.trim());
}

export async function processUpload(
  files: File[],
  mode: "new" | "amend",
): Promise<ProcessResult> {
  const accepted: FileResult[] = [];
  const rejected: FileResult[] = [];
  const outcomes: FileOutcome[] = [];
  const seen = new Set<string>();
  const label = mode === "amend" ? "AMEND" : "NEW";

  for (const f of files) {
    const name = f.name || "unnamed.csv";

    if (seen.has(name)) {
      const message = "You already uploaded a file with the same filename for this run.";
      rejected.push({ fileName: name, message });
      outcomes.push({ fileName: name, accepted: false, message, rows: [] });
      continue;
    }
    seen.add(name);

    if (!name.toLowerCase().endsWith(".csv")) {
      const message = "Be uploaded as a CSV file, not a ZIP archive.";
      rejected.push({ fileName: name, message });
      outcomes.push({ fileName: name, accepted: false, message, rows: [] });
      continue;
    }

    const { error, rows } = parseAndValidate(new Uint8Array(await f.arrayBuffer()));
    if (error) {
      rejected.push({ fileName: name, message: error });
      outcomes.push({ fileName: name, accepted: false, message: error, rows: [] });
    } else {
      const message = `Accepted. ${label} file queued for processing.`;
      accepted.push({ fileName: name, message });
      outcomes.push({ fileName: name, accepted: true, message, rows });
    }
  }

  return {
    response: {
      mode,
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
      accepted,
      rejected,
    },
    outcomes,
  };
}
