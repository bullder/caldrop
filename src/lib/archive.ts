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
import { fileName, loadPersonas } from "./seed";

// Fixed mtime so two downloads produce byte-identical archives.
const FIXED_MTIME = new Date("1980-01-01T00:00:00Z");


/**
 * Build a ZIP archive containing one hashed CSV per requested list
 * (defaults to all list types).
 *
 * Each row's Id is the 1-based position of the persona in personal.csv,
 * so the same record always gets the same Id across all list files and downloads.
 */
export function streamZip(lists: ListType[] = LIST_TYPES): ReadableStream<Uint8Array> {
  const personas = loadPersonas();
  const encoder = new TextEncoder();

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
        personas.personas.forEach((persona, i) => {
          body += `${i + 1},${hashFor(persona, listType)}\n`;
        });
        entry.push(encoder.encode(body), true);
      }
      zip.end();
    },
  });
}
