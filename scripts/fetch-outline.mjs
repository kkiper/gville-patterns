// Fetch Guntersville Lake water polygons from OpenStreetMap (Overpass) once.
// Writes data/lake-outline.geojson. Skips if the file exists unless --force.
import { existsSync, writeFileSync } from 'node:fs';
import { stitchWays } from './lib/osm.mjs';

const OUT = 'data/lake-outline.geojson';
const BBOX = '34.25,-86.45,34.95,-85.65'; // s,w,n,e around the reservoir
const QUERY = `[out:json][timeout:120];
(
  relation["natural"="water"](${BBOX});
  way["natural"="water"](${BBOX});
  relation["waterway"="riverbank"](${BBOX});
  way["waterway"="riverbank"](${BBOX});
);
out geom;`;

const MIN_RING_POINTS = 20; // ignore tiny ponds

export function toPolygons(elements) {
  const polys = [];
  for (const el of elements) {
    if (el.type === 'way' && el.geometry) {
      const ring = el.geometry.map((p) => [p.lon, p.lat]);
      if (ring.length >= MIN_RING_POINTS && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]) polys.push([ring]);
    } else if (el.type === 'relation' && el.members) {
      const seg = (role) => el.members.filter((m) => m.type === 'way' && m.role === role && m.geometry).map((m) => m.geometry.map((p) => [p.lon, p.lat]));
      const outers = stitchWays(seg('outer')).filter((r) => r.length >= MIN_RING_POINTS);
      const inners = stitchWays(seg('inner'));
      // Holes are assigned to every outer; harmless because a hole outside an outer never matches.
      for (const o of outers) polys.push([o, ...inners]);
    }
  }
  return polys;
}

async function main() {
  if (existsSync(OUT) && !process.argv.includes('--force')) {
    console.log(`${OUT} exists, skipping (use --force to refetch)`);
    return;
  }
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
        'user-agent': 'gville-patterns/1.0 (personal fishing app; https://github.com/kkiper/gville-patterns)',
      },
      body: 'data=' + encodeURIComponent(QUERY),
    });
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
    const json = await res.json();
    const polys = toPolygons(json.elements || []);
    if (!polys.length) throw new Error('No water polygons returned');
    writeFileSync(OUT, JSON.stringify({ type: 'Feature', properties: { source: 'OpenStreetMap contributors (ODbL)', fetched: new Date().toISOString() }, geometry: { type: 'MultiPolygon', coordinates: polys } }));
    console.log(`Wrote ${OUT} with ${polys.length} polygons`);
  } catch (e) {
    console.error(`fetch-outline: ${e.message} (keeping existing data)`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
