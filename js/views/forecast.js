// Forecast: 7 day cards with a bite rating; tap a day for hourly detail.
import { solunarPeriods, moonPhase } from '../lib/solunar.js';
import { dayRating, hourScore } from '../lib/bite.js';
import { likeToday } from '../lib/patterns.js';
import { chicagoToDate } from '../lib/time.js';
import * as sheet from './sheet.js';
import { esc, dash, compass, fmtTime, dots, baitSummary, currentWaterTemp } from './common.js';

const LAT = 34.40, LNG = -86.27;
const round = (v) => (v == null ? null : Math.round(v));

function dayStats(day) {
  const n = (k) => day.hours.map((h) => h[k]).filter((v) => v != null);
  const temps = n('tempF'), winds = n('windMph'), press = n('pressureHpa');
  const dirs = day.hours.filter((h) => h.windFromDeg != null && h.windMph != null);
  // Wind-speed-weighted mean direction.
  const x = dirs.reduce((s, h) => s + Math.sin((h.windFromDeg * Math.PI) / 180) * h.windMph, 0);
  const y = dirs.reduce((s, h) => s + Math.cos((h.windFromDeg * Math.PI) / 180) * h.windMph, 0);
  return {
    hi: temps.length ? round(Math.max(...temps)) : null,
    lo: temps.length ? round(Math.min(...temps)) : null,
    windLo: winds.length ? round(Math.min(...winds)) : null,
    windHi: winds.length ? round(Math.max(...winds)) : null,
    windDir: dirs.length ? ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360 : null,
    pressTrend: press.length > 1 ? press[press.length - 1] - press[0] : null,
  };
}

const trendArrow = (t) => (t == null ? '—' : t <= -2 ? '↘ falling' : t >= 2 ? '↗ rising' : '→ steady');
const windArrow = (deg) => (deg == null ? '' : `<span class="arrow" style="transform:rotate(${deg + 180}deg)">↑</span>`);

export function render(root, ctx) {
  const w = ctx.data.weather;
  const days = w?.days || [];
  const hours = w?.hours || [];
  const matches = likeToday(ctx.data.patterns || [], { date: ctx.now, waterTempF: currentWaterTemp(ctx.data) });
  const cards = days.slice(0, 7).map((d) => {
    const periods = solunarPeriods(chicagoToDate(`${d.date}T00:00`), LAT, LNG);
    return { d, s: dayStats(d), r: dayRating(d, hours, periods), periods };
  });

  root.innerHTML = `<div class="page"><h1>Forecast</h1>
    ${cards.length ? `<div class="strip">${cards.map(({ d, s, r }, i) => `
      <button class="day" data-i="${i}">
        <div class="name">${i === 0 ? 'Today' : fmtTime(`${d.date}T12:00:00-06:00`, { weekday: 'short' })}</div>
        <div class="muted small">${fmtTime(`${d.date}T12:00:00-06:00`, { month: 'short', day: 'numeric' })}</div>
        <div class="big" style="font-size:20px;margin:6px 0">${dash(s.hi, '°')}<span class="muted" style="font-size:14px"> / ${dash(s.lo, '°')}</span></div>
        <div class="small">${windArrow(s.windDir)} ${s.windLo == null ? '—' : `${s.windLo}–${s.windHi}`} mph</div>
        <div class="small muted">${trendArrow(s.pressTrend)}</div>
        <div style="margin-top:6px">${dots(r.score)}</div>
      </button>`).join('')}</div>` : '<div class="card"><p>No forecast loaded yet.</p><p class="small muted">The forecast appears after the hourly data update runs.</p></div>'}
    <p class="small muted">Bite rating: starts at 3; +1 falling pressure, +1 wind 5–15 mph, +1 major moon period (+½ minor); −1 fast-rising pressure, −1 wind over 20 mph.</p>
    <h2>Patterns like today</h2><div class="card">${baitSummary(matches)}</div>
    <p class="source">Forecast: ${esc(w?.source || 'Open-Meteo')}${w?.updated ? ` · updated ${fmtTime(w.updated, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}</p>
  </div>`;

  root.querySelectorAll('.day').forEach((b) => b.addEventListener('click', () => {
    const { d, r, periods } = cards[+b.dataset.i];
    const best = r.bestHour ? hourScore(hours, hours.findIndex((h) => h.time === r.bestHour), periods) : null;
    sheet.open(`
      <h3 style="margin:4px 0">${fmtTime(`${d.date}T12:00:00-06:00`, { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
      <p class="small">${r.bestHour ? `Best hour ${fmtTime(chicagoToDate(r.bestHour), { hour: 'numeric' })} ${dots(r.score)}` : 'No daytime hours'}<br>
      <span class="muted">${best?.reasons.length ? best.reasons.map(esc).join(' · ') : 'No factors moved the rating.'}</span></p>
      <p class="small"><b>Moon</b> ${Math.round(moonPhase(chicagoToDate(`${d.date}T12:00`)) * 100)}% through cycle<br>
      ${periods.map((p) => `${p.type === 'major' ? 'Major' : 'Minor'} ${fmtTime(p.start)}–${fmtTime(p.end)}`).join('<br>') || '—'}</p>
      <table class="hours"><tr><th>Time</th><th>Temp</th><th>Wind</th><th>Press.</th><th>Bite</th></tr>
      ${d.hours.map((h) => {
        const i = hours.findIndex((x) => x.time === h.time);
        const sc = hourScore(hours, i, periods);
        return `<tr><td>${fmtTime(chicagoToDate(h.time), { hour: 'numeric' })}</td><td>${dash(round(h.tempF), '°')}</td>
          <td>${dash(round(h.windMph))} ${compass(h.windFromDeg)}</td><td>${dash(round(h.pressureHpa))}</td><td>${sc.score}</td></tr>`;
      }).join('')}</table>`);
  }));
}
