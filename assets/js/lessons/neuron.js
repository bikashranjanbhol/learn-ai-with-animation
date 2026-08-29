import { scene, controls, roundRect, clamp } from '../anim.js';

const ACTS = {
  sigmoid: { label: 'sigmoid', f: z => 1 / (1 + Math.exp(-z)), lo: 0, hi: 1 },
  tanh:    { label: 'tanh',    f: z => Math.tanh(z),           lo: -1, hi: 1 },
  relu:    { label: 'ReLU',    f: z => Math.max(0, z),         lo: 0, hi: 3 },
  step:    { label: 'step',    f: z => (z > 0 ? 1 : 0),        lo: 0, hi: 1 },
};

export default {
  id: 'neuron',
  title: 'The artificial neuron',
  minutes: 7,
  interactive: true,
  tags: ['perceptron', 'weights', 'bias', 'activation', 'relu', 'sigmoid'],
  summary: 'Multiply, add, squash. Everything else in deep learning is this one operation repeated a few billion times.',

  body: () => `
    <h2>Three steps, no more</h2>
    <p>A neuron takes some numbers in and produces one number out. It does it in three moves:</p>
    <ol>
      <li><strong>Weight</strong> each input — multiply it by a number that says how much this input matters.</li>
      <li><strong>Sum</strong> the weighted inputs and add a <strong>bias</strong>, which shifts the whole thing up or down.</li>
      <li><strong>Squash</strong> the sum through an activation function to get the output.</li>
    </ol>
    <pre><code><span class="tok-com"># the entire neuron</span>
z = w1*x1 + w2*x2 + b
y = activation(z)</code></pre>
    <p>The inputs come from the data. The weights and the bias are the parameters — the things training is allowed to change.</p>

    <h2>Tune one yourself</h2>
    <p>Drag the weights and watch the edges thicken or flip colour. Notice that a negative weight makes an input <em>push the output down</em>, and that the bias moves the output even when both inputs are zero.</p>

    <div class="demo">
      <div class="demo-head"><h4>A single neuron, live</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage"><canvas id="neuronCanvas"></canvas></div>
      <div class="demo-controls">
        <div class="ctrl"><label>input x₁ <output data-for="x1">0.00</output></label>
          <input type="range" data-key="x1" min="-1" max="1" step="0.01" value="0.7"></div>
        <div class="ctrl"><label>input x₂ <output data-for="x2">0.00</output></label>
          <input type="range" data-key="x2" min="-1" max="1" step="0.01" value="-0.4"></div>
        <div class="ctrl"><label>weight w₁ <output data-for="w1">0.00</output></label>
          <input type="range" data-key="w1" min="-3" max="3" step="0.05" value="1.6"></div>
        <div class="ctrl"><label>weight w₂ <output data-for="w2">0.00</output></label>
          <input type="range" data-key="w2" min="-3" max="3" step="0.05" value="-1.1"></div>
        <div class="ctrl"><label>bias b <output data-for="b">0.00</output></label>
          <input type="range" data-key="b" min="-2" max="2" step="0.05" value="0.3"></div>
        <div class="ctrl" style="flex:1 1 100%">
          <label>activation</label>
          <div class="pill-row" id="actPills">
            ${Object.entries(ACTS).map(([k, a], i) =>
              `<button class="pill" type="button" data-act="${k}" aria-pressed="${i === 0}">${a.label}</button>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <h2>Why squash at all?</h2>
    <p>Without the activation function a neuron is just a weighted sum — a straight line. Stack a hundred straight lines and you still have a straight line, so a deep network without activations can do no more than a single layer can. The squash is what bends the space, and bending is what lets stacked layers describe curves, corners and everything else.</p>

    <h3>The ones you will meet</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Function</th><th>Range</th><th>Used for</th></tr></thead>
      <tbody>
        <tr><td><strong>ReLU</strong> <code>max(0, z)</code></td><td>0 → ∞</td><td>The default inside hidden layers. Cheap, and it does not flatten out for large positive values.</td></tr>
        <tr><td><strong>sigmoid</strong></td><td>0 → 1</td><td>An output you want to read as a probability of one thing being true.</td></tr>
        <tr><td><strong>tanh</strong></td><td>−1 → 1</td><td>Zero-centred alternative to sigmoid; still common in recurrent models.</td></tr>
        <tr><td><strong>step</strong></td><td>0 or 1</td><td>The 1958 original. Useless for training — its slope is zero everywhere, so there is nothing to follow downhill.</td></tr>
      </tbody>
    </table></div>

    <div class="callout warn">
      <div class="callout-title">Why the step function died</div>
      <p>Training works by asking "if I nudge this weight, how does the output change?" For a step function the answer is always "not at all" — right up to the instant it flips. That flat gradient is exactly why the perceptron stalled for a decade, and why every modern activation has a usable slope.</p>
    </div>

    <h2>What a single neuron can and cannot do</h2>
    <p>One neuron draws one straight boundary through its input space. That is genuinely useful — it can separate "spam" from "not spam" on well-chosen features. But it cannot express XOR, the rule "exactly one of these two is true", because no single line separates those four points.</p>
    <p>The fix is not a cleverer neuron. It is <em>more</em> neurons, arranged in layers, which is the next lesson.</p>`,

  init(root) {
    const canvas = root.querySelector('#neuronCanvas');
    const state = { x1: 0.7, x2: -0.4, w1: 1.6, w2: -1.1, b: 0.3, act: 'sigmoid' };
    controls(root, state);

    root.querySelector('#actPills').addEventListener('click', e => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      state.act = btn.dataset.act;
      root.querySelectorAll('#actPills .pill').forEach(p => p.setAttribute('aria-pressed', String(p === btn)));
    });

    const s = scene(canvas, (ctx, { w: W, h: H, t, c }) => {
      const act = ACTS[state.act];
      const z = state.w1 * state.x1 + state.w2 * state.x2 + state.b;
      const y = act.f(z);

      const inX = 58, sumX = W * 0.44, actX = W * 0.68, outX = W - 46;
      const rows = [H * 0.34, H * 0.66];
      const midY = H * 0.5;

      const edge = (x0, y0, x1_, y1_, weight, phase) => {
        const mag = clamp(Math.abs(weight) / 3, 0.06, 1);
        ctx.strokeStyle = weight >= 0 ? c.accent2 : c.accent3;
        ctx.globalAlpha = 0.25 + 0.6 * mag;
        ctx.lineWidth = 1 + 5 * mag;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1_, y1_); ctx.stroke();
        ctx.globalAlpha = 1;
        // signal travelling along the edge
        const p = ((t * 0.5 + phase) % 1);
        ctx.fillStyle = weight >= 0 ? c.accent2 : c.accent3;
        ctx.beginPath();
        ctx.arc(x0 + (x1_ - x0) * p, y0 + (y1_ - y0) * p, 2 + 2 * mag, 0, 7);
        ctx.fill();
      };

      edge(inX + 20, rows[0], sumX - 22, midY, state.w1, 0);
      edge(inX + 20, rows[1], sumX - 22, midY, state.w2, 0.5);
      ctx.strokeStyle = c.line; ctx.lineWidth = 1.6; ctx.globalAlpha = .8;
      ctx.beginPath(); ctx.moveTo(sumX + 22, midY); ctx.lineTo(actX - 34, midY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(actX + 34, midY); ctx.lineTo(outX - 34, midY); ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.font = `500 12px ${c.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

      // input nodes
      [[state.x1, 'x₁', rows[0]], [state.x2, 'x₂', rows[1]]].forEach(([val, lbl, yy]) => {
        ctx.fillStyle = c.surface; ctx.strokeStyle = c.accent; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(inX, yy, 20, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = c.text; ctx.fillText(val.toFixed(2), inX, yy);
        ctx.fillStyle = c.muted; ctx.font = `500 11px ${c.sans}`;
        ctx.fillText(lbl, inX, yy - 31); ctx.font = `500 12px ${c.mono}`;
      });

      // weight labels
      ctx.fillStyle = c.muted; ctx.font = `500 11px ${c.mono}`;
      ctx.fillText(`w₁ ${state.w1.toFixed(2)}`, (inX + sumX) / 2, (rows[0] + midY) / 2 - 14);
      ctx.fillText(`w₂ ${state.w2.toFixed(2)}`, (inX + sumX) / 2, (rows[1] + midY) / 2 + 16);

      // summation node
      ctx.fillStyle = c.surface; ctx.strokeStyle = c.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sumX, midY, 22, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = c.text; ctx.font = `600 17px ${c.sans}`; ctx.fillText('Σ', sumX, midY + 1);
      ctx.fillStyle = c.muted; ctx.font = `500 11px ${c.mono}`;
      ctx.fillText(`+ bias ${state.b.toFixed(2)}`, sumX, midY + 38);
      ctx.fillStyle = c.accent; ctx.fillText(`z = ${z.toFixed(2)}`, (sumX + actX) / 2, midY - 16);

      // activation curve panel
      const bw = 62, bh = 62;
      const bx = actX - bw / 2, by = midY - bh / 2;
      ctx.fillStyle = c.sunken; ctx.strokeStyle = c.line; ctx.lineWidth = 1.5;
      roundRect(ctx, bx, by, bw, bh, 10); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.beginPath(); roundRect(ctx, bx, by, bw, bh, 10); ctx.clip();
      ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= bw; i++) {
        const zz = (i / bw) * 8 - 4;
        const vv = (act.f(zz) - act.lo) / (act.hi - act.lo);
        const px = bx + i, py = by + bh - 6 - vv * (bh - 12);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
      const dotX = bx + clamp((z + 4) / 8, 0, 1) * bw;
      const dotY = by + bh - 6 - clamp((y - act.lo) / (act.hi - act.lo), 0, 1) * (bh - 12);
      ctx.fillStyle = c.accent3;
      ctx.beginPath(); ctx.arc(dotX, dotY, 4.5, 0, 7); ctx.fill();
      ctx.restore();
      ctx.fillStyle = c.muted; ctx.font = `500 11px ${c.sans}`;
      ctx.fillText(act.label, actX, midY + 46);

      // output
      ctx.fillStyle = c.surface; ctx.strokeStyle = c.accent3; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(outX, midY, 24, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = c.text; ctx.font = `600 13px ${c.mono}`;
      ctx.fillText(y.toFixed(2), outX, midY);
      ctx.fillStyle = c.muted; ctx.font = `500 11px ${c.sans}`;
      ctx.fillText('output', outX, midY - 36);

      // output level bar
      const barW = 8, barH = H * 0.5;
      const bxx = outX + 30, byy = midY - barH / 2;
      ctx.fillStyle = c.sunken; roundRect(ctx, bxx, byy, barW, barH, 4); ctx.fill();
      const frac = clamp((y - act.lo) / (act.hi - act.lo), 0, 1);
      ctx.fillStyle = c.accent3;
      roundRect(ctx, bxx, byy + barH * (1 - frac), barW, barH * frac, 4); ctx.fill();
    }, { height: 270 });

    return () => s.stop();
  },
};
