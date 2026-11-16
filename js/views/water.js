// Water: generation, pool elevation (with operating band), Scottsboro stage, discharge, water temp.
import { esc, fmtTime } from './common.js';
import { releaseTrend } from '../lib/water.js';

function sparkline(observed, forecast, band) {
  const pts = [...observed.map((p) => ({ ...p, f: false })), ...forecast.map((p) => ({ ...p, f: true }))];
  if (pts.length < 2) return '';
  const W = 320, H = 90, P = 6;
  const t0 = Date.parse(pts[0].time), t1 = Date.parse(pts[pts.length - 1].time);
  const vals = pts.map((p) => p.value).concat(band ? [band.lo, band.hi] : []);
  const lo = Math.min(...vals) - 0.1, hi = Math.max(...vals) + 0.1;
  const x = (t) => P + ((Date.parse(t) - t0) / Math.max(1, t1 - t0)) * (W - 2 * P);
  const y = (v) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const path = (arr) => arr.map((p, i) => `${i ? 'L' : 'M'}${x(p.time).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const obs = pts.filter((p) => !p.f), fc = pts.filter((p) => p.f);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Elevation trend">
    ${band ? `<rect x="${P}" y="${y(band.hi)}" width="${W - 2 * P}" height="${Math.max(1, y(band.lo) - y(band.hi))}" fill="rgba(61,220,151,.08)"/>` : ''}
    <path d="${path(obs)}" fill="none" stroke="#3ddc97" stroke-width="2"/>
    ${fc.length ? `<path d="${path([obs[obs.length - 1] || fc[0], ...fc])}" fill="none" stroke="#3ddc97" stroke-width="2" stroke-dasharray="4 4" opacity=".7"/>` : ''}
  </svg>`;
}

const latest = (arr) => (arr?.length ? arr[arr.length - 1] : null);
const unavailable = (what) => `<p class="muted small">${what} isn't available right now.</p>`;

export function render(root, ctx) {
  const w = ctx.data.water;
  const pool = w?.pool, sb = w?.scottsboro, tw = w?.tailwater;
  const rel = releaseTrend(tw?.observed);
  const band = w?.operatingBand;
  const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'numeric' }).format(ctx.now));
  const summer = month >= 6 && month <= 9;
  const bandNow = band ? (summer ? { lo: band.summerMin, hi: band.summerMax } : { lo: band.winterMin, hi: band.summerMin }) : null;
  const p = latest(pool?.observed);

  root.innerHTML = `<div class="page"><h1>Water</h1>
    <div class="card"><div class="row between"><h3>Dam releases</h3>
      <span class="pill ${rel?.trend === 'rising' ? 'accent' : ''}">${rel ? { rising: '↗ Increasing', falling: '↘ Dropping', steady: '→ Steady' }[rel.trend] : '—'}</span></div>
      ${rel ? `<p class="small">Tailwater below the dam ${rel.trend === 'steady' ? 'is holding steady' : `${rel.trend === 'rising' ? 'rose' : 'fell'} ${Math.abs(rel.changeFt).toFixed(2)} ft`} over the last 3 hours (now ${rel.latest.value.toFixed(2)} ft). ${rel.trend === 'rising' ? 'TVA is releasing more water: expect current on the main river and ledges.' : rel.trend === 'falling' ? 'Releases are tapering off: current is slowing.' : ''}</p>` : '<p class="small muted">Tailwater reading unavailable right now.</p>'}
      ${tw ? sparkline(tw.observed.slice(-48), [], null) : ''}
      <p class="source">NOAA gauge GVDA1, below Guntersville Dam${rel ? ` · ${fmtTime(rel.latest.time, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}<br>
      Exact schedule: <a href="https://www.tva.com/environment/lake-levels/guntersville" target="_blank" rel="noopener">TVA Lake Levels</a> · <a href="https://www.tva.com/environment/lake-levels/tva-lake-info-app" target="_blank" rel="noopener">TVA Lake Info app</a></p>
    </div>
    <div class="card"><div class="row between"><h3>Pool elevation</h3><span class="big">${p ? p.value.toFixed(2) : '—'}<span class="muted small"> ft</span></span></div>
      ${pool ? sparkline(pool.observed.slice(-48), pool.forecast, bandNow) : unavailable('Pool elevation')}
      ${bandNow ? `<p class="small muted">Shaded band: typical ${summer ? 'summer' : 'winter–spring'} range ${bandNow.lo}–${bandNow.hi} ft. Dashed line is the forecast.</p>` : ''}
      <p class="source">NOAA gauge GVHA1 (Guntersville Dam headwater; data from TVA)${p ? ` · ${fmtTime(p.time, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}</p></div>
    <div class="card"><div class="row between"><h3>Scottsboro</h3><span class="big">${latest(sb?.observed) ? latest(sb.observed).value.toFixed(2) : '—'}<span class="muted small"> ${esc(sb?.units || 'ft')}</span></span></div>
      ${sb ? sparkline(sb.observed.slice(-48), sb.forecast, null) : unavailable('The Scottsboro reading')}
      <p class="source">NOAA gauge SCRA1${latest(sb?.observed) ? ` · ${fmtTime(latest(sb.observed).time, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}</p></div>
    <div class="card"><div class="row between"><h3>Water temp</h3><span class="big">—</span></div>
      <p class="small muted">No gauge on Guntersville reports live water temperature. Log yours from the boat in the Log tab notes.</p></div>
    ${w?.carried?.length ? `<p class="small" style="color:var(--warn)">Couldn't refresh ${w.carried.map(esc).join(', ')} this hour; showing the last good reading (see its time).</p>` : ''}
    ${w?.sourceErrors?.length ? `<p class="small muted">Last update missed: ${w.sourceErrors.map(esc).join('; ')}</p>` : ''}
    ${!w ? '<p class="muted">Water data appears after the hourly data update runs.</p>' : ''}
  </div>`;
}
