// App shell: tab routing, data loading, stale-data banner, service worker.
import { loadAll, staleness } from './data.js';

const view = document.getElementById('view');
const banner = document.getElementById('banner');
const tabs = [...document.querySelectorAll('.tabs button')];
const ctx = { data: {}, now: new Date(), prefs: {} };
let current = 'map';

function updateBanner() {
  const stale = [['weather', 'Forecast'], ['water', 'Water']]
    .map(([k, label]) => ({ label, s: staleness(ctx.data[k]?.updated, ctx.now) }))
    .filter((x) => x.s.stale);
  banner.hidden = !stale.length;
  banner.textContent = stale.map((x) => `${x.label} data last updated ${x.s.label}`).join(' · ');
}

export async function showTab(name) {
  current = name;
  tabs.forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.getElementById('sheet').classList.remove('open');
  view.innerHTML = '';
  try {
    const mod = await import(`./views/${name}.js`);
    await mod.render(view, ctx);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="page"><h1>${name}</h1><p class="muted">This screen couldn't load (${e.message}).</p></div>`;
  }
}

tabs.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

async function boot() {
  ctx.data = await loadAll();
  ctx.now = new Date();
  updateBanner();
  showTab(current);
}

boot();
setInterval(async () => { ctx.data = await loadAll(); ctx.now = new Date(); updateBanner(); }, 15 * 60000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
