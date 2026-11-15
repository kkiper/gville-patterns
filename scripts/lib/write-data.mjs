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
