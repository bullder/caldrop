/** Render the seeded personal data (with derived hashes) as a standalone HTML page. */

import { LIST_TYPES } from "./lists";
import { csvFieldnames, hashFor, numbered, personaValues } from "./persona";
import { loadPersonas } from "./seed";

/** Escape per Python's html.escape(quote=True): & < > " '. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Render CSV rows (first row = header) as a standalone HTML table. */
function renderTable(rows: string[][]): string {
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
    body =
      `<table><thead><tr>${head}</tr></thead>` +
      `<tbody>${cells}</tbody></table>` +
      `<p>${data.length} records</p>`;
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
 * derived hash for all six list types.
 */
export function renderPreview(): string {
  const personas = loadPersonas();
  const rows: string[][] = [];
  if (personas.personas.length > 0) {
    rows.push([...csvFieldnames(), ...LIST_TYPES.map((t) => t.valueOf())]);
    for (const [recordId, persona] of numbered(personas)) {
      rows.push([
        String(recordId),
        ...personaValues(persona),
        ...LIST_TYPES.map((t) => hashFor(persona, t)),
      ]);
    }
  }
  return renderTable(rows);
}
