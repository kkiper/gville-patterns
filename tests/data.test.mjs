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

import { dataBase } from '../js/data.js';
test('dataBase reads straight from the GitHub repo on github.io', () => {
  assert.equal(dataBase({ hostname: 'kkiper.github.io', pathname: '/gville-patterns/' }), 'https://raw.githubusercontent.com/kkiper/gville-patterns/main/');
  assert.equal(dataBase({ hostname: 'kkiper.github.io', pathname: '/gville-patterns/index.html' }), 'https://raw.githubusercontent.com/kkiper/gville-patterns/main/');
});
test('dataBase stays local elsewhere', () => {
  assert.equal(dataBase({ hostname: 'localhost', pathname: '/' }), '');
});

import { needsLiveRefresh } from '../js/data.js';
test('needsLiveRefresh after 1 hour or when missing', () => {
  const now = new Date('2026-11-16T15:00:00Z');
  assert.equal(needsLiveRefresh({ updated: '2026-11-16T14:30:00Z' }, now), false);
  assert.equal(needsLiveRefresh({ updated: '2026-11-16T13:30:00Z' }, now), true);
  assert.equal(needsLiveRefresh(null, now), true);
});
