import test from 'node:test';
import assert from 'node:assert/strict';
import { downwindVector, streakSpeed, streakCount } from '../js/lib/wind.js';
import { simplifyRing } from '../js/lib/simplify.js';

const close = (a, b) => Math.abs(a - b) < 1e-9;
test('wind FROM north blows toward the bottom of the screen', () => {
  const v = downwindVector(0); assert.ok(close(v.dx, 0) && close(v.dy, 1));
});
test('wind FROM west blows toward the right', () => {
  const v = downwindVector(270); assert.ok(close(v.dx, 1) && close(v.dy, 0));
});
test('wind FROM southeast blows up and left', () => {
  const v = downwindVector(135); assert.ok(v.dx < 0 && v.dy < 0);
});
test('streak speed grows with wind and is clamped', () => {
  assert.ok(streakSpeed(20) > streakSpeed(5));
  assert.equal(streakSpeed(0), streakSpeed(1));
  assert.equal(streakSpeed(200), streakSpeed(60));
});
test('streak count grows with wind and is clamped', () => {
  assert.ok(streakCount(15) > streakCount(3));
  assert.ok(streakCount(0) >= 60 && streakCount(100) <= 900);
});
test('simplifyRing drops collinear points and keeps it closed', () => {
  const ring = [[0, 0], [1, 0.00001], [2, 0], [2, 2], [0, 2], [0, 0]];
  const s = simplifyRing(ring, 0.001);
  assert.deepEqual(s, [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]);
});
test('simplifyRing never returns fewer than 4 points', () => {
  assert.ok(simplifyRing([[0, 0], [1e-6, 0], [0, 1e-6], [0, 0]], 1).length >= 4);
});
