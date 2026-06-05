import { renderUpload } from "@/lib/records-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unauthenticated HTML detail view of one upload attempt: its audit row plus
 * every submitted (Id, Status) row. 404 when the id is unknown.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const uploadId = Number(id);
  if (!Number.isInteger(uploadId) || uploadId < 1) {
    return Response.json({ detail: `Invalid upload id: ${id}` }, { status: 400 });
  }
  try {
    const { html, status } = await renderUpload(uploadId);
    return new Response(html, {
      status,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    return Response.json(
      { detail: `Could not read upload: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
