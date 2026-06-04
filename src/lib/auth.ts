/** X-API-KEY header authentication. */

import { config } from "./config";

/**
 * Returns a 401 Response when the key is missing or invalid, else null.
 * Mirrors the spec: 401 on a missing OR unrecognized key.
 */
export function requireApiKey(req: Request): Response | null {
  const key = req.headers.get("x-api-key");
  if (!key || !config.apiKeys.has(key)) {
    return Response.json({ detail: "API key is missing or invalid." }, { status: 401 });
  }
  return null;
}
