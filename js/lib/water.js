// Normalize NOAA NWPS gauge stageflow and USGS instantaneous values.
const MISSING = -999;

function rows(block) {
  if (!Array.isArray(block?.data)) return [];
  return block.data
    .filter((d) => typeof d.primary === 'number' && d.primary > MISSING)
    .map((d) => ({ time: d.validTime, value: d.primary }));
}

export function normalizeNwps(json) {
  return {
    observed: rows(json?.observed),
    forecast: rows(json?.forecast),
    units: json?.observed?.primaryUnits ?? json?.forecast?.primaryUnits ?? null,
  };
}

function latest(series) {
  const noData = series?.variable?.noDataValue;
  const vals = (series?.values?.[0]?.value || [])
    .map((v) => ({ time: v.dateTime, value: Number(v.value) }))
    .filter((v) => Number.isFinite(v.value) && v.value !== noData);
  return vals.length ? vals[vals.length - 1] : null;
}

export function normalizeUsgs(json) {
  const ts = json?.value?.timeSeries;
  if (!Array.isArray(ts)) return { waterTempF: null, dischargeCfs: null };
  const find = (code) => ts.find((s) => s?.variable?.variableCode?.[0]?.value === code);
  const t = latest(find('00010'));
  return {
    waterTempF: t ? { time: t.time, value: Math.round((t.value * 9) / 5 + 32) } : null,
    dischargeCfs: latest(find('00060')),
  };
}

// Tailwater below the dam rises when TVA releases more water (more current on the lake's
// lower end) and falls when releases drop. Compare the latest reading with ~3 hours earlier.
const TREND_FT = 0.3;
export function releaseTrend(observed) {
  if (!Array.isArray(observed) || observed.length < 2) return null;
  const last = observed[observed.length - 1];
  const target = Date.parse(last.time) - 3 * 3600000;
  let earlier = observed[0];
  for (const p of observed) if (Date.parse(p.time) <= target) earlier = p;
  const changeFt = Math.round((last.value - earlier.value) * 100) / 100;
  const trend = changeFt >= TREND_FT ? 'rising' : changeFt <= -TREND_FT ? 'falling' : 'steady';
  return { trend, changeFt, since: earlier.time, latest: last };
}
