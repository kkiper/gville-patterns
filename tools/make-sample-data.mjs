// Writes sample data/weather.json and data/water.json from test fixtures (for local preview only).
import { readFileSync, writeFileSync } from 'node:fs';
import { normalizeOpenMeteo } from '../js/lib/weather.js';
import { normalizeNwps } from '../js/lib/water.js';
const fx = (f) => JSON.parse(readFileSync(`tests/fixtures/${f}`, 'utf8'));
const updated = process.argv[2] || new Date().toISOString();
writeFileSync('data/weather.json', JSON.stringify({ source: 'Open-Meteo (sample)', ...normalizeOpenMeteo(fx('open-meteo-forecast.json')), updated, errors: [] }));
const nw = normalizeNwps(fx('nwps-gvha1.json'));
writeFileSync('data/water.json', JSON.stringify({ pool: { gauge: 'GVHA1', ...nw }, scottsboro: null, tailwater: { gauge: 'GVDA1', ...nw }, generation: null,
  operatingBand: { winterMin: 593, summerMin: 594, summerMax: 595 }, sourceErrors: ['scottsboro: sample'], updated, errors: [] }));
console.log('sample data written, updated =', updated);
