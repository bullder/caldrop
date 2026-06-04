import { existsSync } from "node:fs";
import { config } from "@/lib/config";
import { renderPreview } from "@/lib/preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dev-only, unauthenticated view of the seeded personal data. Shows each
 * person's raw fields alongside the derived hash for all six list types,
 * so you can eyeball what the download endpoint produces.
 */
export function GET(): Response {
  if (!existsSync(config.personalCsv)) {
    return Response.json(
      { detail: "Sample data not seeded. Run: npm run seed" },
      { status: 500 },
    );
  }
  return new Response(renderPreview(), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
