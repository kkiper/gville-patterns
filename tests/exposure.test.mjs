import test from 'node:test';
import assert from 'node:assert/strict';
import { exposure } from '../js/lib/exposure.js';

const f = (v) => Array(16).fill(0.1).map((x, i) => (i === 8 ? v : x)); // fetch v toward S (wind FROM S)
test('12 mph from S, fetch 2.0 → windblown', () => assert.equal(exposure(f(2.0), 180, 12), 'windblown'));
test('12 mph from S, fetch 0.3 → calm', () => assert.equal(exposure(f(0.3), 180, 12), 'calm'));
test('7 mph, fetch 1.0 → partial', () => assert.equal(exposure(f(1.0), 180, 7), 'partial'));
test('3 mph, fetch 5 → calm', () => assert.equal(exposure(f(5), 180, 3), 'calm'));
test('boundary 10 mph / 1.5 mi → windblown', () => assert.equal(exposure(f(1.5), 180, 10), 'windblown'));
test('missing fetch → null', () => assert.equal(exposure(undefined, 180, 12), null));
test('all-zero fetch (center on land) → null', () => assert.equal(exposure(Array(16).fill(0), 180, 12), null));
test('missing wind → null', () => assert.equal(exposure(f(2), null, null), null));
