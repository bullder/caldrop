/**
 * Shared route-handler logic for the data endpoints. Mounted twice: at the
 * real paths (/data/*) and, for sandbox mode, under the /sandbox prefix
 * (/sandbox/data/*). Behavior is identical — only the URL prefix differs.
 */

import { existsSync } from "node:fs";
import { streamZip } from "./archive";
import { requireApiKey } from "./auth";
import { config } from "./config";
import { LIST_TYPES, parseLists } from "./lists";
import { logRequest, startTimer } from "./logger";
import { persistUpload } from "./persist";
import { processUpload } from "./upload";

export function handleDownload(req: Request): Response {
  const start = startTimer();

  const unauthorized = requireApiKey(req);
  if (unauthorized) {
    logRequest(req, 401, start);
    return unauthorized;
  }

  // Optional ?lists=NDZ,EMAIL,... selects which CSVs to include (default: all).
  const raw = new URL(req.url).searchParams.get("lists");
  let lists = LIST_TYPES;
  if (raw !== null) {
    try {
      lists = parseLists(raw);
    } catch (e) {
      logRequest(req, 400, start);
      return Response.json({ detail: (e as Error).message }, { status: 400 });
    }
  }

  if (!existsSync(config.personalCsv)) {
    logRequest(req, 500, start, "not-seeded");
    return Response.json(
      { detail: "Sample data not seeded. Run: npm run seed" },
      { status: 500 },
    );
  }

  // Hash and stream the archive on the fly — no prebuilt file.
  logRequest(req, 200, start, `lists=${lists.length}`);
  return new Response(streamZip(lists), {
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
