import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotConditions, makeCatch, validateImport, mergeCatches, exportReminderDue } from '../js/lib/catches.js';

const weather = { hours: [
  { time: '2026-11-15T10:00', tempF: 55, windMph: 8, windFromDeg: 200, pressureHpa: 1018 },
  { time: '2026-11-15T11:00', tempF: 57, windMph: 9, windFromDeg: 210, pressureHpa: 1017 },
] };
const water = { pool: { observed: [{ time: 't1', value: 594.1 }, { time: 't2', value: 594.2 }] }, usgs: { waterTempF: { time: 't', value: 58 } }, generation: null };
const now = new Date('2026-11-15T17:20:00Z'); // 11:20 CST

test('snapshot picks nearest hour and latest water', () => {
  assert.deepEqual(snapshotConditions(now, weather, water), { tempF: 57, windMph: 9, windFromDeg: 210, pressureHpa: 1017, poolFt: 594.2, waterTempF: 58, generation: null, weatherUpdated: null, waterUpdated: null });
});
test('snapshot with missing water data', () => {
  const s = snapshotConditions(now, weather, null);
  assert.equal(s.poolFt, null); assert.equal(s.waterTempF, null);
  assert.equal(s.tempF, 57);
});
test('snapshot with no weather either', () => {
  const s = snapshotConditions(now, null, null);
  assert.deepEqual(Object.values(s).filter((v) => v !== null), []);
});
test('makeCatch has id, time, location and snapshot', () => {
  const c = makeCatch({ latlng: [34.4, -86.27], species: 'Largemouth', weightLb: 4.5, bait: 'jig', notes: '', now, weather, water });
  assert.match(c.id, /^[0-9a-f-]{36}$/);
  assert.equal(c.time, now.toISOString());
  assert.deepEqual(c.latlng, [34.4, -86.27]);
  assert.equal(c.conditions.windMph, 9);
});
test('rejects malformed', () => {
  assert.equal(validateImport('not json {').ok, false);
  assert.equal(validateImport(JSON.stringify({ app: 'other', version: 1, catches: [] })).ok, false);
  assert.equal(validateImport(JSON.stringify({ app: 'gville-patterns', version: 1 })).ok, false);
  assert.equal(validateImport(JSON.stringify({ app: 'gville-patterns', version: 1, catches: [{ nope: 1 }] })).ok, false);
  const ok = validateImport(JSON.stringify({ app: 'gville-patterns', version: 1, catches: [{ id: 'x', time: now.toISOString(), latlng: [34, -86] }] }));
  assert.equal(ok.ok, true); assert.equal(ok.catches.length, 1);
});
test('merge dedupes by id', () => {
  const a = [{ id: '1' }, { id: '2' }];
  const r1 = mergeCatches(a, [{ id: '2' }, { id: '3' }]);
  assert.equal(r1.merged.length, 3); assert.equal(r1.added, 1); assert.equal(r1.skipped, 1);
  const r2 = mergeCatches(r1.merged, r1.merged);
  assert.equal(r2.added, 0); assert.equal(r2.skipped, 3);
});
test('exportReminderDue', () => {
  const day = 86400000;
  assert.equal(exportReminderDue(null, now), true);
  assert.equal(exportReminderDue(new Date(now - 29 * day).toISOString(), now), false);
  assert.equal(exportReminderDue(new Date(now - 31 * day).toISOString(), now), true);
});
