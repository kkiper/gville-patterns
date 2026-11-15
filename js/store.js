// IndexedDB storage for catches (browser only).
const DB = 'gville', VERSION = 1;
let dbp;

function db() {
  dbp ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('catches', { keyPath: 'id' });
      req.result.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const result = fn(t.objectStore(store));
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
  }));
}

export const loadCatches = () => tx('catches', 'readonly', (s) => s.getAll()).then((list) => (list || []).sort((a, b) => b.time.localeCompare(a.time)));
export const saveCatch = (c) => tx('catches', 'readwrite', (s) => s.put(c));
export const replaceAll = (list) => tx('catches', 'readwrite', (s) => { s.clear(); for (const c of list) s.put(c); });
export const getMeta = (key) => tx('meta', 'readonly', (s) => s.get(key));
export const setMeta = (key, val) => tx('meta', 'readwrite', (s) => s.put(val, key));
