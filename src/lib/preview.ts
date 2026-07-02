/** Render the seeded personal data (with derived hashes) as a standalone HTML page. */

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { config } from "./config";
import { parseLine } from "./csv";
import { LIST_TYPES } from "./lists";
import {
  csvFieldnames,
  hashFor,
  type Persona,
  PERSONAL_FIELDS,
  personaValues,
} from "./persona";

// Cap the rows rendered: the preview is a dev eyeball tool, and materializing
// the full 300k-row table as one HTML string would exhaust memory.
const PREVIEW_LIMIT = 1000;

/** Escape per Python's html.escape(quote=True): & < > " '. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

interface PreviewRow {
  id: string;
  persona: Persona;
}

/** Stream up to PREVIEW_LIMIT data rows from personal.csv without loading it whole. */
async function readLimited(): Promise<{ rows: PreviewRow[]; truncated: boolean }> {
  const rl = createInterface({
    input: createReadStream(config.personalCsv),
    crlfDelay: Infinity,
  });
  const rows: PreviewRow[] = [];
  const index: Record<string, number> = {};
  let haveHeader = false;
  let truncated = false;

  for await (const line of rl) {
    if (!haveHeader) {
      if (line === "") continue;
      parseLine(line).forEach((name, i) => (index[name] = i));
      haveHeader = true;
      continue;
    }
    if (line === "") continue;
    if (rows.length >= PREVIEW_LIMIT) {
      truncated = true;
      break;
    }
    const fields = parseLine(line);
    if (fields.length <= 1) continue;
    const persona = {} as Persona;
    for (const name of PERSONAL_FIELDS) persona[name] = fields[index[name]] ?? "";
    rows.push({ id: fields[index.Id] ?? "", persona });
  }
  rl.close();
  return { rows, truncated };
}

/** Render CSV rows (first row = header) as a standalone HTML table. */
function renderTable(rows: string[][], truncated: boolean): string {
  let body: string;
  if (rows.length === 0) {
    body = "<p>No data.</p>";
  } else {
    const [header, ...data] = rows;
    const head = header.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
    const cells = data
      .map(
        (row) =>
          "<tr>" + row.map((c) => `<td>${escapeHtml(c)}</td>`).join("") + "</tr>",
      )
      .join("");
    const note = truncated
      ? `<p>Showing the first ${data.length} rows.</p>`
      : `<p>${data.length} records</p>`;
    body =
      `<table><thead><tr>${head}</tr></thead>` +
      `<tbody>${cells}</tbody></table>${note}`;
  }
  return (
    "<!doctype html><html><head><meta charset='utf-8'>" +
    "<title>personal.csv</title><style>" +
    "body{font-family:system-ui,sans-serif;margin:2rem}" +
    "table{border-collapse:collapse}" +
    "th,td{border:1px solid #ccc;padding:4px 8px;text-align:left}" +
    "th{background:#f4f4f4}tr:nth-child(even){background:#fafafa}" +
    "</style></head><body><h1>personal.csv</h1>" +
    `${body}</body></html>`
  );
}

/**
 * Build the dev-only preview HTML: each person's raw fields alongside the
 * derived hash for all six list types. Capped at PREVIEW_LIMIT rows.
 */
export async function renderPreview(): Promise<string> {
  const { rows, truncated } = await readLimited();
  const table: string[][] = [];
  if (rows.length > 0) {
    table.push([...csvFieldnames(), ...LIST_TYPES.map((t) => t.valueOf())]);
    for (const { id, persona } of rows) {
      table.push([
        String(id),
        ...personaValues(persona),
        ...LIST_TYPES.map((t) => hashFor(persona, t)),
      ]);
    }
  }
  return renderTable(table, truncated);
}
