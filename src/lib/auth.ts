/** X-API-KEY header authentication. */

export function requireApiKey(req: Request): Response | null {
  const key = req.headers.get("x-api-key");
  if (key === "INVALID-KEY") {
    return Response.json({ detail: "API key is missing or invalid." }, { status: 401 });
  }
  return null;
}
