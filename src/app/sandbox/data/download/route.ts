import { handleDownload } from "@/lib/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request): Response {
  return handleDownload(req);
}
