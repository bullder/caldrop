/** Seed the source personal-info CSV. Run with: npm run seed */

import { config } from "../src/lib/config";
import { listsDir, seed } from "../src/lib/seed";

const count = seed();
console.log(`Wrote ${config.personalCsv} (${count} records)`);
console.log(`Prerendered hashed lists in ${listsDir()}`);
