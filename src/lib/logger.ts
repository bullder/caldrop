/** Lightweight request logging for the API handlers. */

/**
 * Emit a one-line access log entry:
 *   [caldrop] 2026-06-04T12:00:00.000Z GET /data/download -> 200 (3.2ms) lists=6
 */
export function logRequest(
  req: Request,
  status: number,
  startMs: number,
  note?: string,
): void {
  const { pathname, search } = new URL(req.url);
  const ms = (performance.now() - startMs).toFixed(1);
  const hasKey = req.headers.get("x-api-key") ? "key" : "no-key";
  const suffix = note ? ` ${note}` : "";
  console.log(
    `[caldrop] ${new Date().toISOString()} ${req.method} ${pathname}${search} ` +
      `-> ${status} (${ms}ms) ${hasKey}${suffix}`,
  );
}

/** Marks the start of a request; pair with logRequest. */
export function startTimer(): number {
  return performance.now();
}
