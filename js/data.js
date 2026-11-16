// Load the app's data files and judge how fresh they are.
import { normalizeOpenMeteo, weatherLooksBroken } from './lib/weather.js';
import { normalizeNwps } from './lib/water.js';

const LIVE_AFTER_MS = 3600000;
const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast?latitude=34.40&longitude=-86.27&hourly=temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation_probability&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=America/Chicago&forecast_days=7';
const NWPS = (lid) => `https://api.water.noaa.gov/nwps/v1/gauges/${lid}/stageflow`;

export function needsLiveRefresh(file, now = new Date()) {
  return !file?.updated || now - Date.parse(file.updated) > LIVE_AFTER_MS;
}

// GitHub's hourly job can lag; if saved data is over an hour old, fetch straight from the
// sources on the phone. Any failure keeps the saved data.
export async function refreshLive(data, now = new Date()) {
  const jobs = [];
  if (needsLiveRefresh(data.weather, now)) {
    jobs.push(fetch(OPEN_METEO).then((r) => r.json()).then((j) => {
      const w = normalizeOpenMeteo(j);
      if (!weatherLooksBroken(w)) data.weather = { source: 'Open-Meteo (live)', ...w, updated: now.toISOString(), errors: [] };
    }).catch(() => {}));
  }
  if (needsLiveRefresh(data.water, now)) {
    const prev = data.water || {};
    jobs.push(Promise.all(['GVHA1', 'SCRA1', 'GVDA1'].map((lid) => fetch(NWPS(lid)).then((r) => r.json()).then(normalizeNwps).catch(() => null)))
      .then(([pool, scottsboro, tailwater]) => {
        if (!pool?.observed.length && !tailwater?.observed.length) return;
        const keep = (fresh, old, gauge) => (fresh?.observed.length ? { gauge, ...fresh } : old ?? null);
        data.water = { ...prev, pool: keep(pool, prev.pool, 'GVHA1'), scottsboro: keep(scottsboro, prev.scottsboro, 'SCRA1'),
          tailwater: keep(tailwater, prev.tailwater, 'GVDA1'), updated: now.toISOString(), errors: [], sourceErrors: [], carried: [] };
      }));
  }
  await Promise.all(jobs);
  return data;
}
const STALE_MS = 3 * 3600000;
const FILES = {
  weather: 'data/weather.json',
  water: 'data/water.json',
  sections: 'data/sections.json',
  sectionFetch: 'data/section-fetch.json',
  patterns: 'data/patterns.json',
};

// On GitHub Pages the site isn't republished when the hourly job commits new data,
// so read data files straight from the repository (always current, CORS-enabled).
export function dataBase(loc = globalThis.location) {
  const m = /^([^.]+)\.github\.io$/.exec(loc?.hostname || '');
  const repo = (loc?.pathname || '').split('/').filter(Boolean)[0];
  return m && repo ? `https://raw.githubusercontent.com/${m[1]}/${repo}/main/` : '';
}

export function staleness(updatedISO, now = new Date()) {
  if (!updatedISO) return { stale: true, label: 'never' };
  const ms = now - Date.parse(updatedISO);
  const min = Math.round(ms / 60000);
  const label = min < 60 ? `${min} min ago` : min < 48 * 60 ? `${Math.floor(min / 60)} h ago` : `${Math.floor(min / 1440)} days ago`;
  return { stale: ms > STALE_MS, label };
}

export async function loadAll() {
  const base = dataBase();
  const get = async (url) => {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    return res.json();
  };
  const entries = await Promise.all(Object.entries(FILES).map(async ([k, path]) => {
    try {
      return [k, await get(base + path)];
    } catch {
      try { return [k, base ? await get(path) : null]; } catch { return [k, null]; } // fall back to the site's copy
    }
  }));
  return Object.fromEntries(entries);
}
