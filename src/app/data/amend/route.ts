import { requireApiKey } from "@/lib/auth";
import { processUpload } from "@/lib/upload";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  return Response.json(await processUpload(files, "amend"));
}
