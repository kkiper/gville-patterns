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
      <div class="row between"><b>${esc(c.species || 'Bass')}${c.weightLb ? ` · ${c.weightLb} lb` : ''}</b><span class="muted">${fmtTime(c.time, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div>
      <div>${esc(c.bait || '')}${c.notes ? ` — ${esc(c.notes)}` : ''}</div>
      <div class="muted" style="margin-top:4px">${dash(c.conditions?.tempF, '°')} air · ${dash(c.conditions?.windMph, ' mph')} ${compass(c.conditions?.windFromDeg)} · ${dash(c.conditions?.pressureHpa != null ? Math.round(c.conditions.pressureHpa) : null, ' hPa')} · pool ${dash(c.conditions?.poolFt, ' ft')} · water ${dash(c.conditions?.waterTempF, '°')}</div>
    </div>`).join('') || '<p class="muted small">No catches yet. Logged catches save the weather and water conditions automatically.</p>'}
  </div>`;

  const msg = (t, bad) => { const m = root.querySelector('#msg'); m.textContent = t; m.style.color = bad ? 'var(--bad)' : 'var(--accent)'; };

  root.querySelector('#new').addEventListener('click', () => openForm(ctx, () => render(root, ctx)));

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

function openForm(ctx, done) {
  const body = sheet.open(`<h3 style="margin:4px 0">Log a catch</h3>
    <p class="small muted" id="loc-status">Getting your location…</p>
    <div id="pick" style="height:200px;border-radius:12px;overflow:hidden;display:none"></div>
    <label>Species</label><select id="c-species">${SPECIES.map((s) => `<option>${s}</option>`).join('')}</select>
    <label>Weight (lb)</label><input id="c-weight" inputmode="decimal" placeholder="e.g. 4.5">
    <label>Bait</label><input id="c-bait" placeholder="e.g. red lipless">
    <label>Notes (water temp, depth, cover…)</label><textarea id="c-notes" rows="2"></textarea>
    <button class="btn" id="c-save" style="width:100%;margin-top:12px" disabled>Save</button>`);
  let latlng = null;
  const status = body.querySelector('#loc-status');
  const save = body.querySelector('#c-save');
  const setLoc = (ll, how) => { latlng = ll; save.disabled = false; status.textContent = `Location: ${how} (${ll[0].toFixed(4)}, ${ll[1].toFixed(4)})`; };

  function pickOnMap(reason) {
    status.textContent = `${reason} Tap where you caught it.`;
    const box = body.querySelector('#pick');
    if (!window.L) { status.textContent = `${reason} The map isn't available offline yet, so this catch can't be placed.`; return; }
    box.style.display = 'block';
    const m = L.map(box, { zoomControl: false }).setView([34.40, -86.27], 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 18 }).addTo(m);
    let marker = null;
    m.on('click', (e) => {
      const ll = [e.latlng.lat, e.latlng.lng];
      marker ? marker.setLatLng(e.latlng) : (marker = L.marker(e.latlng).addTo(m));
      setLoc(ll, 'picked on map');
    });
    setTimeout(() => m.invalidateSize(), 300);
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (p) => setLoc([p.coords.latitude, p.coords.longitude], 'GPS'),
      () => pickOnMap('Location unavailable.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  } else pickOnMap('This device has no GPS access.');

  save.addEventListener('click', async () => {
    const c = makeCatch({
      latlng,
      species: body.querySelector('#c-species').value,
      weightLb: body.querySelector('#c-weight').value,
      bait: body.querySelector('#c-bait').value.trim(),
      notes: body.querySelector('#c-notes').value.trim(),
      now: new Date(), weather: ctx.data.weather, water: ctx.data.water,
    });
    await saveCatch(c);
    sheet.close();
    done();
  });
}
