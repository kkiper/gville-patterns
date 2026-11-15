import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateRecord, filterPatterns, likeToday, rankBaits, sectionCounts, MIN_MATCHES } from '../js/lib/patterns.js';

const recs = JSON.parse(readFileSync(new URL('./fixtures/patterns-sample.json', import.meta.url)));
const ids = new Set(['spring-creek', 'browns-creek']);

test('MIN_MATCHES is 3', () => assert.equal(MIN_MATCHES, 3));
test('rankBaits on empty → []', () => assert.deepEqual(rankBaits([]), []));
test('rankBaits groups by technique, sorted desc, with bait counts', () => {
  const r = rankBaits(recs);
  assert.equal(r[0].technique, 'lipless crankbait');
  assert.equal(r[0].count, 2);
  assert.deepEqual(r[0].baits[0], { name: 'red lipless', count: 2 });
});
test('null water temp excluded only when temp filter set', () => {
  assert.equal(filterPatterns(recs, {}).length, 4);
  assert.equal(filterPatterns(recs, { tempRange: [45, 60] }).map((r) => r.id).sort().join(), 'a,c');
});
test('filter by months, technique, section, waterColor', () => {
  assert.deepEqual(filterPatterns(recs, { months: [3] }).map((r) => r.id), ['a']);
  assert.equal(filterPatterns(recs, { technique: 'lipless crankbait' }).length, 2);
  assert.equal(filterPatterns(recs, { section: 'spring-creek' }).length, 2);
  assert.equal(filterPatterns(recs, { waterColor: 'clear' }).length, 2);
});
test('likeToday wraps December→January and uses ±5°F when known', () => {
  const jan = likeToday(recs, { date: new Date('2027-01-10T18:00:00Z'), waterTempF: null }).map((r) => r.id).sort();
  assert.deepEqual(jan, ['b', 'c']);
  const warm = [50, 51, 52, 70].map((t, i) => ({ ...recs[2], id: `w${i}`, water_temp_f: t }));
  const dec = likeToday([...warm, recs[1]], { date: new Date('2026-12-10T18:00:00Z'), waterTempF: 48 });
  assert.deepEqual(dec.map((r) => r.id), ['w0', 'w1', 'w2']); // enough temp matches → null-temp b and 70°F excluded
  assert.equal(dec.tempFallback, undefined);
});
test('sectionCounts skips null sections', () => {
  assert.deepEqual(sectionCounts(recs), { 'spring-creek': 2, 'browns-creek': 1 });
});
test('validateRecord: clean record has no errors', () => {
  assert.deepEqual(validateRecord(recs[0], ids), []);
});
test('validateRecord flags angler key, unknown section, missing source, long summary', () => {
  const bad = { ...recs[0], angler: 'X', section: 'nowhere', source_url: '', summary: 'One. Two. Three.' };
  const errs = validateRecord(bad, ids).join(' | ');
  assert.match(errs, /angler/);
  assert.match(errs, /section/);
  assert.match(errs, /source_url/);
  assert.match(errs, /summary/);
});
test('likeToday falls back to month-only when temp matching leaves < MIN_MATCHES', () => {
  const many = [1, 2, 3, 4].map((i) => ({ ...recs[1], id: `n${i}`, water_temp_f: null }));
  const r = likeToday(many, { date: new Date('2027-01-10T18:00:00Z'), waterTempF: 50 });
  assert.equal(r.length, 4);
  assert.equal(r.tempFallback, true);
});
