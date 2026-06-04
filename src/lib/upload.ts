/** Upload / amend CSV validation and response shaping. */

import { parseCsv } from "./csv";
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

/** Return an error message if the CSV is invalid, else null. */
export function validateCsv(raw: Uint8Array): string | null {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    return "Could not decode file as UTF-8 text.";
  }
  // Strip a leading UTF-8 BOM (utf-8-sig parity).
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = parseCsv(text);
  if (rows.length === 0) {
    return "Empty file.";
  }

  const header = rows[0].map((c) => c.trim());
  if (!(header.length === 2 && header[0] === "Id" && header[1] === "Status")) {
    return "Invalid CSV header. Expected: Id,Status";
  }

  for (let i = 1; i < rows.length; i++) {
    const lineNo = i + 1;
    const row = rows[i];
    if (row.length === 0 || row.every((c) => c.trim() === "")) {
      continue;
    }
    if (row.length !== 2) {
      return `Row ${lineNo}: expected 2 columns (Id,Status).`;
    }
    if (!isInteger(row[0])) {
      return `Row ${lineNo}: Id must be an integer.`;
    }
    if (!isInteger(row[1])) {
      return `Row ${lineNo}: Status must be an integer.`;
    }
    const status = parseInt(row[1], 10);
    if (!VALID_STATUS.has(status)) {
      return `Row ${lineNo}: invalid status ${status} (expected 2, 3, 4, or 5).`;
    }
  }
  return null;
}

// Match Python int(): optional sign, digits, surrounding whitespace allowed.
function isInteger(value: string): boolean {
  return /^[+-]?\d+$/.test(value.trim());
}

export async function processUpload(
  files: File[],
  mode: "new" | "amend",
): Promise<UploadResponse> {
  const accepted: FileResult[] = [];
  const rejected: FileResult[] = [];
  const seen = new Set<string>();
  const label = mode === "amend" ? "AMEND" : "NEW";

  for (const f of files) {
    const name = f.name || "unnamed.csv";

    if (seen.has(name)) {
      rejected.push({
        fileName: name,
        message: "You already uploaded a file with the same filename for this run.",
      });
      continue;
    }
    seen.add(name);

    if (!name.toLowerCase().endsWith(".csv")) {
      rejected.push({
        fileName: name,
        message: "Be uploaded as a CSV file, not a ZIP archive.",
      });
      continue;
    }

    const error = validateCsv(new Uint8Array(await f.arrayBuffer()));
    if (error) {
      rejected.push({ fileName: name, message: error });
    } else {
      accepted.push({
        fileName: name,
        message: `Accepted. ${label} file queued for processing.`,
      });
    }
  }

  return {
    mode,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    accepted,
    rejected,
  };
}
