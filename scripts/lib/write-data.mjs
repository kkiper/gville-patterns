// Write a data file, but never replace good data with an empty/failed result.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const MAX_ERRORS = 10;

export function writeDataSafely(path, data, { isEmpty, error } = {}) {
  if (!isEmpty(data)) {
    writeFileSync(path, JSON.stringify({ ...data, updated: new Date().toISOString(), errors: [] }));
    return { written: true };
  }
  let prev = { updated: null };
  if (existsSync(path)) {
    try { prev = JSON.parse(readFileSync(path, 'utf8')); } catch { /* corrupt file: start over */ }
  }
  const errors = [...(prev.errors || []), { at: new Date().toISOString(), message: error || 'empty result' }].slice(-MAX_ERRORS);
  writeFileSync(path, JSON.stringify({ ...prev, errors }));
  return { written: false, reason: error || 'empty result' };
}

// For multi-source files: keep the previous block for any source that failed this run.
export function carryForward(prev, next, keys) {
  const out = { ...next, carried: [] };
  for (const k of keys) {
    if (next[k] == null && prev?.[k] != null) { out[k] = prev[k]; out.carried.push(k); }
  }
  return out;
}

export function readPrevious(path) {
  try { return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null; } catch { return null; }
}
