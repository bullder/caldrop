/**
 * On-the-fly ZIP streaming of the prerendered hashed consumer CSVs.
 *
 * The hashed lists are prerendered to disk at seed/build time (see
 * `writeLists` in seed.ts), so a download only streams those bytes into the
 * archive — no persona parsing or hashing per request. Memory stays flat
 * regardless of dataset size (300k rows and beyond). A fixed entry timestamp
 * keeps the bytes deterministic across calls.
 */

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { Zip, ZipDeflate } from "fflate";
import { LIST_TYPES, type ListType } from "./lists";
import { hashFor } from "./persona";
import {
  fileName,
  generatePersona,
  listFilePath,
  makeLcg,
  seededCount,
} from "./seed";

// Fixed mtime so two downloads produce byte-identical archives.
const FIXED_MTIME = new Date("1980-01-01T00:00:00Z");

// Fixed seed for the synthetic (non-matching) personas, so downloads stay
// byte-identical across calls.
const SYNTHETIC_SEED = 424242;

// Flush the row buffer to the deflater once it reaches this size (limit path).
const FLUSH_BYTES = 1 << 16;

export interface DownloadOpts {
  /** Max matching (real) rows per list. Default: every seeded persona. */
  limit?: number;
  /** Synthetic rows absent from the dataset, per list. Default: 1. */
  missing?: number;
}

/**
 * Stream the prerendered CSV for `listType` into `entry`. Pushes are marked
 * non-final; the caller appends the synthetic rows and closes the entry.
 *
 * Without a limit, the file (header + every row) is piped chunk-by-chunk.
 * With a limit, the file is read line-by-line and truncated to `limit` rows.
 */
async function pushMatchingRows(
  entry: ZipDeflate,
  listType: ListType,
  limit: number | undefined,
  encoder: TextEncoder,
): Promise<void> {
  const file = listFilePath(listType);

  if (limit === undefined) {
    await new Promise<void>((resolve, reject) => {
      const rs = createReadStream(file);
      rs.on("data", (c) => {
        const buf = c as Buffer;
        entry.push(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength), false);
      });
      rs.on("error", reject);
      rs.on("end", () => resolve());
    });
    return;
  }

  // Limited: emit the header (first line) plus the first `limit` data rows.
  const rl = createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  });
  let seen = -1; // -1 = header not yet read
  let buf = "";
  for await (const line of rl) {
    if (seen === -1) {
      buf += `${line}\n`;
      seen = 0;
      continue;
    }
    if (seen >= limit) break;
    buf += `${line}\n`;
    seen++;
    if (buf.length >= FLUSH_BYTES) {
      entry.push(encoder.encode(buf), false);
      buf = "";
    }
  }
  rl.close();
  if (buf) entry.push(encoder.encode(buf), false);
}

/**
 * Build a ZIP archive containing one hashed CSV per requested list
 * (defaults to all list types).
 *
 * Each list CSV holds the matching rows (one per seeded persona, streamed from
 * the prerendered file) followed by `missing` synthetic rows whose Ids run past
 * the seeded range. `limit` caps the matching rows.
 */
export function streamZip(
  lists: ListType[] = LIST_TYPES,
  opts: DownloadOpts = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const count = seededCount();
  const missingCount = Math.max(0, opts.missing ?? 1);
  const limit =
    opts.limit === undefined ? undefined : Math.max(0, Math.min(opts.limit, count));

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) {
          controller.error(err);
          return;
        }
        if (chunk.length > 0) controller.enqueue(chunk);
        if (final) controller.close();
      });

      try {
        for (const listType of lists) {
          const entry = new ZipDeflate(fileName(listType), { level: 6 });
          // mtime is a settable property (not in the constructor's options type).
          entry.mtime = FIXED_MTIME;
          zip.add(entry);

          await pushMatchingRows(entry, listType, limit, encoder);

          // Missing rows: synthetic personas with Ids beyond the seeded range,
          // shared across lists (seeded deterministically). This final push
          // closes the entry.
          let tail = "";
          for (let m = 0; m < missingCount; m++) {
            const missingPersona = generatePersona(count + m, makeLcg(SYNTHETIC_SEED + m));
            tail += `${count + 1 + m},${hashFor(missingPersona, listType)}\n`;
          }
          entry.push(encoder.encode(tail), true);
        }
        zip.end();
      } catch (e) {
        controller.error(e as Error);
      }
    },
  });
}
