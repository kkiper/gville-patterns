import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeNwps, normalizeUsgs } from '../js/lib/water.js';

const nwps = JSON.parse(readFileSync(new URL('./fixtures/nwps-gvha1.json', import.meta.url)));
const usgs = JSON.parse(readFileSync(new URL('./fixtures/usgs-iv.json', import.meta.url)));

test('NWPS observed/forecast with -999 dropped', () => {
  const r = normalizeNwps(nwps);
  assert.equal(r.observed.length, 23);
  assert.equal(r.forecast.length, 12);
  assert.equal(r.units, 'ft');
  assert.deepEqual(Object.keys(r.observed[0]).sort(), ['time', 'value']);
});
test('USGS: no 00010 → waterTempF null; discharge = latest', () => {
  const r = normalizeUsgs(usgs);
  assert.equal(r.waterTempF, null);
  assert.equal(r.dischargeCfs.value, 43800);
  assert.equal(r.dischargeCfs.time, '2026-11-15T11:00:00.000-06:00');
});
test('USGS: 20 °C → 68 °F', () => {
  const copy = structuredClone(usgs);
  copy.value.timeSeries.push({ variable: { variableCode: [{ value: '00010' }], noDataValue: -999999 }, values: [{ value: [{ value: '20.0', dateTime: '2026-11-15T11:00:00.000-06:00' }] }] });
  assert.equal(normalizeUsgs(copy).waterTempF.value, 68);
});
test('USGS: noDataValue ignored', () => {
  const copy = structuredClone(usgs);
  copy.value.timeSeries[0].values[0].value.push({ value: '-999999', dateTime: '2026-11-15T12:00:00.000-06:00' });
  assert.equal(normalizeUsgs(copy).dischargeCfs.value, 43800);
});
test('malformed input → empty, no throw', () => {
  assert.deepEqual(normalizeNwps(null), { observed: [], forecast: [], units: null });
  assert.deepEqual(normalizeUsgs({ nope: 1 }), { waterTempF: null, dischargeCfs: null });
});
