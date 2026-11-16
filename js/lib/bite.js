// Simple, explainable bite rating. Every point added or removed comes with a reason.
import { chicagoToDate } from './time.js';

const PRESSURE_STEP_HPA = 2;

export function hourScore(hours, i, periods) {
  const h = hours[i];
  const reasons = [];
  let score = 3;
  if (h.pressureHpa == null) reasons.push('No pressure data');
  else if (i < 6 || hours[i - 6]?.pressureHpa == null) reasons.push('Not enough pressure history');
  else {
    const trend = h.pressureHpa - hours[i - 6].pressureHpa;
    if (trend <= -PRESSURE_STEP_HPA) { score += 1; reasons.push('Pressure falling'); }
    else if (trend >= PRESSURE_STEP_HPA) { score -= 1; reasons.push('Pressure rising fast'); }
  }
  if (h.windMph != null) {
    if (h.windMph >= 5 && h.windMph <= 15) { score += 1; reasons.push('Wind making chop'); }
    else if (h.windMph > 20) { score -= 1; reasons.push('Too windy'); }
  }
  const t = chicagoToDate(h.time);
  const inside = (type) => periods.some((p) => p.type === type && t >= p.start && t <= p.end);
  if (inside('major')) { score += 1; reasons.push('Major solunar period'); }
  else if (inside('minor')) { score += 0.5; reasons.push('Minor solunar period'); }
  return { score: Math.min(5, Math.max(1, Math.round(score))), reasons };
}

export function dayRating(day, allHours, periods) {
  let best = null;
  for (const h of day.hours) {
    const hr = Number(h.time.slice(11, 13));
    if (hr < 6 || hr > 19) continue;
    const i = allHours.findIndex((x) => x.time === h.time);
    const r = hourScore(allHours, i, periods);
    if (!best || r.score > best.score) best = { score: r.score, bestHour: h.time, reasons: r.reasons };
  }
  return best || { score: null, bestHour: null, reasons: ['No daytime forecast hours'] };
}
