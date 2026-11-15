// Small shared UI helpers.
import { COMPASS16, compassIndex } from '../lib/geo.js';
import { rankBaits, MIN_MATCHES } from '../lib/patterns.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const dash = (v, unit = '') => (v == null ? '—' : `${v}${unit}`);
export const compass = (deg) => (deg == null ? '—' : COMPASS16[compassIndex(deg)]);
export const fmtTime = (iso, opts = { hour: 'numeric', minute: '2-digit' }) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/Chicago', ...opts });
export const dots = (n) => (n == null ? '<span class="muted">—</span>' : `<span class="dots">${'●'.repeat(n)}<span class="off">${'●'.repeat(5 - n)}</span></span>`);
export const currentWaterTemp = (data) => data.water?.usgs?.waterTempF?.value ?? null;

export function baitSummary(matches, { limit = 3 } = {}) {
  if (matches.length < MIN_MATCHES) {
    return `<p class="muted small">Not enough matching patterns (${matches.length}). Try widening the filters on the Patterns tab.</p>`;
  }
  const note = matches.tempFallback ? '<p class="muted small">Few reports list water temperature, so this matches by season only.</p>' : '';
  return note + rankBaits(matches).slice(0, limit).map((t) => `
    <div class="row between small" style="margin:6px 0">
      <div><b>${esc(t.technique)}</b><br><span class="muted">${t.baits.slice(0, 3).map((b) => esc(b.name)).join(' · ') || '—'}</span></div>
      <span class="pill accent">${t.count}×</span>
    </div>`).join('') + `<p class="muted small">From ${matches.length} tournament patterns in similar conditions.</p>`;
}

// Index of the forecast hour closest to now (hours are Chicago-local strings).
export function currentHourIndex(hours, now) {
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .format(now).replace(', ', 'T').slice(0, 13);
  const i = hours.findIndex((h) => h.time.slice(0, 13) === key);
  return i < 0 ? 0 : i;
}
