import { renderRecords } from "@/lib/records-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unauthenticated HTML view of persisted uploads: current consumer state
 * (the `records` table) plus the upload audit log (`uploads`). Empty / a
 * notice when DATABASE_URL is unset.
 */
export async function GET(): Promise<Response> {
  try {
    const { html, status } = await renderRecords();
    return new Response(html, {
      status,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    return Response.json(
      { detail: `Could not read records: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
