// One-time: list NOAA NWPS gauges and active USGS water-temperature sites around
// Lake Guntersville. Writes data/gauge-discovery.json.
import { writeFileSync } from 'node:fs';

const UA = { 'user-agent': 'gville-patterns/1.0 (personal fishing app; https://github.com/kkiper/gville-patterns)', accept: 'application/json' };
const out = { at: new Date().toISOString(), nwps: [], tailwater: {}, usgsTemp: null, errors: [] };

try {
  const url = 'https://api.water.noaa.gov/nwps/v1/gauges?bbox.xmin=-86.6&bbox.ymin=34.2&bbox.xmax=-85.6&bbox.ymax=35.0&srid=EPSG_4326';
  const j = await (await fetch(url, { headers: UA })).json();
  out.nwps = (j.gauges || []).map((g) => ({ lid: g.lid, name: g.name, lat: g.latitude, lng: g.longitude }));
  for (const g of out.nwps.filter((g) => /tail|guntersville dam/i.test(g.name || ''))) {
    const sf = await (await fetch(`https://api.water.noaa.gov/nwps/v1/gauges/${g.lid}/stageflow`, { headers: UA })).json();
    const o = sf.observed || {};
    out.tailwater[g.lid] = { name: g.name, primary: `${o.primaryName} ${o.primaryUnits}`, secondary: `${o.secondaryName} ${o.secondaryUnits}`, last: (o.data || []).slice(-3), forecastPoints: (sf.forecast?.data || []).length };
  }
} catch (e) { out.errors.push(`nwps: ${e.message}`); }

try {
  const url = 'https://waterservices.usgs.gov/nwis/site/?format=rdb&bBox=-86.6,34.2,-85.6,35.0&parameterCd=00010&siteStatus=active&hasDataTypeCd=iv';
  out.usgsTemp = (await (await fetch(url, { headers: UA })).text()).split('\n').filter((l) => /^USGS\t/.test(l)).map((l) => l.split('\t').slice(1, 6).join(' | '));
} catch (e) { out.errors.push(`usgs: ${e.message}`); }

writeFileSync('data/gauge-discovery.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
