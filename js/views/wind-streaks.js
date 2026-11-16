// Animated wind streaks drawn over the lake only. Streaks flow the way the wind blows,
// faster and denser in stronger wind.
import { downwindVector, streakSpeed, streakCount } from '../lib/wind.js';

export function createWindStreaks(map, maskGeo) {
  const container = map.getContainer();
  const canvas = document.createElement('canvas');
  canvas.className = 'wind-streaks';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const mask = document.createElement('canvas');
  const mctx = mask.getContext('2d', { willReadFrequently: true });
  const rings = (maskGeo?.geometry?.coordinates || []);
  let W = 0, H = 0, dpr = 1, water = null, waterShare = 0;
  let wind = null, parts = [], running = false, moving = false, raf = 0;

  function resize() {
    const s = map.getSize();
    W = s.x; H = s.y; dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mask.width = W; mask.height = H;
  }

  function buildMask() {
    resize();
    mctx.clearRect(0, 0, W, H);
    mctx.fillStyle = '#000';
    for (const poly of rings) {
      mctx.beginPath();
      for (const ring of poly) {
        ring.forEach(([lng, lat], i) => {
          const p = map.latLngToContainerPoint([lat, lng]);
          i ? mctx.lineTo(p.x, p.y) : mctx.moveTo(p.x, p.y);
        });
        mctx.closePath();
      }
      mctx.fill('evenodd');
    }
    const data = mctx.getImageData(0, 0, W, H).data;
    water = new Uint8Array(W * H);
    let n = 0;
    for (let i = 0; i < W * H; i++) if (data[i * 4 + 3] > 0) { water[i] = 1; n++; }
    waterShare = n / Math.max(1, W * H);
    spawnAll();
  }

  const isWater = (x, y) => x >= 0 && y >= 0 && x < W && y < H && water && water[(y | 0) * W + (x | 0)] === 1;

  function spawn(p = {}) {
    for (let tries = 0; tries < 30; tries++) {
      const x = Math.random() * W, y = Math.random() * H;
      if (isWater(x, y)) return Object.assign(p, { x, y, age: 0, life: 40 + Math.random() * 60 });
    }
    return Object.assign(p, { x: -1, y: -1, age: 0, life: 10 });
  }

  function spawnAll() {
    if (!wind) return;
    const n = Math.round(streakCount(wind.mph) * Math.min(1, waterShare * 1.5) * 0.45);
    parts = Array.from({ length: n }, () => spawn());
    ctx.clearRect(0, 0, W, H);
  }

  function frame() {
    raf = 0;
    if (!running || moving || !wind) return;
    // Fade the previous frame to leave trailing tails.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    const v = downwindVector(wind.fromDeg);
    const sp = streakSpeed(wind.mph);
    ctx.strokeStyle = 'rgba(235,245,255,0.8)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (const p of parts) {
      const nx = p.x + v.dx * sp * (0.8 + Math.random() * 0.4);
      const ny = p.y + v.dy * sp * (0.8 + Math.random() * 0.4);
      if (++p.age > p.life || !isWater(nx, ny)) { spawn(p); continue; }
      ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny);
      p.x = nx; p.y = ny;
    }
    ctx.stroke();
    raf = requestAnimationFrame(frame);
  }

  const kick = () => { if (!raf && running && !moving) raf = requestAnimationFrame(frame); };
  map.on('movestart zoomstart', () => { moving = true; ctx.clearRect(0, 0, W, H); });
  map.on('moveend zoomend resize', () => { moving = false; if (running) { buildMask(); kick(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  return {
    setWind(fromDeg, mph) {
      const was = wind;
      wind = fromDeg == null || mph == null ? null : { fromDeg, mph };
      if (!wind) { ctx.clearRect(0, 0, W, H); return; }
      if (!was || Math.abs(was.mph - wind.mph) > 2) spawnAll();
      kick();
    },
    show() { running = true; canvas.hidden = false; buildMask(); kick(); },
    hide() { running = false; canvas.hidden = true; ctx.clearRect(0, 0, W, H); },
  };
}
