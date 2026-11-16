// Offline support: app shell precache, network-first data, cache-first lake tiles.
const SHELL = 'gville-shell-v2';
const DATA = 'gville-data-v1';
const TILES = 'gville-tiles-v1';
const MAX_TILES = 2000;
const SHELL_FILES = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icons/icon-192.png',
  'js/app.js', 'js/data.js', 'js/store.js',
  'js/views/map.js', 'js/views/sheet.js', 'js/views/common.js', 'js/views/forecast.js', 'js/views/water.js', 'js/views/patterns.js', 'js/views/log.js',
  'js/lib/geo.js', 'js/lib/exposure.js', 'js/lib/solunar.js', 'js/lib/bite.js', 'js/lib/time.js', 'js/lib/weather.js',
  'js/lib/water.js', 'js/lib/patterns.js', 'js/lib/catches.js', 'js/lib/fetch-calc.js',
  'data/sections.json', 'data/patterns.json', 'data/section-fetch.json', 'data/weather.json', 'data/water.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];
const BBOX = { s: 34.2, w: -86.6, n: 34.9, e: -85.8 };

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => Promise.allSettled(SHELL_FILES.map((f) => c.add(f)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

function tileInLake(url) {
  const m = /\/(\d+)\/(\d+)\/(\d+)(@2x)?\.png/.exec(url.pathname);
  if (!m) return false;
  const [z, x, y] = [+m[1], +m[2], +m[3]];
  const n = 2 ** z;
  const lng = (x / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  const lng2 = ((x + 1) / n) * 360 - 180;
  const lat2 = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
  return lng2 >= BBOX.w && lng <= BBOX.e && lat >= BBOX.s && lat2 <= BBOX.n;
}

async function trimTiles(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.includes('/data/') && url.pathname.endsWith('.json')) {
    e.respondWith(fetch(e.request).then((res) => {
      if (!res.ok) return caches.match(e.request).then((hit) => hit || res);
      const copy = res.clone();
      caches.open(DATA).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request)));
    return;
  }
  if (url.hostname.includes('basemaps.cartocdn.com')) {
    if (!tileInLake(url)) return;
    e.respondWith(caches.open(TILES).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) { c.put(e.request, res.clone()); trimTiles(c); }
      return res;
    }));
    return;
  }
  // App files: network first so updates show up; cache when offline.
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok && url.origin === location.origin) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request)));
});
