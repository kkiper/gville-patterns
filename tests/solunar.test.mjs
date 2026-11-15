import test from 'node:test';
import assert from 'node:assert/strict';
import { moonPhase, moonAltitude, solunarPeriods } from '../js/lib/solunar.js';

const REF = Date.parse('2000-01-06T18:14:00Z');
const LAT = 34.40, LNG = -86.27;
const MIN = 60000;

test('phase at reference new moon ≈ 0', () => {
  const p = moonPhase(new Date(REF));
  assert.ok(p < 0.01 || p > 0.99, `got ${p}`);
});
test('phase half a synodic month later ≈ 0.5', () => {
  assert.ok(Math.abs(moonPhase(new Date(REF + 14.765 * 86400000)) - 0.5) < 0.01);
});

const day = new Date('2026-11-15T06:00:00Z'); // local midnight CST
const periods = solunarPeriods(day, LAT, LNG);
const mid = (p) => new Date((p.start.getTime() + p.end.getTime()) / 2);

test('periods sorted with 1–4 majors in a day', () => {
  for (let i = 1; i < periods.length; i++) assert.ok(periods[i].start >= periods[i - 1].start);
  const majors = periods.filter((p) => p.type === 'major');
  assert.ok(majors.length >= 1 && majors.length <= 4, `majors ${majors.length}`);
});
test('major midpoints are altitude extrema', () => {
  for (const p of periods.filter((x) => x.type === 'major')) {
    const t = mid(p).getTime();
    const a = moonAltitude(new Date(t), LAT, LNG);
    const b = moonAltitude(new Date(t - 10 * MIN), LAT, LNG);
    const c = moonAltitude(new Date(t + 10 * MIN), LAT, LNG);
    assert.ok((a >= b && a >= c) || (a <= b && a <= c), `not extremum at ${mid(p).toISOString()}`);
  }
});
test('minor midpoints are at rise/set altitude', () => {
  const minors = periods.filter((x) => x.type === 'minor');
  assert.ok(minors.length >= 1);
  for (const p of minors) assert.ok(Math.abs(moonAltitude(mid(p), LAT, LNG) - 0.125) < 0.5);
});
test('major periods last 2 h, minor 1 h', () => {
  for (const p of periods) {
    const len = (p.end - p.start) / MIN;
    assert.equal(len, p.type === 'major' ? 120 : 60);
  }
});
