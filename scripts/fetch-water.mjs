// Hourly: NOAA NWPS pool/stage gauges + USGS discharge/water temp into data/water.json.
// TVA's generation schedule is behind a bot check, so the tailwater gauge below the dam
// (GVDA1) stands in for release activity. No active USGS water-temperature site exists on the lake.
import { normalizeNwps } from '../js/lib/water.js';
import { writeDataSafely, carryForward, readPrevious } from './lib/write-data.mjs';

const SOURCES = {
  pool: { gauge: 'GVHA1', url: 'https://api.water.noaa.gov/nwps/v1/gauges/GVHA1/stageflow', norm: normalizeNwps, ok: (d) => d.observed.length },
  scottsboro: { gauge: 'SCRA1', url: 'https://api.water.noaa.gov/nwps/v1/gauges/SCRA1/stageflow', norm: normalizeNwps, ok: (d) => d.observed.length },
  tailwater: { gauge: 'GVDA1', url: 'https://api.water.noaa.gov/nwps/v1/gauges/GVDA1/stageflow', norm: normalizeNwps, ok: (d) => d.observed.length },
};

const out = { generation: null, operatingBand: { winterMin: 593, summerMin: 594, summerMax: 595 } };
const failures = [];
for (const [key, s] of Object.entries(SOURCES)) {
  try {
    const res = await fetch(s.url, { headers: { 'user-agent': 'gville-patterns/1.0 (personal fishing app; https://github.com/kkiper/gville-patterns)' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = s.norm(await res.json());
    if (!s.ok(d)) throw new Error('no data');
    out[key] = { gauge: s.gauge, site: s.site, ...d };
  } catch (e) {
    out[key] = null;
    failures.push(`${key}: ${e.message}`);
  }
}
out.sourceErrors = failures;
const allFailed = failures.length === Object.keys(SOURCES).length;
// Keep last good readings for failed sources; each block carries its own observation times.
const merged = carryForward(readPrevious('data/water.json'), out, Object.keys(SOURCES));
const r = writeDataSafely('data/water.json', merged, { isEmpty: () => allFailed, error: failures.join('; ') });
if (r.written && failures.length) console.log(`water.json written with missing sources: ${failures.join('; ')}`);
else console.log(r.written ? 'water.json: all sources ok' : `water.json kept: ${r.reason}`);
