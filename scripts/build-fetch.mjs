// Compute open-water fetch for each section in 16 wind-FROM directions.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fetchMiles, polygonsFromGeoJSON } from '../js/lib/fetch-calc.js';

const OUTLINE = 'data/lake-outline.geojson';
const OUT = 'data/section-fetch.json';

if (!existsSync(OUTLINE)) {
  console.log(`build-fetch: ${OUTLINE} missing, skipping`);
} else {
  const polys = polygonsFromGeoJSON(JSON.parse(readFileSync(OUTLINE, 'utf8')));
  const sections = JSON.parse(readFileSync('data/sections.json', 'utf8'));
  const fetch = {};
  for (const s of sections) {
    fetch[s.id] = Array.from({ length: 16 }, (_, i) => Math.round(fetchMiles(s.center, i * 22.5, polys) * 100) / 100);
  }
  writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), fetch }, null, 1));
  const onLand = sections.filter((s) => fetch[s.id].every((v) => v === 0)).map((s) => s.id);
  console.log(`Wrote ${OUT}${onLand.length ? `; centers on land (fix in sections.json): ${onLand.join(', ')}` : ''}`);
}
