import { handleUpload } from "@/lib/handlers";

export const runtime = "nodejs";

export function POST(req: Request): Promise<Response> {
  return handleUpload(req, "amend");
}
