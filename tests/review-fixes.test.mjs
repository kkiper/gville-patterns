import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { carryForward } from '../scripts/lib/write-data.mjs';
import { weatherLooksBroken, upcomingDays } from '../js/lib/weather.js';
import { validateImport, snapshotConditions } from '../js/lib/catches.js';
import { dash } from '../js/views/common.js';
import { heatLevels } from '../js/lib/patterns.js';

test('carryForward keeps the previous block for a failed source', () => {
  const prev = { pool: { observed: [{ time: 't', value: 594 }] }, usgs: { dischargeCfs: 1 } };
  const next = { pool: null, usgs: { dischargeCfs: 2 } };
  const r = carryForward(prev, next, ['pool', 'usgs']);
  assert.deepEqual(r.pool, prev.pool);
  assert.equal(r.usgs.dischargeCfs, 2);
  assert.deepEqual(r.carried, ['pool']);
});
test('weatherLooksBroken when most hours lack temp or wind', () => {
  const ok = { hours: [{ tempF: 50, windMph: 5 }, { tempF: 51, windMph: null }] };
  const bad = { hours: [{ tempF: null, windMph: null }, { tempF: null, windMph: 3 }, { tempF: 50, windMph: 4 }] };
  assert.equal(weatherLooksBroken(ok), false);
  assert.equal(weatherLooksBroken(bad), true);
  assert.equal(weatherLooksBroken({ hours: [] }), true);
});
test('upcomingDays drops past days', () => {
  const days = ['2026-11-14', '2026-11-15', '2026-11-16'].map((date) => ({ date, hours: [] }));
  const r = upcomingDays(days, new Date('2026-11-15T07:00:00Z')); // 1 a.m. CST Nov 15
  assert.deepEqual(r.map((d) => d.date), ['2026-11-15', '2026-11-16']);
});
test('import rejects non-numeric weight or conditions (XSS guard)', () => {
  const base = { id: 'x', time: '2026-11-15T12:00:00Z', latlng: [34, -86] };
  const wrap = (c) => JSON.stringify({ app: 'gville-patterns', version: 1, catches: [c] });
  assert.equal(validateImport(wrap({ ...base, weightLb: '<img src=x onerror=alert(1)>' })).ok, false);
  assert.equal(validateImport(wrap({ ...base, conditions: { tempF: '<b>' } })).ok, false);
  assert.equal(validateImport(wrap({ ...base, species: 5 })).ok, false);
  assert.equal(validateImport(wrap({ ...base, weightLb: 3.5, conditions: { tempF: 50 } })).ok, true);
});
test('dash escapes its value', () => assert.equal(dash('<b>'), '&lt;b&gt;'));
test('service worker precaches every app module and the static data', () => {
  const sw = readFileSync('sw.js', 'utf8');
  const files = ['js/views', 'js/lib', 'js'].flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.js')).map((f) => `${d}/${f}`));
  for (const f of [...files, 'data/sections.json', 'data/patterns.json', 'data/section-fetch.json']) assert.ok(sw.includes(`'${f}'`), `${f} not precached`);
});
test('heatLevels shades nothing until enough sectioned matches', () => {
  assert.deepEqual(heatLevels({ a: 1 }), { levels: {}, total: 1 });
  const r = heatLevels({ a: 4, b: 2, c: 1 });
  assert.equal(r.levels.a, 5); assert.equal(r.total, 7); assert.ok(r.levels.c >= 1 && r.levels.c < 5);
});
test('snapshot ignores forecast data older than 3 h and records data times', () => {
  const now = new Date('2026-11-15T17:20:00Z');
  const weather = { updated: '2026-11-13T10:00:00Z', hours: [{ time: '2026-11-15T11:00', tempF: 57, windMph: 9 }] };
  const water = { updated: '2026-11-15T17:00:00Z', pool: { observed: [{ time: 't', value: 594.2 }] } };
  const s = snapshotConditions(now, weather, water);
  assert.equal(s.tempF, null);
  assert.equal(s.poolFt, 594.2);
  assert.equal(s.weatherUpdated, '2026-11-13T10:00:00Z');
});
