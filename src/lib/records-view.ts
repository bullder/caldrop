/** Render the persisted upload data (records + audit log) as a standalone HTML page. */

import { ensureSchema, getSql } from "./db";

/** Escape per Python's html.escape(quote=True): & < > " '. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// Spec StatusCode labels (see README).
const STATUS_LABEL: Record<number, string> = {
  2: "exempt",
  3: "deleted",
  4: "opted out",
  5: "not found",
};

interface RecordRow {
  consumer_id: number;
  status: number;
  source_file: string;
  mode: string;
  sandbox: boolean;
  updated_at: string;
}

interface UploadRow {
  id: number;
  created_at: string;
  mode: string;
  file_name: string;
  sandbox: boolean;
  accepted: boolean;
  row_count: number;
  message: string;
}

function page(title: string, body: string): string {
  return (
    "<!doctype html><html><head><meta charset='utf-8'>" +
    `<title>${escapeHtml(title)}</title><style>` +
    "body{font-family:system-ui,sans-serif;margin:2rem}" +
    "h1{margin-bottom:.25rem}h2{margin-top:2rem}" +
    "table{border-collapse:collapse;margin-top:.5rem}" +
    "th,td{border:1px solid #ccc;padding:4px 8px;text-align:left}" +
    "th{background:#f4f4f4}tr:nth-child(even){background:#fafafa}" +
    ".muted{color:#777}.no{color:#b00}.yes{color:#070}" +
    "</style></head><body>" +
    `<h1>${escapeHtml(title)}</h1>${body}</body></html>`
  );
}

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return "<p class='muted'>No rows.</p>";
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const cells = rows
    .map((r) => "<tr>" + r.join("") + "</tr>")
    .join("");
  return (
    `<table><thead><tr>${head}</tr></thead><tbody>${cells}</tbody></table>` +
    `<p class='muted'>${rows.length} rows</p>`
  );
}

function td(value: string): string {
  return `<td>${escapeHtml(value)}</td>`;
}

function boolCell(v: boolean): string {
  return v ? "<td class='yes'>yes</td>" : "<td class='no'>no</td>";
}

function statusCell(status: number): string {
  const label = STATUS_LABEL[status] ?? "?";
  return `<td>${status} <span class='muted'>(${escapeHtml(label)})</span></td>`;
}

/** Build the records view; returns HTML and an HTTP status. */
export async function renderRecords(): Promise<{ html: string; status: number }> {
  const sql = getSql();
  if (!sql) {
    return {
      status: 200,
      html: page(
        "Records",
        "<p class='muted'>No database configured. Set <code>DATABASE_URL</code> " +
          "(Neon) to persist and view uploaded records.</p>",
      ),
    };
  }

  await ensureSchema(sql);

  const records = (await sql(
    `SELECT consumer_id, status, source_file, mode, sandbox, updated_at
     FROM records ORDER BY updated_at DESC LIMIT 500`,
  )) as RecordRow[];

  const uploads = (await sql(
    `SELECT id, created_at, mode, file_name, sandbox, accepted, row_count, message
     FROM uploads ORDER BY id DESC LIMIT 200`,
  )) as UploadRow[];

  const recordsTable = table(
    ["Consumer Id", "Status", "Source file", "Mode", "Sandbox", "Updated"],
    records.map((r) => [
      td(String(r.consumer_id)),
      statusCell(r.status),
      td(r.source_file),
      td(r.mode),
      boolCell(r.sandbox),
      td(new Date(r.updated_at).toISOString()),
    ]),
  );

  const uploadsTable = table(
    ["#", "When", "Mode", "File", "Sandbox", "Accepted", "Rows", "Message"],
    uploads.map((u) => [
      td(String(u.id)),
      td(new Date(u.created_at).toISOString()),
      td(u.mode),
      td(u.file_name),
      boolCell(u.sandbox),
      boolCell(u.accepted),
      td(String(u.row_count)),
      td(u.message),
    ]),
  );

  return {
    status: 200,
    html: page(
      "Records",
      "<p class='muted'>Current consumer state (upserted) and the upload audit log.</p>" +
        "<h2>Records — current state</h2>" +
        recordsTable +
        "<h2>Uploads — audit log</h2>" +
        uploadsTable,
    ),
  };
}
