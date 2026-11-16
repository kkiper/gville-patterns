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
