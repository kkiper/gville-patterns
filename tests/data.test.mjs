import test from 'node:test';
import assert from 'node:assert/strict';
import { staleness } from '../js/data.js';

const t = new Date('2026-11-15T18:00:00Z');
const ago = (ms) => new Date(t - ms).toISOString();
const H = 3600000, M = 60000;

test('staleness banner after 3h', () => {
  assert.equal(staleness(ago(3 * H + M), t).stale, true);
  assert.equal(staleness(ago(3 * H - M), t).stale, false);
});
test('null updated → never', () => {
  assert.deepEqual(staleness(null, t), { stale: true, label: 'never' });
});
test('labels', () => {
  assert.equal(staleness(ago(10 * M), t).label, '10 min ago');
  assert.equal(staleness(ago(2 * H + 5 * M), t).label, '2 h ago');
  assert.equal(staleness(ago(50 * H), t).label, '2 days ago');
});
