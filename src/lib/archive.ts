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

// Deterministic seeds: a stable pick of the matching persona and a fixed
// synthetic persona, so downloads stay byte-identical across calls.
const PICK_SEED = 2026;
const SYNTHETIC_SEED = 424242;


/**
 * Build a ZIP archive containing one hashed CSV per requested list
 * (defaults to all list types).
 *
 * Each list CSV is limited to two rows: one record that matches personal.csv
 * (a real persona) and one synthetic record absent from the dataset (Id beyond
 * the seeded range). The matching row's Id is the persona's 1-based position in
 * personal.csv, so the same record keeps the same Id across all list files and
 * downloads.
 */
export function streamZip(lists: ListType[] = LIST_TYPES): ReadableStream<Uint8Array> {
  const personas = loadPersonas();
  const encoder = new TextEncoder();

  // One matching record: a deterministically-picked persona from personal.csv.
  const count = personas.personas.length;
  const matchIdx = Math.floor(makeLcg(PICK_SEED)() * count);
  const matchPersona = personas.personas[matchIdx];
  const matchId = matchIdx + 1; // 1-based position in personal.csv

  // One missing record: a synthetic persona not present in personal.csv,
  // with an Id beyond the seeded range.
  const missingPersona = generatePersona(count, makeLcg(SYNTHETIC_SEED));
  const missingId = count + 1;

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
        body += `${matchId},${hashFor(matchPersona, listType)}\n`;
        body += `${missingId},${hashFor(missingPersona, listType)}\n`;
        entry.push(encoder.encode(body), true);
      }
      zip.end();
    },
  });
}
