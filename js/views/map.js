// Map: lake sections, Best Areas heat, wind exposure with a forecast-hour slider.
import { exposure } from '../lib/exposure.js';
import { likeToday, sectionCounts, filterPatterns, heatLevels } from '../lib/patterns.js';
import { haversineMiles } from '../lib/geo.js';
import { loadCatches } from '../store.js';
import { chicagoToDate } from '../lib/time.js';
import * as sheet from './sheet.js';
import { esc, dash, compass, fmtTime, baitSummary, currentWaterTemp, currentHourIndex } from './common.js';

const LAYERS = { sections: 'Sections', heat: 'Best Areas', wind: 'Wind' };
const on = { sections: true, heat: true, wind: false };
const EXPOSURE_COLOR = { windblown: '#ff6b6b', partial: '#ffb547', calm: null };

export async function render(root, ctx) {
  const { sections, sectionFetch, weather, patterns } = ctx.data;
  root.innerHTML = `<div class="map-wrap"><div id="map"></div>
    <div class="map-title">G-Ville Patterns<div class="small muted" id="heat-note" style="font-weight:400"></div></div>
    <div class="layer-picker">${Object.entries(LAYERS).map(([k, v]) => `<button data-layer="${k}" class="${on[k] ? 'on' : ''}">${v}</button>`).join('')}</div>
    <div class="time-slider" hidden><div class="row between small"><span id="slider-label"></span><span class="muted" id="slider-wind"></span></div>
      <input type="range" id="slider" min="0" value="0"></div></div>`;

  if (!window.L) {
    root.querySelector('#map').innerHTML = '<div class="page"><p class="muted">The map library didn\'t load. Connect to the internet once so it can be saved for offline use.</p></div>';
    return;
  }
  const map = L.map('map', { zoomControl: false, attributionControl: true }).setView([34.40, -86.27], 11);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18, subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  }).addTo(map);

  const hours = weather?.hours || [];
  let hourIdx = currentHourIndex(hours, ctx.now);
  const matches = likeToday(patterns || [], { date: ctx.now, waterTempF: currentWaterTemp(ctx.data) });
  const heat = heatLevels(sectionCounts(matches));
  const catches = await loadCatches().catch(() => []);
  const group = L.layerGroup().addTo(map);
  root.querySelector('#heat-note').textContent = heat.levels && Object.keys(heat.levels).length
    ? `Best Areas: ${heat.total} of ${matches.length} matching patterns name a section`
    : `Best Areas: too few patterns this time of year name a section (${heat.total})`;

  const exposureFor = (s) => {
    const h = hours[hourIdx];
    return exposure(sectionFetch?.fetch?.[s.id], h?.windFromDeg, h?.windMph);
  };

  function draw() {
    group.clearLayers();
    for (const s of sections || []) {
      const ex = on.wind ? exposureFor(s) : null;
      const level = heat.levels[s.id] || 0; // 0..5
      const circle = L.circle(s.center, {
        radius: s.radius_mi * 1609.34,
        color: ex && EXPOSURE_COLOR[ex] ? EXPOSURE_COLOR[ex] : on.sections ? '#8fa3b8' : 'transparent',
        weight: ex && EXPOSURE_COLOR[ex] ? 3 : 1,
        fillColor: '#3ddc97',
        fillOpacity: on.heat ? [0.03, 0.12, 0.22, 0.32, 0.42, 0.55][level] : 0.02,
      }).addTo(group);
      if (on.sections) circle.bindTooltip(esc(s.name), { permanent: true, direction: 'center', className: 'section-label' });
      circle.on('click', () => openSection(s));
    }
  }

  function openSection(s) {
    const h = hours[hourIdx];
    const ex = exposureFor(s);
    const here = filterPatterns(matches, { section: s.id });
    const all = filterPatterns(patterns || [], { section: s.id }).sort((a, b) => b.date.localeCompare(a.date));
    const mine = catches.filter((c) => haversineMiles(c.latlng, s.center) <= s.radius_mi);
    sheet.open(`
      <h3 style="margin:4px 0">${esc(s.name)}</h3>
      <p class="small muted">${s.source.startsWith('approximate') ? 'Location approximate — verify on the water. ' : ''}</p>
      <div class="card"><div class="row between"><b>Wind now</b>
        <span class="pill ${ex === 'windblown' ? '' : 'accent'}">${ex ? ex : '—'}</span></div>
        <div class="small muted">${h ? `${dash(h.windMph, ' mph')} from ${compass(h.windFromDeg)} · ${fmtTime(chicagoLocal(h.time), { weekday: 'short', hour: 'numeric' })}` : 'No forecast loaded'}
        ${ex == null && sectionFetch ? '<br>Wind exposure unavailable for this spot.' : ''}${!sectionFetch ? '<br>Lake outline not built yet; wind exposure appears after the first data update.' : ''}</div></div>
      <h2>Baits in conditions like today</h2>${baitSummary(here.length >= 3 ? here : matches)}
      ${here.length < 3 ? '<p class="small muted">(Lake-wide — too few matches in this section.)</p>' : ''}
      <h2>Tournament patterns here (${all.length})</h2>
      ${all.slice(0, 5).map((r) => `<div class="card small"><b>${esc(r.date.slice(0, 7))} · ${esc(r.technique)}</b>${r.finish ? ` <span class="pill">#${r.finish}</span>` : ''}<br>${esc(r.summary)} <a href="${esc(r.source_url)}" target="_blank" rel="noopener">Source</a></div>`).join('') || '<p class="muted small">None recorded for this section yet.</p>'}
      <h2>Your catches here (${mine.length})</h2>
      ${mine.slice(0, 5).map((c) => `<div class="small">${fmtTime(c.time, { month: 'short', day: 'numeric' })} · ${esc(c.species || '')} ${c.weightLb ? c.weightLb + ' lb' : ''} · ${esc(c.bait || '')}</div>`).join('') || '<p class="muted small">None yet.</p>'}
    `);
  }

  // Slider over forecast hours (only while the Wind layer is on).
  const sliderBox = root.querySelector('.time-slider');
  const slider = root.querySelector('#slider');
  slider.max = Math.max(0, hours.length - 1);
  slider.value = hourIdx;
  function updateSlider() {
    const h = hours[hourIdx];
    root.querySelector('#slider-label').textContent = h ? fmtTime(chicagoLocal(h.time), { weekday: 'short', hour: 'numeric' }) : 'No forecast';
    root.querySelector('#slider-wind').textContent = h ? `${dash(h.windMph, ' mph')} ${compass(h.windFromDeg)}` : '';
  }
  slider.addEventListener('input', () => { hourIdx = +slider.value; updateSlider(); draw(); });

  root.querySelectorAll('.layer-picker button').forEach((b) => b.addEventListener('click', () => {
    on[b.dataset.layer] = !on[b.dataset.layer];
    b.classList.toggle('on', on[b.dataset.layer]);
    sliderBox.hidden = !on.wind;
    draw();
  }));
  sliderBox.hidden = !on.wind;
  updateSlider();
  draw();
  setTimeout(() => map.invalidateSize(), 50);
}

// Forecast hour strings are Chicago-local; turn them into a Date for display.
function chicagoLocal(t) { return chicagoToDate(t); }
