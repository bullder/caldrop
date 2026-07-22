/**
 * Opt-in edge-case behaviors selected by X-API-KEY, for exercising the DROP
 * client's batch-lifecycle (spec v1.2) error handling that the emulator's
 * default happy-path keys can't produce: no-data / batch-incomplete /
 * still-building / malformed-body download responses, and duplicate-filename
 * / persistent-rejection upload responses.
 *
 * Not a security boundary — dev/test only, alongside the equally-baked-in
 * happy-path keys in auth.ts.
 */

export type DownloadBehavior = "no_data" | "batch_incomplete" | "building" | "malformed";
export type UploadBehavior = "duplicate_once" | "reject_always";

interface EdgeCaseKey {
  download?: DownloadBehavior;
  upload?: UploadBehavior;
}

const EDGE_CASE_KEYS: Record<string, EdgeCaseKey> = {
  // GET /data/download -> 200, {"message": "..."} JSON body (no ZIP).
  // Client: DropNoDataError -- a healthy no-op, not a failure.
  "edge-nodata-key": { download: "no_data" },
  // GET /data/download -> 409. Client: DropBatchIncompleteError -- the
  // previous download's response CSV(s) haven't been fully uploaded yet.
  "edge-batch-incomplete-key": { download: "batch_incomplete" },
  // GET /data/download -> 202 + Retry-After, every time (archive never
  // finishes building). Client: exhausts MAX_202_POLLS -> DropTransientError.
  "edge-building-key": { download: "building" },
  // GET /data/download -> 200, non-ZIP body that isn't a valid {"message"}
  // shape either. Client: can't parse it as no-data -> DropFatalError.
  "edge-malformed-key": { download: "malformed" },
  // POST /data/upload -> rejects the first call for a given filename
  // ("same filename" message, matching the real spec's duplicate-filename
  // wording), accepts a retry of the *same* filename. Client: Tier-1
  // auto-retry (retry_filename) should turn this into an eventual accept.
  "edge-dup-filename-key": { upload: "duplicate_once" },
  // POST /data/upload -> always rejects with a persistent (non-duplicate)
  // reason. Client: Tier-2/3 -- upload_status="rejected" + operator alert.
  "edge-reject-key": { upload: "reject_always" },
};

export function edgeCaseFor(req: Request): EdgeCaseKey | null {
  const key = req.headers.get("x-api-key");
  if (!key) return null;
  return EDGE_CASE_KEYS[key] ?? null;
}

// Cross-request duplicate-filename state for edge-dup-filename-key: the
// first upload of a given (apiKey, filename) pair rejects; a retry of the
// *same* filename under the *same* key accepts. Module-level Map -- resets
// on server restart, which is fine for a dev-only emulator (mirrors the
// real DROP behavior of "already uploaded for the current download", where
// a fresh process is a fresh "download").
const seenOnce = new Set<string>();

export function shouldRejectAsDuplicate(apiKey: string, fileName: string): boolean {
  const cacheKey = `${apiKey}:${fileName}`;
  if (seenOnce.has(cacheKey)) {
    return false;
  }
  seenOnce.add(cacheKey);
  return true;
}

/** Test-only: clear duplicate-filename state between test cases. */
export function resetEdgeCaseState(): void {
  seenOnce.clear();
}
