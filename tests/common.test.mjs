import test from 'node:test';
import assert from 'node:assert/strict';
import { currentHourIndex, esc, baitSummary } from '../js/views/common.js';

test('currentHourIndex finds the Chicago-local hour', () => {
  const hours = ['2026-11-15T10:00', '2026-11-15T11:00', '2026-11-15T12:00'].map((time) => ({ time }));
  assert.equal(currentHourIndex(hours, new Date('2026-11-15T17:30:00Z')), 1); // 11:30 CST
  assert.equal(currentHourIndex(hours, new Date('2027-01-01T00:00:00Z')), 0); // not found → 0
});
test('esc escapes HTML', () => assert.equal(esc('<a href="x">'), '&lt;a href=&quot;x&quot;&gt;'));
test('baitSummary says not enough below MIN_MATCHES', () => assert.match(baitSummary([]), /Not enough matching patterns/));
