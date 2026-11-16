import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeOpenMeteo } from '../js/lib/weather.js';

const fx = JSON.parse(readFileSync(new URL('./fixtures/open-meteo-forecast.json', import.meta.url)));

test('normalizes 48 hours into 2 Chicago days', () => {
  const w = normalizeOpenMeteo(fx);
  assert.equal(w.hours.length, 48);
  assert.equal(w.days.length, 2);
  assert.equal(w.days[0].date, '2026-11-15');
  assert.equal(w.days[0].hours.length, 24);
});
test('maps fields on hour 0', () => {
  const h = normalizeOpenMeteo(fx).hours[0];
  assert.equal(h.time, '2026-11-15T00:00');
  assert.equal(h.pressureHpa, 1020);
  assert.equal(h.windFromDeg, 180);
  assert.equal(h.windMph, fx.hourly.wind_speed_10m[0]);
  assert.equal(h.tempF, fx.hourly.temperature_2m[0]);
  assert.equal(h.cloudPct, 0);
  assert.equal(h.precipPct, 0);
  assert.equal(h.gustMph, fx.hourly.wind_gusts_10m[0]);
});
test('missing array gives nulls, not a throw', () => {
  const copy = structuredClone(fx); delete copy.hourly.pressure_msl;
  assert.equal(normalizeOpenMeteo(copy).hours[5].pressureHpa, null);
});
test('garbage input gives empty result', () => {
  assert.deepEqual(normalizeOpenMeteo(null), { hours: [], days: [] });
  assert.deepEqual(normalizeOpenMeteo({ error: true }), { hours: [], days: [] });
});
