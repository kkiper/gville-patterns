import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchMiles } from '../js/lib/fetch-calc.js';
import { destination } from '../js/lib/geo.js';

// Synthetic lake: 4 mi wide (E-W) x 1 mi tall (N-S), SW corner at origin.
const sw = [34.4, -86.3];
const se = destination(sw, 90, 4);
const nw = destination(sw, 0, 1);
const ne = [nw[0], se[1]];
const rect = [[[sw[1], sw[0]], [se[1], se[0]], [ne[1], ne[0]], [nw[1], nw[0]], [sw[1], sw[0]]]];
const lake = [rect]; // polygons: [outer, ...holes][]
const midWest = destination(destination(sw, 0, 0.5), 90, 0.05);

test('fetch from west edge looking east ≈ 4 mi', () => {
  const d = fetchMiles(midWest, 90, lake);
  assert.ok(d >= 3.85 && d <= 4.05, `got ${d}`);
});
test('fetch looking north across 1 mi width ≈ 0.5 from middle', () => {
  const d = fetchMiles(midWest, 0, lake);
  assert.ok(d >= 0.45 && d <= 0.55, `got ${d}`);
});
test('point on land returns 0', () => {
  assert.equal(fetchMiles([34.0, -86.0], 90, lake), 0);
});
test('caps at maxMi', () => {
  assert.equal(fetchMiles(midWest, 90, lake, 0.05, 2), 2);
});
test('holes count as land', () => {
  const holeC = destination(midWest, 90, 1);
  const h0 = destination(holeC, 0, 0.6), h1 = destination(holeC, 180, 0.6);
  const hx = destination(holeC, 90, 0.2)[1];
  const hole = [[holeC[1], h1[0]], [hx, h1[0]], [hx, h0[0]], [holeC[1], h0[0]], [holeC[1], h1[0]]];
  const d = fetchMiles(midWest, 90, [[rect[0], hole]]);
  assert.ok(d > 0.9 && d < 1.1, `got ${d}`);
});

import { polygonsFromGeoJSON } from '../js/lib/fetch-calc.js';
import { stitchWays } from '../scripts/lib/osm.mjs';
test('overlapping polygons stay water (no even-odd flip)', () => {
  assert.ok(fetchMiles(midWest, 90, [rect, rect]) > 3.8);
});
test('polygonsFromGeoJSON returns polygons for MultiPolygon', () => {
  const mp = { type: 'MultiPolygon', coordinates: [[[[0,0],[1,0],[1,1],[0,0]]], [[[5,5],[6,5],[6,6],[5,5]], [[5.2,5.2],[5.3,5.2],[5.3,5.3],[5.2,5.2]]]] };
  assert.equal(polygonsFromGeoJSON(mp).length, 2);
  assert.equal(polygonsFromGeoJSON(mp)[1].length, 2);
});
test('stitchWays joins ways into closed rings, reversing as needed', () => {
  const ways = [
    [[0,0],[1,0]],
    [[1,1],[1,0]],          // reversed
    [[1,1],[0,1],[0,0]],
    [[5,5],[6,5],[6,6],[5,5]] // already closed
  ];
  const rings = stitchWays(ways);
  assert.equal(rings.length, 2);
  for (const r of rings) assert.deepEqual(r[0], r[r.length - 1]);
  assert.equal(rings[0].length, 5);
});
