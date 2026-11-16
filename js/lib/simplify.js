// Douglas–Peucker simplification for closed [lng,lat] rings.
function perpDist(p, a, b) {
  const [x, y] = p, [x1, y1] = a, [x2, y2] = b;
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function dp(points, tol) {
  let max = 0, idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], points[0], points[points.length - 1]);
    if (d > max) { max = d; idx = i; }
  }
  if (max <= tol) return [points[0], points[points.length - 1]];
  return [...dp(points.slice(0, idx + 1), tol).slice(0, -1), ...dp(points.slice(idx), tol)];
}

export function simplifyRing(ring, tol) {
  if (ring.length <= 4) return ring;
  // Split the closed ring at its farthest point from the start so DP has a real baseline.
  let far = 1, best = 0;
  for (let i = 1; i < ring.length - 1; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (d > best) { best = d; far = i; }
  }
  const out = [...dp(ring.slice(0, far + 1), tol).slice(0, -1), ...dp(ring.slice(far), tol)];
  return out.length >= 4 ? out : ring;
}
