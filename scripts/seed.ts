/** Seed the source personal-info CSV. Run with: npm run seed */

import { config } from "../src/lib/config";
import { PEOPLE, seed } from "../src/lib/seed";

seed();
console.log(`Wrote ${config.personalCsv} (${PEOPLE.personas.length} records)`);
