// Solunar periods from a low-precision lunar position (accurate to roughly a degree,
// i.e. a few minutes in timing — fine for fishing windows).
const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J2000 = Date.UTC(2000, 0, 1, 12);
const SYNODIC = 29.530588853;
const REF_NEW_MOON = Date.parse('2000-01-06T18:14:00Z');
const RISE_ALT = 0.125;
const STEP_MS = 5 * 60000;

export function moonPhase(date) {
  const p = ((date.getTime() - REF_NEW_MOON) / DAY_MS / SYNODIC) % 1;
  return p < 0 ? p + 1 : p;
}

export function moonAltitude(date, lat, lng) {
  const d = (date.getTime() - J2000) / DAY_MS;
  const L = RAD * (218.316 + 13.176396 * d);
  const M = RAD * (134.963 + 13.064993 * d);
  const F = RAD * (93.272 + 13.22935 * d);
  const l = L + RAD * 6.289 * Math.sin(M);
  const b = RAD * 5.128 * Math.sin(F);
  const e = RAD * 23.4397;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const H = RAD * (280.16 + 360.9856235 * d) + RAD * lng - ra;
  const phi = RAD * lat;
  return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / RAD;
}

function refineExtremum(f, t0, t1, isMax) {
  for (let i = 0; i < 40; i++) {
    const a = t0 + (t1 - t0) / 3, b = t1 - (t1 - t0) / 3;
    const better = isMax ? f(a) > f(b) : f(a) < f(b);
    if (better) t1 = b; else t0 = a;
  }
  return (t0 + t1) / 2;
}

function refineCrossing(f, t0, t1) {
  for (let i = 0; i < 40; i++) {
    const m = (t0 + t1) / 2;
    if (Math.sign(f(m)) === Math.sign(f(t0))) t0 = m; else t1 = m;
  }
  return (t0 + t1) / 2;
}

export function solunarPeriods(dayStart, lat, lng) {
  const start = dayStart.getTime();
  const end = start + DAY_MS;
  const alt = (t) => moonAltitude(new Date(t), lat, lng);
  const out = [];
  const add = (type, center, halfMs) => {
    if (center >= start && center < end) out.push({ type, start: new Date(center - halfMs), end: new Date(center + halfMs) });
  };
  let prev2 = alt(start - 2 * STEP_MS), prev = alt(start - STEP_MS);
  for (let t = start; t <= end + STEP_MS; t += STEP_MS) {
    const cur = alt(t);
    const tm = t - STEP_MS; // time of `prev`
    if (prev > prev2 && prev >= cur) add('major', refineExtremum(alt, tm - STEP_MS, t, true), 3600000);
    if (prev < prev2 && prev <= cur) add('major', refineExtremum(alt, tm - STEP_MS, t, false), 3600000);
    if ((prev - RISE_ALT) * (cur - RISE_ALT) < 0) add('minor', refineCrossing((x) => alt(x) - RISE_ALT, tm, t), 1800000);
    prev2 = prev; prev = cur;
  }
  return out.sort((a, b) => a.start - b.start);
}
