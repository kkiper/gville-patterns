// Load the app's data files and judge how fresh they are.
const STALE_MS = 3 * 3600000;
const FILES = {
  weather: 'data/weather.json',
  water: 'data/water.json',
  sections: 'data/sections.json',
  sectionFetch: 'data/section-fetch.json',
  patterns: 'data/patterns.json',
};

export function staleness(updatedISO, now = new Date()) {
  if (!updatedISO) return { stale: true, label: 'never' };
  const ms = now - Date.parse(updatedISO);
  const min = Math.round(ms / 60000);
  const label = min < 60 ? `${min} min ago` : min < 48 * 60 ? `${Math.floor(min / 60)} h ago` : `${Math.floor(min / 1440)} days ago`;
  return { stale: ms > STALE_MS, label };
}

export async function loadAll() {
  const entries = await Promise.all(Object.entries(FILES).map(async ([k, url]) => {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      return [k, res.ok ? await res.json() : null];
    } catch {
      return [k, null];
    }
  }));
  return Object.fromEntries(entries);
}
