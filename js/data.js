// Load the app's data files and judge how fresh they are.
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
