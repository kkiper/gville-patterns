// Catch log: condition snapshots, import validation, merging, export reminders.
import { chicagoToDate } from './time.js';

const APP = 'gville-patterns';
const EXPORT_REMINDER_DAYS = 30;

const FRESH_MS = 3 * 3600000;
const fresh = (d, now) => d && (!d.updated || now - Date.parse(d.updated) <= FRESH_MS);

export function snapshotConditions(now, weather, water) {
  const wOk = fresh(weather, now), waOk = fresh(water, now);
  let h = null;
  for (const x of wOk ? weather.hours || [] : []) {
    const d = Math.abs(chicagoToDate(x.time) - now);
    if (!h || d < h.d) h = { d, x };
  }
  const w = h && h.d <= 90 * 60000 ? h.x : null; // ignore if nearest hour is >90 min away
  const pool = waOk ? water?.pool?.observed : null;
  return {
    tempF: w?.tempF ?? null,
    windMph: w?.windMph ?? null,
    windFromDeg: w?.windFromDeg ?? null,
    pressureHpa: w?.pressureHpa ?? null,
    poolFt: pool?.length ? pool[pool.length - 1].value : null,
    waterTempF: waOk ? water?.usgs?.waterTempF?.value ?? null : null,
    generation: waOk ? water?.generation ?? null : null,
    weatherUpdated: weather?.updated ?? null,
    waterUpdated: water?.updated ?? null,
  };
}

export function makeCatch({ latlng, species, weightLb, bait, notes, now, weather, water }) {
  return {
    id: crypto.randomUUID(),
    time: now.toISOString(),
    latlng,
    species: species || null,
    weightLb: Number.isFinite(parseFloat(String(weightLb ?? '').replace(',', '.'))) ? parseFloat(String(weightLb).replace(',', '.')) : null,
    bait: bait || null,
    notes: notes || '',
    conditions: snapshotConditions(now, weather, water),
  };
}

const numOrNull = (v) => v == null || (typeof v === 'number' && Number.isFinite(v));
const strOrNull = (v) => v == null || typeof v === 'string';
const validCatch = (c) => c && typeof c.id === 'string' && !Number.isNaN(Date.parse(c.time))
  && Array.isArray(c.latlng) && c.latlng.length === 2 && c.latlng.every(Number.isFinite)
  && numOrNull(c.weightLb) && strOrNull(c.species) && strOrNull(c.bait) && strOrNull(c.notes)
  && (c.conditions == null || (typeof c.conditions === 'object'
    && ['tempF', 'windMph', 'windFromDeg', 'pressureHpa', 'poolFt', 'waterTempF'].every((k) => numOrNull(c.conditions[k]))));

export function validateImport(text) {
  let json;
  try { json = typeof text === 'string' ? JSON.parse(text) : text; } catch { return { ok: false, error: "That file isn't valid JSON." }; }
  if (json?.app !== APP) return { ok: false, error: "That file isn't a G-Ville Patterns catch export." };
  if (json.version !== 1) return { ok: false, error: `Unsupported export version ${json.version}.` };
  if (!Array.isArray(json.catches)) return { ok: false, error: 'The file has no catches list.' };
  const bad = json.catches.filter((c) => !validCatch(c)).length;
  if (bad) return { ok: false, error: `${bad} catch record(s) are missing an id, time or location, or have invalid values.` };
  return { ok: true, catches: json.catches };
}

export function exportPayload(catches) {
  return { app: APP, version: 1, exported: new Date().toISOString(), catches };
}

export function mergeCatches(existing, incoming) {
  const ids = new Set(existing.map((c) => c.id));
  const merged = existing.slice();
  let added = 0, skipped = 0;
  for (const c of incoming) {
    if (ids.has(c.id)) { skipped++; continue; }
    ids.add(c.id); merged.push(c); added++;
  }
  return { merged, added, skipped };
}

export function exportReminderDue(lastExportISO, now) {
  if (!lastExportISO) return true;
  return now - Date.parse(lastExportISO) > EXPORT_REMINDER_DAYS * 86400000;
}
