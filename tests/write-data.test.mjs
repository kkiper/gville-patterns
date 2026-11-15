import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeDataSafely } from '../scripts/lib/write-data.mjs';

const isEmpty = (d) => !d.hours?.length;

test('writeDataSafely writes and clears errors on good data', () => {
  const p = join(mkdtempSync(join(tmpdir(), 'wd-')), 'w.json');
  const r = writeDataSafely(p, { hours: [1, 2] }, { isEmpty });
  assert.equal(r.written, true);
  const f = JSON.parse(readFileSync(p, 'utf8'));
  assert.deepEqual(f.hours, [1, 2]);
  assert.deepEqual(f.errors, []);
  assert.ok(!Number.isNaN(Date.parse(f.updated)));
});
test('writeDataSafely keeps previous file on empty result', () => {
  const p = join(mkdtempSync(join(tmpdir(), 'wd-')), 'w.json');
  writeDataSafely(p, { hours: [1, 2] }, { isEmpty });
  const before = JSON.parse(readFileSync(p, 'utf8'));
  const r = writeDataSafely(p, { hours: [] }, { isEmpty, error: 'HTTP 503' });
  assert.equal(r.written, false);
  const f = JSON.parse(readFileSync(p, 'utf8'));
  assert.deepEqual(f.hours, [1, 2]);
  assert.equal(f.updated, before.updated);
  assert.equal(f.errors.length, 1);
  assert.match(f.errors[0].message, /503/);
});
test('errors capped at 10', () => {
  const p = join(mkdtempSync(join(tmpdir(), 'wd-')), 'w.json');
  writeDataSafely(p, { hours: [1] }, { isEmpty });
  for (let i = 0; i < 12; i++) writeDataSafely(p, { hours: [] }, { isEmpty, error: `e${i}` });
  const f = JSON.parse(readFileSync(p, 'utf8'));
  assert.equal(f.errors.length, 10);
  assert.equal(f.errors.at(-1).message, 'e11');
});
test('empty result with no previous file writes an error-only file', () => {
  const p = join(mkdtempSync(join(tmpdir(), 'wd-')), 'w.json');
  writeDataSafely(p, { hours: [] }, { isEmpty, error: 'offline' });
  const f = JSON.parse(readFileSync(p, 'utf8'));
  assert.equal(f.updated, null);
  assert.equal(f.errors.length, 1);
});
