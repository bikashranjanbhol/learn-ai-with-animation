/**
 * Small animation toolkit shared by the lessons:
 * DPI-aware canvas mounting, a render loop that pauses off-screen,
 * and theme-aware colour lookups.
 */

export function palette() {
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  return {
    text:   v('--text'),
    soft:   v('--text-soft'),
    muted:  v('--text-muted'),
    line:   v('--border-strong'),
    grid:   v('--border'),
    accent: v('--accent'),
    accent2: v('--accent-2'),
    accent3: v('--accent-3'),
    surface: v('--surface'),
    sunken: v('--bg-sunken'),
    mono:   '"JetBrains Mono", ui-monospace, monospace',
    sans:   '"Inter", system-ui, sans-serif',
  };
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Mount a canvas that keeps its backing store in sync with layout + DPR.
 * `frame(ctx, {w, h, t, dt, c})` is called each animation frame while visible.
 * Returns a teardown function.
 */
export function scene(canvas, frame, { height = 260, still = false } = {}) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, raf = 0, start = performance.now(), last = start, visible = true, alive = true;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width));
    h = height;
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (still) draw(performance.now());
  }

  function draw(now) {
    const t = (now - start) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, w, h);
    frame(ctx, { w, h, t, dt, c: palette() });
  }

  function loop(now) {
    if (!alive) return;
    if (visible) draw(now);
    raf = requestAnimationFrame(loop);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '120px' });
  io.observe(canvas);
  const onTheme = () => { if (still) draw(performance.now()); };
  window.addEventListener('ltb:theme', onTheme);

  resize();
  if (!still) raf = requestAnimationFrame(loop);

  return {
    redraw: () => draw(performance.now()),
    stop() {
      alive = false; cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      window.removeEventListener('ltb:theme', onTheme);
    },
  };
}

/** Rounded-rectangle path helper (Safari-safe). */
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Mix two hex/computed colours — used for heat maps. */
export function mix(a, b, t) {
  const pa = parse(a), pb = parse(b);
  return `rgb(${Math.round(lerp(pa[0], pb[0], t))},${Math.round(lerp(pa[1], pb[1], t))},${Math.round(lerp(pa[2], pb[2], t))})`;
}
function parse(col) {
  if (col.startsWith('#')) {
    const hex = col.length === 4
      ? col.slice(1).split('').map(c => c + c).join('')
      : col.slice(1);
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = col.match(/[\d.]+/g) || [0, 0, 0];
  return m.slice(0, 3).map(Number);
}

/** Wire the range inputs inside a demo to a state object + change callback. */
export function controls(root, state, onChange) {
  const inputs = [...root.querySelectorAll('input[type="range"][data-key]')];
  const sync = input => {
    const val = parseFloat(input.value);
    state[input.dataset.key] = val;
    const out = root.querySelector(`output[data-for="${input.dataset.key}"]`);
    if (out) out.textContent = Number(val).toFixed(Number(input.dataset.decimals ?? 2));
  };
  inputs.forEach(input => {
    sync(input);
    input.addEventListener('input', () => { sync(input); onChange?.(state); });
  });
  onChange?.(state);
  return state;
}
