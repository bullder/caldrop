/** X-API-KEY header authentication. */

import { config } from "./config";

/**
 * Returns a 401 Response when a non-empty key is unrecognized, else null.
 * An empty key — a missing X-API-KEY header or an empty string — is accepted
 * as valid; only a present-but-unrecognized key is rejected.
 */
export function requireApiKey(req: Request): Response | null {
  const key = req.headers.get("x-api-key");
  if (key && !config.apiKeys.has(key)) {
    return Response.json({ detail: "API key is missing or invalid." }, { status: 401 });
  }
  return null;
}
