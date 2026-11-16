// Screen-space math for animated wind streaks (north up, y grows downward).

// Unit vector the wind blows TOWARD, given the direction it comes FROM.
export function downwindVector(windFromDeg) {
  const r = (windFromDeg * Math.PI) / 180;
  return { dx: -Math.sin(r), dy: Math.cos(r) };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Pixels per animation frame.
export const streakSpeed = (mph) => clamp(mph, 1, 40) * 0.18;

// Number of streaks on screen: calm days look sparse, windy days busy.
export const streakCount = (mph) => Math.round(clamp(60 + mph * 30, 60, 900));
