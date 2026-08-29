import { scene, controls, clamp } from '../anim.js';

const CURVES = {
  bowl:  { label: 'simple bowl',  f: x => 0.45 * x * x,                       d: x => 0.9 * x },
  bumpy: { label: 'local minima', f: x => 0.28 * x * x + 1.1 * Math.sin(2.2 * x), d: x => 0.56 * x + 2.42 * Math.cos(2.2 * x) },
  cliff: { label: 'steep wall',   f: x => 0.12 * x ** 4 - 0.5 * x * x + 0.3 * x, d: x => 0.48 * x ** 3 - x + 0.3 },
};

export default {
  id: 'gradient-descent',
  title: 'Gradient descent',
  minutes: 8,
  interactive: true,
  tags: ['gradient descent', 'learning rate', 'momentum', 'optimiser', 'local minimum'],
  summary: 'Stand on the loss surface, feel which way is downhill, take a step. Repeat a few million times. That is how every model you have used was trained.',

  body: () => `
    <h2>Downhill, one step at a time</h2>
    <p>The loss tells you how wrong you are. The <strong>gradient</strong> tells you something far more useful: for each parameter, which way to move it to make the loss smaller, and how urgently. Then the update rule is a single line:</p>
    <pre><code>parameter = parameter - learning_rate * gradient</code></pre>
    <p>The minus sign is the whole algorithm. The gradient points uphill, so you step against it. The learning rate decides how big that step is — and it is the one number that most often decides whether training works at all.</p>

    <h2>Roll the ball</h2>
    <p>Start with a small learning rate and watch the ball crawl. Push it past about 1.0 on the simple bowl and watch it overshoot the valley, land higher than it started, and fly off the screen. That is <strong>divergence</strong>, and it is what an exploding loss looks like in a real training run.</p>

    <div class="demo">
      <div class="demo-head"><h4>Descending a loss curve</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage"><canvas id="gdCanvas"></canvas></div>
      <div class="demo-controls">
        <div class="ctrl"><label>learning rate <output data-for="lr">0.10</output></label>
          <input type="range" data-key="lr" min="0.01" max="1.3" step="0.01" value="0.15"></div>
        <div class="ctrl"><label>momentum <output data-for="mom">0.00</output></label>
          <input type="range" data-key="mom" min="0" max="0.92" step="0.01" value="0"></div>
        <div class="ctrl" style="flex:1 1 100%"><label>loss landscape</label>
          <div class="pill-row" id="gdCurves">
            ${Object.entries(CURVES).map(([k, v], i) =>
              `<button class="pill" type="button" data-curve="${k}" aria-pressed="${i === 0}">${v.label}</button>`).join('')}
          </div></div>
        <button class="btn" id="gdRun" type="button">
          <svg viewBox="0 0 24 24"><path d="M6 4l12 8-12 8z"/></svg><span>Pause</span></button>
        <button class="btn secondary" id="gdReset" type="button">Drop again</button>
        <div class="readout"><span>step <b id="gdStep">0</b></span><span>loss <b id="gdLoss">—</b></span></div>
      </div>
    </div>

    <h2>Reading the failure modes</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Symptom</th><th>What is happening</th><th>Fix</th></tr></thead>
      <tbody>
        <tr><td>Loss creeps down forever</td><td>Learning rate too small — thousands of steps to cross one valley</td><td>Raise it; try ×3 at a time</td></tr>
        <tr><td>Loss bounces around a floor</td><td>Steps are bigger than the valley is wide</td><td>Lower it, or decay it over training</td></tr>
        <tr><td>Loss goes to <code>NaN</code></td><td>Divergence — each step overshoots harder than the last</td><td>Lower the rate, clip gradients, check for bad inputs</td></tr>
        <tr><td>Loss plateaus early</td><td>Stuck in a flat region or a local minimum</td><td>Momentum, a warm-up schedule, or a different initialisation</td></tr>
      </tbody>
    </table></div>

    <h3>What momentum does</h3>
    <p>Plain descent only knows the slope where it is standing. Momentum keeps a running average of recent steps, so the ball carries velocity: it rolls through small bumps, damps out zig-zagging across a narrow valley, and speeds up on long gentle slopes. Switch the landscape to <em>local minima</em>, set momentum to zero and watch the ball get trapped — then raise momentum and watch it roll straight through the first dip.</p>

    <div class="callout tip">
      <div class="callout-title">Adam, in one sentence</div>
      <p>Modern optimisers like Adam add momentum <em>and</em> a per-parameter step size that shrinks for parameters whose gradients are large and noisy — which is why they usually just work at a learning rate around 1e-3 while plain descent needs careful tuning.</p>
    </div>

    <h2>From one number to a billion</h2>
    <p>The picture above has one parameter, so the loss surface is a curve. With two it is a landscape; with a billion it is a surface in a billion-dimensional space that nobody can picture. Nothing about the algorithm changes: compute the slope in every direction at once, step against it, repeat.</p>
    <p>Two practicalities make it tractable:</p>
    <ul>
      <li><strong>Mini-batches.</strong> Computing the gradient over the entire dataset for every step is far too slow, so you estimate it from a few hundred examples at a time. The estimate is noisy, and that noise turns out to help the model escape bad regions.</li>
      <li><strong>Backpropagation.</strong> Getting the gradient for every one of those billion parameters efficiently is its own trick — the next lesson.</li>
    </ul>`,

  init(root) {
    const canvas = root.querySelector('#gdCanvas');
    const stepEl = root.querySelector('#gdStep');
    const lossEl = root.querySelector('#gdLoss');
    const runBtn = root.querySelector('#gdRun');

    const state = { lr: 0.15, mom: 0 };
    controls(root, state);

    let curve = 'bowl', x = -2.6, v = 0, step = 0, trail = [], running = true, acc = 0, dead = false;

    function drop() {
      x = (Math.random() < 0.5 ? -1 : 1) * (1.8 + Math.random() * 1.2);
      v = 0; step = 0; trail = []; dead = false;
    }

    function tick() {
      if (dead) return;
      const g = CURVES[curve].d(x);
      v = state.mom * v - state.lr * g;
      x += v;
      step++;
      trail.push(x);
      if (trail.length > 60) trail.shift();
      if (!isFinite(x) || Math.abs(x) > 12) dead = true;
    }

    root.querySelector('#gdCurves').addEventListener('click', e => {
      const btn = e.target.closest('[data-curve]');
      if (!btn) return;
      curve = btn.dataset.curve;
      root.querySelectorAll('#gdCurves .pill').forEach(p => p.setAttribute('aria-pressed', String(p === btn)));
      drop();
    });
    runBtn.addEventListener('click', () => {
      running = !running;
      runBtn.querySelector('span').textContent = running ? 'Pause' : 'Run';
    });
    root.querySelector('#gdReset').addEventListener('click', () => { drop(); });

    const s = scene(canvas, (ctx, { w, h, dt, c }) => {
      if (running) { acc += dt; while (acc > 0.11) { acc -= 0.11; tick(); } }

      const f = CURVES[curve].f;
      const pad = 26, X0 = -3.4, X1 = 3.4;
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i <= 120; i++) {
        const xv = X0 + (i / 120) * (X1 - X0);
        const yv = f(xv); lo = Math.min(lo, yv); hi = Math.max(hi, yv);
      }
      const PX = xv => pad + ((xv - X0) / (X1 - X0)) * (w - pad * 2);
      const PY = yv => pad + (1 - (yv - lo) / (hi - lo || 1)) * (h - pad * 2.2);

      // filled landscape
      ctx.beginPath();
      ctx.moveTo(PX(X0), h);
      for (let i = 0; i <= 160; i++) {
        const xv = X0 + (i / 160) * (X1 - X0);
        ctx.lineTo(PX(xv), PY(f(xv)));
      }
      ctx.lineTo(PX(X1), h); ctx.closePath();
      const grad = ctx.createLinearGradient(0, pad, 0, h);
      grad.addColorStop(0, c.accent); grad.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.13; ctx.fillStyle = grad; ctx.fill(); ctx.globalAlpha = 1;

      ctx.strokeStyle = c.accent; ctx.lineWidth = 2.4; ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const xv = X0 + (i / 200) * (X1 - X0);
        i ? ctx.lineTo(PX(xv), PY(f(xv))) : ctx.moveTo(PX(xv), PY(f(xv)));
      }
      ctx.stroke();

      // trail of past positions
      trail.forEach((tx, i) => {
        if (Math.abs(tx) > X1) return;
        ctx.globalAlpha = (i / trail.length) * 0.5;
        ctx.fillStyle = c.accent3;
        ctx.beginPath(); ctx.arc(PX(tx), PY(f(tx)), 3, 0, 7); ctx.fill();
      });
      ctx.globalAlpha = 1;

      const shown = clamp(x, X0 + 0.05, X1 - 0.05);
      const bx = PX(shown), by = PY(f(shown));

      // gradient arrow at the ball
      if (!dead) {
        const g = CURVES[curve].d(shown);
        const dir = -Math.sign(g);
        const len = clamp(Math.abs(g) * 26, 12, 74);
        ctx.strokeStyle = c.accent2; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(bx, by - 20); ctx.lineTo(bx + dir * len, by - 20); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx + dir * len, by - 20);
        ctx.lineTo(bx + dir * (len - 7), by - 25);
        ctx.lineTo(bx + dir * (len - 7), by - 15);
        ctx.closePath(); ctx.fillStyle = c.accent2; ctx.fill();
        ctx.font = `500 10px ${c.mono}`; ctx.fillStyle = c.muted; ctx.textAlign = 'center';
        ctx.fillText('downhill', bx + dir * len / 2, by - 28);
      }

      // ball
      ctx.beginPath(); ctx.arc(bx, by, 9, 0, 7);
      ctx.fillStyle = dead ? c.accent3 : c.accent3; ctx.fill();
      ctx.strokeStyle = c.surface; ctx.lineWidth = 2.5; ctx.stroke();

      ctx.font = `500 10px ${c.mono}`; ctx.textAlign = 'left'; ctx.fillStyle = c.muted;
      ctx.fillText('parameter value →', pad, h - 6);
      if (dead) {
        ctx.textAlign = 'center'; ctx.fillStyle = c.accent3; ctx.font = `600 13px ${c.sans}`;
        ctx.fillText('diverged — the learning rate is too high', w / 2, pad + 6);
      }
      stepEl.textContent = step;
      lossEl.textContent = dead ? 'NaN' : f(x).toFixed(3);
    }, { height: 300 });

    return () => s.stop();
  },
};
