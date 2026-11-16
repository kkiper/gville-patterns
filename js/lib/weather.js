import { chicagoDateString } from './time.js';

// Normalize an Open-Meteo hourly forecast (requested with timezone=America/Chicago,
// so time strings are already local and are kept as-is).
const FIELDS = {
  tempF: 'temperature_2m',
  windMph: 'wind_speed_10m',
  gustMph: 'wind_gusts_10m',
  windFromDeg: 'wind_direction_10m',
  pressureHpa: 'pressure_msl',
  cloudPct: 'cloud_cover',
  precipPct: 'precipitation_probability',
};

export function normalizeOpenMeteo(json) {
  const h = json?.hourly;
  if (!h || !Array.isArray(h.time)) return { hours: [], days: [] };
  const hours = h.time.map((time, i) => {
    const row = { time };
    for (const [k, src] of Object.entries(FIELDS)) {
      const v = Array.isArray(h[src]) ? h[src][i] : null;
      row[k] = typeof v === 'number' ? v : null;
    }
    return row;
  });
  const byDate = new Map();
  for (const row of hours) {
    const date = row.time.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(row);
  }
  return { hours, days: [...byDate].map(([date, hs]) => ({ date, hours: hs })) };
}

// A response with hours but mostly-null temp/wind means the API changed shape.
export function weatherLooksBroken(d) {
  const hs = d?.hours || [];
  if (!hs.length) return true;
  const bad = hs.filter((h) => h.tempF == null || h.windMph == null).length;
  return bad / hs.length > 0.5;
}

// Drop forecast days that are already over in Chicago.
export function upcomingDays(days, now) {
  const today = chicagoDateString(now);
  return (days || []).filter((d) => d.date >= today);
}
