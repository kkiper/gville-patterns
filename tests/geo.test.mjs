import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineMiles, destination, pointInPolygon, compassIndex, COMPASS16 } from '../js/lib/geo.js';

test('haversine Guntersville→Scottsboro ≈ 25 mi', () => {
  const d = haversineMiles([34.358,-86.294],[34.672,-86.034]);
  assert.ok(d > 24 && d < 27, `got ${d}`);
});
test('destination round-trips with haversine', () => {
  const p = destination([34.4,-86.27], 90, 2);
  assert.ok(Math.abs(haversineMiles([34.4,-86.27], p) - 2) < 0.01);
});
test('pointInPolygon square', () => {
  const ring = [[-86.3,34.3],[-86.2,34.3],[-86.2,34.4],[-86.3,34.4],[-86.3,34.3]];
  assert.equal(pointInPolygon([34.35,-86.25], ring), true);
  assert.equal(pointInPolygon([34.45,-86.25], ring), false);
});
test('compassIndex', () => {
  assert.equal(compassIndex(0), 0); assert.equal(compassIndex(359), 0);
  assert.equal(compassIndex(22.5), 1); assert.equal(compassIndex(180), 8);
  assert.equal(COMPASS16.length, 16); assert.equal(COMPASS16[8], 'S');
});
