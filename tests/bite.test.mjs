import test from 'node:test';
import assert from 'node:assert/strict';
import { hourScore, dayRating } from '../js/lib/bite.js';
import { chicagoToDate } from '../js/lib/time.js';

const mk = (n, f) => Array.from({ length: n }, (_, i) => ({ time: `2026-11-15T${String(i).padStart(2, '0')}:00`, windMph: 2, pressureHpa: 1015, ...f(i) }));

test('chicagoToDate handles CST and CDT', () => {
  assert.equal(chicagoToDate('2026-11-15T06:00').toISOString(), '2026-11-15T12:00:00.000Z');
  assert.equal(chicagoToDate('2026-07-04T06:00').toISOString(), '2026-07-04T11:00:00.000Z');
});
test('neutral hour scores 3 with no reasons', () => {
  const r = hourScore(mk(12, () => ({})), 8, []);
  assert.equal(r.score, 3);
  assert.deepEqual(r.reasons, []);
});
test('falling pressure + 10 mph + major → 5', () => {
  const hours = mk(12, (i) => ({ pressureHpa: 1020 - i, windMph: 10 }));
  const t = chicagoToDate(hours[8].time);
  const periods = [{ type: 'major', start: new Date(t - 3600000), end: new Date(+t + 3600000) }];
  const r = hourScore(hours, 8, periods);
  assert.equal(r.score, 5);
  assert.deepEqual(r.reasons.sort(), ['Major solunar period', 'Pressure falling', 'Wind making chop']);
});
test('25 mph + rising pressure → 1', () => {
  const r = hourScore(mk(12, (i) => ({ pressureHpa: 1010 + i, windMph: 25 })), 8, []);
  assert.equal(r.score, 1);
});
test('early index skips pressure rule', () => {
  const r = hourScore(mk(12, (i) => ({ pressureHpa: 1020 - i })), 3, []);
  assert.ok(r.reasons.includes('Not enough pressure history'));
  assert.equal(r.score, 3);
});
test('missing pressure reports it', () => {
  const r = hourScore(mk(12, () => ({ pressureHpa: null })), 8, []);
  assert.ok(r.reasons.includes('No pressure data'));
});
test('minor period adds half a point (rounds)', () => {
  const hours = mk(12, () => ({ windMph: 10 }));
  const t = chicagoToDate(hours[8].time);
  const r = hourScore(hours, 8, [{ type: 'minor', start: new Date(t - 1800000), end: new Date(+t + 1800000) }]);
  assert.equal(r.score, 5); // 3 + 1 + 0.5 = 4.5 → 5
  assert.ok(r.reasons.includes('Minor solunar period'));
});
test('dayRating ignores night hours', () => {
  const hours = mk(24, (i) => (i === 3 ? { pressureHpa: 1000, windMph: 10 } : {}));
  const t = chicagoToDate(hours[3].time);
  const periods = [{ type: 'major', start: new Date(t - 3600000), end: new Date(+t + 3600000) }];
  const day = { date: '2026-11-15', hours };
  const r = dayRating(day, hours, periods);
  assert.equal(r.score, 3);
  assert.ok(r.bestHour >= '2026-11-15T06:00' && r.bestHour <= '2026-11-15T19:00');
});
