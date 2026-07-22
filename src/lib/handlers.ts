/**
 * Shared route-handler logic for the data endpoints. Mounted twice: at the
 * real paths (/data/*) and, for sandbox mode, under the /sandbox prefix
 * (/sandbox/data/*). Behavior is identical — only the URL prefix differs.
 */

import { existsSync } from "node:fs";
import { type DownloadOpts, streamZip } from "./archive";
import { requireApiKey } from "./auth";
import { config } from "./config";
import { LIST_TYPES, ListType, parseLists } from "./lists";
import { logRequest, startTimer } from "./logger";
import { persistUpload } from "./persist";
import { listFilePath } from "./seed";
import { edgeCaseFor, shouldRejectAsDuplicate } from "./testBehaviors";
import { processUpload, type UploadResponse } from "./upload";

/** Edge-case download responses selected by X-API-KEY (see testBehaviors.ts). */
function edgeCaseDownloadResponse(
  behavior: NonNullable<ReturnType<typeof edgeCaseFor>>["download"],
): Response | null {
  switch (behavior) {
    case "no_data":
      return Response.json({ message: "No new data available for this download." });
    case "batch_incomplete":
      return Response.json(
        { message: "Previous download's response CSV(s) not fully uploaded yet." },
        { status: 409 },
      );
    case "building":
      return Response.json(
        { message: "Archive is still building." },
        { status: 202, headers: { "Retry-After": "1" } },
      );
    case "malformed":
      // Not a valid {"message": "..."} shape -- the client can't parse this
      // as a healthy no-op, so it must treat it as fatal.
      return Response.json({ unexpected: "shape" });
    default:
      return null;
  }
}

/** Parse a non-negative integer query param; undefined when absent. */
function parseCount(raw: string | null, name: string): number | undefined {
  if (raw === null) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid '${name}': expected a non-negative integer, got '${raw}'`);
  }
  return n;
}

export function handleDownload(req: Request): Response {
  const start = startTimer();

  const unauthorized = requireApiKey(req);
  if (unauthorized) {
    logRequest(req, 401, start);
    return unauthorized;
  }

  const edge = edgeCaseFor(req)?.download;
  if (edge) {
    const res = edgeCaseDownloadResponse(edge);
    if (res) {
      logRequest(req, res.status, start, `edge=${edge}`);
      return res;
    }
  }

  // Optional ?lists=NDZ,EMAIL,... selects which CSVs to include (default: all).
  const params = new URL(req.url).searchParams;
  let lists = LIST_TYPES;
  const raw = params.get("lists");
  if (raw !== null) {
    try {
      lists = parseLists(raw);
    } catch (e) {
      logRequest(req, 400, start);
      return Response.json({ detail: (e as Error).message }, { status: 400 });
    }
  }

  // Optional ?limit= caps matching rows per list; ?missing= sets synthetic rows.
  let opts: DownloadOpts;
  try {
    opts = {
      limit: parseCount(params.get("limit"), "limit"),
      // Default 0: the amend-CSV seed (npm run seed:amend) delivers exactly the
      // seeded real records with no synthetic non-matching rows. ?missing=N adds them.
      missing: parseCount(params.get("missing"), "missing") ?? 0,
    };
  } catch (e) {
    logRequest(req, 400, start);
    return Response.json({ detail: (e as Error).message }, { status: 400 });
  }

  // The download streams the prerendered per-list CSVs, so gate on those (the
  // amend-CSV seed writes the lists but not personal.csv).
  if (!existsSync(listFilePath(ListType.EMAIL))) {
    logRequest(req, 500, start, "not-seeded");
    return Response.json(
      { detail: "Sample data not seeded. Run: npm run seed:amend (or npm run seed)" },
      { status: 500 },
    );
  }

  // Hash and stream the archive on the fly — no prebuilt file.
  logRequest(req, 200, start, `lists=${lists.length}`);
  return new Response(streamZip(lists, opts), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="download.zip"',
    },
  });
}

export async function handleUpload(
  req: Request,
  mode: "new" | "amend",
): Promise<Response> {
  const start = startTimer();

  const unauthorized = requireApiKey(req);
  if (unauthorized) {
    logRequest(req, 401, start);
    return unauthorized;
  }

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  const edge = edgeCaseFor(req)?.upload;
  const apiKey = req.headers.get("x-api-key") ?? "";
  const name = files[0]?.name || "unnamed.csv";

  if (edge === "reject_always") {
    const message = "Rejected: this key always rejects (edge-reject-key).";
    const response: UploadResponse = {
      mode,
      acceptedCount: 0,
      rejectedCount: 1,
      accepted: [],
      rejected: [{ fileName: name, message }],
    };
    logRequest(req, 200, start, `mode=${mode} edge=reject_always rejected=1`);
    return Response.json(response);
  }

  if (edge === "duplicate_once" && shouldRejectAsDuplicate(apiKey, name)) {
    const message = "You already uploaded a file with the same filename for this run.";
    const response: UploadResponse = {
      mode,
      acceptedCount: 0,
      rejectedCount: 1,
      accepted: [],
      rejected: [{ fileName: name, message }],
    };
    logRequest(req, 200, start, `mode=${mode} edge=duplicate_once rejected=1`);
    return Response.json(response);
  }

  const { response, outcomes } = await processUpload(files, mode);

  // Record to Postgres when DATABASE_URL is set (no-op otherwise). Persistence
  // failure must not break the emulator's response — log and carry on.
  const sandbox = new URL(req.url).pathname.startsWith("/sandbox");
  let persisted = false;
  try {
    persisted = await persistUpload(
      { mode, brokerId: config.dataBrokerId, sandbox },
      outcomes,
    );
  } catch (e) {
    console.error("[caldrop] persist failed:", (e as Error).message);
  }

  logRequest(
    req,
    200,
    start,
    `mode=${mode} accepted=${response.acceptedCount} rejected=${response.rejectedCount}` +
      (persisted ? " persisted" : ""),
  );
  return Response.json(response);
}
