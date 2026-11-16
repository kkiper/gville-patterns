// Patterns: filterable tournament pattern database with bait ranking.
import { filterPatterns, likeToday } from '../lib/patterns.js';
import { esc, baitSummary, currentWaterTemp } from './common.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const state = { likeToday: true, months: [], tempMin: '', tempMax: '', technique: '', section: '', waterColor: '' };

export function render(root, ctx) {
  const all = ctx.data.patterns || [];
  const sections = ctx.data.sections || [];
  const sectionName = Object.fromEntries(sections.map((s) => [s.id, s.name]));
  const techniques = [...new Set(all.map((r) => r.technique))].sort();
  const colors = [...new Set(all.map((r) => r.conditions?.water_color).filter(Boolean))].sort();
  const opt = (v, label, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(label)}</option>`;

  root.innerHTML = `<div class="page"><h1>Patterns</h1>
    <div class="card">
      <label class="toggle"><input type="checkbox" id="f-today" ${state.likeToday ? 'checked' : ''}> Conditions like today (this season${currentWaterTemp(ctx.data) != null ? ', water temp ±5°' : ''})</label>
      <div class="filters" style="margin-top:8px">
        <div><label>Months</label><select id="f-months" multiple size="3">${MONTHS.map((m, i) => opt(i + 1, m, state.months.includes(i + 1))).join('')}</select></div>
        <div><label>Water temp °F</label><div class="row"><input id="f-tmin" inputmode="numeric" placeholder="min" value="${esc(state.tempMin)}"><input id="f-tmax" inputmode="numeric" placeholder="max" value="${esc(state.tempMax)}"></div></div>
        <div><label>Technique</label><select id="f-tech">${opt('', 'Any')}${techniques.map((t) => opt(t, t, t === state.technique)).join('')}</select></div>
        <div><label>Section</label><select id="f-section">${opt('', 'Any')}${sections.map((s) => opt(s.id, s.name, s.id === state.section)).join('')}</select></div>
        <div><label>Water color</label><select id="f-color">${opt('', 'Any')}${colors.map((c) => opt(c, c, c === state.waterColor)).join('')}</select></div>
        <div style="align-self:end"><button class="btn ghost" id="f-reset" style="width:100%">Reset</button></div>
      </div>
    </div>
    <div id="results"></div></div>`;

  const $ = (id) => root.querySelector(id);
  function apply() {
    let base = all;
    let fallback = false;
    if (state.likeToday) {
      base = likeToday(all, { date: ctx.now, waterTempF: currentWaterTemp(ctx.data) });
      fallback = !!base.tempFallback;
    }
    const tMin = state.tempMin === '' ? null : Number(state.tempMin);
    const tMax = state.tempMax === '' ? null : Number(state.tempMax);
    const recs = filterPatterns(base, {
      months: state.months,
      tempRange: tMin != null || tMax != null ? [tMin ?? -Infinity, tMax ?? Infinity] : undefined,
      technique: state.technique || undefined,
      section: state.section || undefined,
      waterColor: state.waterColor || undefined,
    }).sort((a, b) => b.date.localeCompare(a.date));
    if (fallback) recs.tempFallback = true;
    $('#results').innerHTML = `
      <h2>${recs.length} pattern${recs.length === 1 ? '' : 's'}</h2>
      ${recs.length ? `<div class="card">${baitSummary(recs, { limit: 4 })}</div>` : '<div class="card"><p>No patterns match.</p><p class="small muted">Try widening the temperature range or turning off “Conditions like today”.</p></div>'}
      ${recs.map((r) => `<div class="card">
        <div class="row between"><b>${esc(r.technique)}</b>${r.finish ? `<span class="pill">#${r.finish}</span>` : ''}</div>
        <div class="small muted">${esc(r.date)} · ${esc(r.event)}${r.water_temp_f != null ? ` · ${r.water_temp_f}°F` : ''}${r.section ? ` · ${esc(sectionName[r.section] || r.section)}` : ''}</div>
        <div style="margin:6px 0">${r.baits.map((b) => `<span class="pill">${esc(b)}</span>`).join('')}</div>
        <div class="small">${esc(r.summary)}</div>
        ${[r.season_phase, r.conditions?.sky, r.conditions?.wind, r.conditions?.water_color, r.conditions?.level_trend, r.conditions?.front].filter(Boolean).length
          ? `<div class="small muted" style="margin-top:6px">${[r.season_phase, r.conditions?.sky, r.conditions?.wind, r.conditions?.water_color, r.conditions?.level_trend, r.conditions?.front].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
        <div class="source"><a href="${esc(r.source_url)}" target="_blank" rel="noopener">Source</a></div></div>`).join('')}`;
  }

  $('#f-today').addEventListener('change', (e) => { state.likeToday = e.target.checked; apply(); });
  $('#f-months').addEventListener('change', (e) => { state.months = [...e.target.selectedOptions].map((o) => +o.value); apply(); });
  $('#f-tmin').addEventListener('input', (e) => { state.tempMin = e.target.value.replace(/[^\d.]/g, ''); apply(); });
  $('#f-tmax').addEventListener('input', (e) => { state.tempMax = e.target.value.replace(/[^\d.]/g, ''); apply(); });
  $('#f-tech').addEventListener('change', (e) => { state.technique = e.target.value; apply(); });
  $('#f-section').addEventListener('change', (e) => { state.section = e.target.value; apply(); });
  $('#f-color').addEventListener('change', (e) => { state.waterColor = e.target.value; apply(); });
  $('#f-reset').addEventListener('click', () => { Object.assign(state, { likeToday: true, months: [], tempMin: '', tempMax: '', technique: '', section: '', waterColor: '' }); render(root, ctx); });
  apply();
}
