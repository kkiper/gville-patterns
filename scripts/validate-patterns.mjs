// Validate data/patterns.json against the record schema and section list.
import { readFileSync } from 'node:fs';
import { validateRecord } from '../js/lib/patterns.js';

const records = JSON.parse(readFileSync('data/patterns.json', 'utf8'));
const ids = new Set(JSON.parse(readFileSync('data/sections.json', 'utf8')).map((s) => s.id));
let bad = 0;
const seen = new Set();
for (const r of records) {
  const errs = validateRecord(r, ids);
  if (seen.has(r.id)) errs.push('duplicate id');
  seen.add(r.id);
  if (errs.length) { bad++; console.error(`${r.id || '(no id)'}: ${errs.join('; ')}`); }
}
console.log(`${records.length} records, ${bad} with errors`);
process.exit(bad ? 1 : 0);
