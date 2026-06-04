import { existsSync } from "node:fs";
import { streamZip } from "@/lib/archive";
import { requireApiKey } from "@/lib/auth";
import { config } from "@/lib/config";
import { LIST_TYPES, parseLists } from "@/lib/lists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request): Response {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;

  // Optional ?lists=NDZ,EMAIL,... selects which CSVs to include (default: all).
  const raw = new URL(req.url).searchParams.get("lists");
  let lists = LIST_TYPES;
  if (raw !== null) {
    try {
      lists = parseLists(raw);
    } catch (e) {
      return Response.json({ detail: (e as Error).message }, { status: 400 });
    }
  }

  if (!existsSync(config.personalCsv)) {
    return Response.json(
      { detail: "Sample data not seeded. Run: npm run seed" },
      { status: 500 },
    );
  }

  // Hash and stream the archive on the fly — no prebuilt file.
  return new Response(streamZip(lists), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="download.zip"',
    },
  });
}
