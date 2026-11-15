// Hourly: NOAA NWPS pool/stage gauges + USGS discharge/water temp into data/water.json.
// TVA's generation schedule has no known public JSON endpoint yet, so generation stays null.
import { normalizeNwps, normalizeUsgs } from '../js/lib/water.js';
import { writeDataSafely } from './lib/write-data.mjs';

const SOURCES = {
  pool: { gauge: 'GVHA1', url: 'https://api.water.noaa.gov/nwps/v1/gauges/GVHA1/stageflow', norm: normalizeNwps, ok: (d) => d.observed.length },
  scottsboro: { gauge: 'SCRA1', url: 'https://api.water.noaa.gov/nwps/v1/gauges/SCRA1/stageflow', norm: normalizeNwps, ok: (d) => d.observed.length },
  usgs: { site: '03573500', url: 'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=03573500&parameterCd=00010,00060,00065&period=P2D', norm: normalizeUsgs, ok: (d) => d.dischargeCfs || d.waterTempF },
};

const out = { generation: null, operatingBand: { winterMin: 593, summerMin: 594, summerMax: 595 } };
const failures = [];
for (const [key, s] of Object.entries(SOURCES)) {
  try {
    const res = await fetch(s.url);
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
const r = writeDataSafely('data/water.json', out, { isEmpty: () => allFailed, error: failures.join('; ') });
if (r.written && failures.length) console.log(`water.json written with missing sources: ${failures.join('; ')}`);
else console.log(r.written ? 'water.json: all sources ok' : `water.json kept: ${r.reason}`);
