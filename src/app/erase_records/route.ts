import { eraseRecords } from "@/lib/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unauthenticated dev helper: drop all previously uploaded data (audit log,
 * history, current state). No-op when DATABASE_URL is unset.
 */
export async function GET(): Promise<Response> {
  try {
    const erased = await eraseRecords();
    const body = erased
      ? "<p class='yes'>Erased all records.</p>"
      : "<p class='muted'>No database configured — nothing to erase.</p>";
    return new Response(
      "<!doctype html><html><head><meta charset='utf-8'><title>Erase records</title>" +
        "<style>body{font-family:system-ui,sans-serif;margin:2rem}" +
        ".muted{color:#777}.yes{color:#070}</style></head><body>" +
        `<h1>Erase records</h1>${body}<p><a href='/records'>Back to records</a></p>` +
        "</body></html>",
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  } catch (e) {
    return Response.json(
      { detail: `Could not erase records: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
