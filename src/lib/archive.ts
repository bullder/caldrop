/**
 * On-the-fly ZIP streaming of hashed consumer CSVs.
 *
 * Builds the download archive lazily: each list's CSV is hashed row-by-row
 * from the seeded personal data and pushed to the response as it is produced.
 * A fixed entry timestamp keeps the bytes deterministic across calls.
 */

import { Zip, ZipDeflate } from "fflate";
import { LIST_TYPES, type ListType } from "./lists";
import { hashFor } from "./persona";
import { fileName, generatePersona, loadPersonas, makeLcg } from "./seed";

// Fixed mtime so two downloads produce byte-identical archives.
const FIXED_MTIME = new Date("1980-01-01T00:00:00Z");

// Fixed seed for the synthetic (non-matching) personas, so downloads stay
// byte-identical across calls.
const SYNTHETIC_SEED = 424242;

export interface DownloadOpts {
  /** Max matching (real) rows per list. Default: every seeded persona. */
  limit?: number;
  /** Synthetic rows absent from the dataset, per list. Default: 1. */
  missing?: number;
}

/**
 * Build a ZIP archive containing one hashed CSV per requested list
 * (defaults to all list types).
 *
 * Each list CSV holds the matching rows (one per seeded persona, hashed for
 * that list — these exist in the warehouse) followed by `missing` synthetic
 * rows whose Ids run past the seeded range. A row's Id is the persona's 1-based
 * position in personal.csv. `limit` caps the matching rows.
 */
export function streamZip(
  lists: ListType[] = LIST_TYPES,
  opts: DownloadOpts = {},
): ReadableStream<Uint8Array> {
  const personas = loadPersonas();
  const encoder = new TextEncoder();

  const count = personas.personas.length;
  const matchCount = Math.max(0, Math.min(opts.limit ?? count, count));
  const missingCount = Math.max(0, opts.missing ?? 1);

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) {
          controller.error(err);
          return;
        }
        if (chunk.length > 0) controller.enqueue(chunk);
        if (final) controller.close();
      });

      for (const listType of lists) {
        const entry = new ZipDeflate(fileName(listType), { level: 6 });
        // mtime is a settable property (not in the constructor's options type).
        entry.mtime = FIXED_MTIME;
        zip.add(entry);

        let body = "Id,Hash\n";
        // Matching rows: every seeded persona, hashed for this list.
        for (let idx = 0; idx < matchCount; idx++) {
          body += `${idx + 1},${hashFor(personas.personas[idx], listType)}\n`;
        }
        // Missing rows: synthetic personas with Ids beyond the seeded range,
        // shared across lists (seeded deterministically).
        for (let m = 0; m < missingCount; m++) {
          const missingPersona = generatePersona(count + m, makeLcg(SYNTHETIC_SEED + m));
          body += `${count + 1 + m},${hashFor(missingPersona, listType)}\n`;
        }
        entry.push(encoder.encode(body), true);
      }
      zip.end();
    },
  });
}
