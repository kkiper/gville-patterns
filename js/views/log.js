// Log: record catches with an automatic conditions snapshot; export/import.
import { makeCatch, validateImport, mergeCatches, exportReminderDue, exportPayload } from '../lib/catches.js';
import { loadCatches, saveCatch, replaceAll, getMeta, setMeta } from '../store.js';
import * as sheet from './sheet.js';
import { esc, dash, compass, fmtTime } from './common.js';

const SPECIES = ['Largemouth', 'Spotted', 'Smallmouth', 'Other'];

export async function render(root, ctx) {
  let catches = [];
  let lastExport = null;
  try { catches = await loadCatches(); lastExport = await getMeta('lastExport'); } catch (e) { console.error(e); }

  root.innerHTML = `<div class="page"><h1>Catch log</h1>
    ${exportReminderDue(lastExport, ctx.now) && catches.length ? `<div class="card" style="border-color:var(--warn)"><b>Back up your catches</b><p class="small muted">Catches are stored only on this phone. ${lastExport ? `Last export ${fmtTime(lastExport, { month: 'short', day: 'numeric' })}.` : 'You haven\'t exported yet.'}</p></div>` : ''}
    <button class="btn" id="new" style="width:100%">+ Log a catch</button>
    <div class="row" style="margin-top:10px"><button class="btn ghost" id="export" style="flex:1">Export</button>
      <label class="btn ghost" style="flex:1;text-align:center;margin:0;color:var(--text)">Import<input type="file" id="import" accept="application/json,.json" hidden></label></div>
    <p id="msg" class="small" role="status"></p>
    <h2>${catches.length} catch${catches.length === 1 ? '' : 'es'}</h2>
    ${catches.map((c) => `<div class="card small">
      <div class="row between"><b>${esc(c.species || 'Bass')}${c.weightLb ? ` · ${esc(c.weightLb)} lb` : ''}</b><span class="muted">${fmtTime(c.time, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div>
      <div>${esc(c.bait || '')}${c.notes ? ` — ${esc(c.notes)}` : ''}</div>
      <div class="muted" style="margin-top:4px">${dash(c.conditions?.tempF, '°')} air · ${dash(c.conditions?.windMph, ' mph')} ${compass(c.conditions?.windFromDeg)} · ${dash(c.conditions?.pressureHpa != null ? Math.round(c.conditions.pressureHpa) : null, ' hPa')} · pool ${dash(c.conditions?.poolFt, ' ft')} · water ${dash(c.conditions?.waterTempF, '°')}</div>
    </div>`).join('') || '<p class="muted small">No catches yet. Logged catches save the weather and water conditions automatically.</p>'}
  </div>`;

  const msg = (t, bad) => { const m = root.querySelector('#msg'); m.textContent = t; m.style.color = bad ? 'var(--bad)' : 'var(--accent)'; };

  root.querySelector('#new').addEventListener('click', () => openForm(ctx, () => render(root, ctx), catches[0]?.latlng));

  root.querySelector('#export').addEventListener('click', async () => {
    const blob = new Blob([JSON.stringify(exportPayload(catches), null, 1)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `gville-catches-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.appendChild(a); a.click(); a.remove();
    await setMeta('lastExport', new Date().toISOString());
    msg(`Exported ${catches.length} catches.`);
  });

  root.querySelector('#import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = validateImport(await file.text());
    if (!r.ok) return msg(r.error, true);
    const m = mergeCatches(catches, r.catches);
    await replaceAll(m.merged);
    await render(root, ctx);
    msg(`${m.added} added, ${m.skipped} already here.`);
  });
}

function openForm(ctx, done, last) {
  const body = sheet.open(`<h3 style="margin:4px 0">Log a catch</h3>
    <p class="small muted" id="loc-status">Getting your location…</p>
    <div id="pick" style="height:200px;border-radius:12px;overflow:hidden;display:none"></div>
    <div class="row"><div style="flex:1"><label>Latitude</label><input id="c-lat" inputmode="decimal"></div>
      <div style="flex:1"><label>Longitude</label><input id="c-lng" inputmode="decimal"></div></div>
    ${last ? '<button class="btn ghost small" id="c-last" style="margin-top:8px">Use last catch location</button>' : ''}
    <label>Species</label><select id="c-species">${SPECIES.map((s) => `<option>${s}</option>`).join('')}</select>
    <label>Weight (lb)</label><input id="c-weight" inputmode="decimal" placeholder="e.g. 4.5">
    <label>Bait</label><input id="c-bait" placeholder="e.g. red lipless">
    <label>Notes (water temp, depth, cover…)</label><textarea id="c-notes" rows="2"></textarea>
    <button class="btn" id="c-save" style="width:100%;margin-top:12px" disabled>Save</button>`);
  let latlng = null;
  let marker = null, m = null;
  const status = body.querySelector('#loc-status');
  const save = body.querySelector('#c-save');
  const lat = body.querySelector('#c-lat'), lng = body.querySelector('#c-lng');
  const valid = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180;
  function setLoc(ll, how, fromInputs = false) {
    latlng = ll; save.disabled = false;
    status.textContent = `Location: ${how}. Tap the map or edit the numbers to adjust.`;
    if (!fromInputs) { lat.value = ll[0].toFixed(5); lng.value = ll[1].toFixed(5); }
    if (m) { marker ? marker.setLatLng(ll) : (marker = L.marker(ll).addTo(m)); }
  }
  const fromInputs = () => {
    const a = parseFloat(lat.value), b = parseFloat(lng.value);
    if (valid(a, b)) setLoc([a, b], 'entered', true); else { latlng = null; save.disabled = true; }
  };
  lat.addEventListener('input', fromInputs); lng.addEventListener('input', fromInputs);
  body.querySelector('#c-last')?.addEventListener('click', () => setLoc(last, 'last catch'));

  // Map picker is always offered when the map library is available.
  if (window.L) {
    const box = body.querySelector('#pick');
    box.style.display = 'block';
    m = L.map(box, { zoomControl: false }).setView([34.40, -86.27], 10);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Tiles &copy; Esri' }).addTo(m);
    m.on('click', (e) => setLoc([e.latlng.lat, e.latlng.lng], 'picked on map'));
    setTimeout(() => m.invalidateSize(), 300);
  }
  const noGps = (reason) => { if (!latlng) status.textContent = `${reason} ${window.L ? 'Tap the map or enter' : 'Enter'} the coordinates${last ? ', or use your last catch location' : ''}.`; };
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (p) => { if (!latlng) { setLoc([p.coords.latitude, p.coords.longitude], 'GPS'); m?.setView(latlng, 13); } },
      () => noGps('Location unavailable.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  } else noGps('This device has no GPS access.');

  save.addEventListener('click', async () => {
    const c = makeCatch({
      latlng,
      species: body.querySelector('#c-species').value,
      weightLb: body.querySelector('#c-weight').value,
      bait: body.querySelector('#c-bait').value.trim(),
      notes: body.querySelector('#c-notes').value.trim(),
      now: new Date(), weather: ctx.data.weather, water: ctx.data.water,
    });
    try {
      await saveCatch(c);
    } catch (e) {
      status.textContent = `Couldn't save: ${e.message || e}`;
      return;
    }
    sheet.close();
    done();
  });
}
