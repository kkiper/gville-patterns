// Tournament pattern records: validation, filtering, and bait ranking.
import { chicagoDateString } from './time.js';

export const MIN_MATCHES = 3;
const REQUIRED = ['id', 'date', 'event', 'technique', 'summary', 'source_url'];
const FORBIDDEN = ['angler', 'hometown', 'local'];

const monthOf = (r) => Number(r.date?.slice(5, 7));
const sentenceCount = (s) => (s.match(/[.!?](\s|$)/g) || []).length || (s.trim() ? 1 : 0);

export function validateRecord(r, sectionIds) {
  const errs = [];
  for (const k of REQUIRED) if (!r[k] || (typeof r[k] === 'string' && !r[k].trim())) errs.push(`missing ${k}`);
  for (const k of FORBIDDEN) if (k in r) errs.push(`forbidden key ${k}`);
  if (r.section != null && !sectionIds.has(r.section)) errs.push(`unknown section ${r.section}`);
  if (r.date && !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) errs.push(`bad date ${r.date}`);
  if (r.summary && sentenceCount(r.summary) > 2) errs.push('summary longer than 2 sentences');
  if (r.baits && !Array.isArray(r.baits)) errs.push('baits must be an array');
  if (r.water_temp_f != null && typeof r.water_temp_f !== 'number') errs.push('water_temp_f must be a number or null');
  return errs;
}

export function filterPatterns(records, { months, tempRange, technique, section, waterColor } = {}) {
  return records.filter((r) => {
    if (months?.length && !months.includes(monthOf(r))) return false;
    if (tempRange) {
      if (r.water_temp_f == null) return false;
      if (r.water_temp_f < tempRange[0] || r.water_temp_f > tempRange[1]) return false;
    }
    if (technique && r.technique !== technique) return false;
    if (section && r.section !== section) return false;
    if (waterColor && r.conditions?.water_color !== waterColor) return false;
    return true;
  });
}

export function likeToday(records, { date, waterTempF }) {
  const m = Number(chicagoDateString(date).slice(5, 7));
  const months = [((m + 10) % 12) + 1, m, (m % 12) + 1];
  return filterPatterns(records, { months, tempRange: waterTempF == null ? undefined : [waterTempF - 5, waterTempF + 5] });
}

export function rankBaits(records) {
  const byTech = new Map();
  for (const r of records) {
    if (!r.technique) continue;
    const t = byTech.get(r.technique) || { technique: r.technique, count: 0, baits: new Map() };
    t.count++;
    for (const b of r.baits || []) t.baits.set(b, (t.baits.get(b) || 0) + 1);
    byTech.set(r.technique, t);
  }
  return [...byTech.values()]
    .map((t) => ({ technique: t.technique, count: t.count, baits: [...t.baits].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count) }))
    .sort((a, b) => b.count - a.count);
}

export function sectionCounts(records) {
  const out = {};
  for (const r of records) if (r.section) out[r.section] = (out[r.section] || 0) + 1;
  return out;
}
