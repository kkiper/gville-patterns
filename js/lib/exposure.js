// Classify how exposed a section is to the current wind.
import { compassIndex } from './geo.js';

export function exposure(fetch16, windFromDeg, windMph) {
  if (!Array.isArray(fetch16) || fetch16.length !== 16 || fetch16.every((v) => !v)) return null;
  if (windFromDeg == null || windMph == null) return null;
  const fetch = fetch16[compassIndex(windFromDeg)];
  if (windMph >= 10 && fetch >= 1.5) return 'windblown';
  if (windMph >= 5 && fetch >= 0.5) return 'partial';
  return 'calm';
}
