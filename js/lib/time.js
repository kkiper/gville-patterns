// Time helpers for America/Chicago local times written as 'YYYY-MM-DDTHH:MM'.
export const TZ = 'America/Chicago';

function offsetMinutes(date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' }).formatToParts(date);
  const m = /GMT([+-]\d+)(?::(\d+))?/.exec(parts.find((p) => p.type === 'timeZoneName').value);
  return m ? Number(m[1]) * 60 + Math.sign(Number(m[1])) * Number(m[2] || 0) : 0;
}

export function chicagoToDate(local) {
  const asUtc = Date.parse(local + ':00Z');
  let t = asUtc - offsetMinutes(new Date(asUtc)) * 60000;
  t = asUtc - offsetMinutes(new Date(t)) * 60000; // second pass settles DST edges
  return new Date(t);
}

export function chicagoDateString(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
