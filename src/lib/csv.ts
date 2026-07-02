/**
 * Minimal RFC-4180 CSV read/write, matching Python's `csv` module behavior
 * closely enough for the personal-data round trip and upload validation:
 *   - Fields are quoted only when they contain a comma, quote, CR or LF.
 *   - Leading/trailing spaces are preserved (never trimmed, never quoted).
 *   - A truly empty physical line parses to an empty row (`[]`).
 *   - A single trailing newline does not produce an extra row.
 */

export function parseCsv(text: string): string[][] {
  const lines = text.split(/\r\n|\r|\n/);
  // Drop the empty element produced by a trailing newline (but keep interior blanks).
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines.map(parseLine);
}

export function parseLine(line: string): string[] {
  if (line === "") return [];
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

function quoteField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function stringifyRow(fields: (string | number)[]): string {
  return fields.map((f) => quoteField(String(f))).join(",");
}
