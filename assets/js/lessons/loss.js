import { scene, controls, clamp } from '../anim.js';

export default {
  id: 'loss',
  title: 'Loss: turning "wrong" into a number',
  minutes: 6,
  interactive: true,
  tags: ['loss', 'mse', 'cross entropy', 'objective', 'residual'],
  summary: 'A model cannot improve until being wrong has a score. The loss function is that score — and choosing it decides what the model will care about.',

  body: () => `
    <h2>The measurement that makes learning possible</h2>
    <p>Training needs a single number to push downhill. That number is the <strong>loss</strong>: feed the model your examples, compare each prediction with the correct answer, and reduce all of that disagreement to one value.</p>
    <p>Two properties make a loss usable:</p>
    <ul>
      <li><strong>Lower is better</strong>, always, with no exceptions to remember.</li>
      <li><strong>It has a slope.</strong> Nudging any parameter must change the loss a little, so the model can tell which direction helps.</li>
    </ul>

    <h2>Feel the loss surface</h2>
    <p>The left panel fits a line to some data; the grey stalks are <strong>residuals</strong>, the error on each point. The right panel plots the loss for every possible slope — the model's whole world, drawn out. Drag the slope and watch your position on that curve.</p>

    <div class="demo">
      <div class="demo-head"><h4>Fit and loss, side by side</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage"><canvas id="lossCanvas"></canvas></div>
      <div class="demo-controls">
        <div class="ctrl"><label>slope <output data-for="slope">1.00</output></label>
          <input type="range" data-key="slope" min="-0.5" max="2.5" step="0.01" value="0.35"></div>
        <div class="ctrl"><label>intercept <output data-for="intercept">0.00</output></label>
          <input type="range" data-key="intercept" min="-1" max="1" step="0.01" value="0.35"></div>
        <button class="btn secondary" id="lossBest" type="button">Snap to best fit</button>
        <div class="readout"><span>MSE <b id="lossVal">—</b></span></div>
      </div>
    </div>

    <p>Notice the shape: one valley, steep sides, a flat bottom. Steep means "you are badly wrong and a small change helps a lot." Flat means "you are close; slow down." Gradient descent, next lesson, is nothing more than walking that shape.</p>

    <h2>The two losses you will use constantly</h2>

    <h3>Mean squared error — for predicting a quantity</h3>
    <pre><code>MSE = mean((prediction - target)²)</code></pre>
    <p>Squaring does two jobs: it makes over- and under-shooting equally bad, and it punishes big misses disproportionately. One prediction that is 10 off hurts as much as a hundred that are 1 off. That is sometimes what you want — and sometimes it means a single mislabelled outlier drags your whole model sideways.</p>

    <h3>Cross-entropy — for predicting a category</h3>
    <pre><code>CE = -log(probability the model gave to the correct answer)</code></pre>
    <p>Confidently right costs almost nothing. Confidently wrong costs enormously — as the probability of the true answer approaches zero, the loss climbs without limit. It is the right shape for classification precisely because it punishes arrogance, and it is the loss every language model is trained on.</p>

    <div class="table-wrap"><table>
      <thead><tr><th>Probability given to the right answer</th><th>Cross-entropy loss</th></tr></thead>
      <tbody>
        <tr><td>0.99</td><td>0.01 — essentially free</td></tr>
        <tr><td>0.50</td><td>0.69</td></tr>
        <tr><td>0.10</td><td>2.30</td></tr>
        <tr><td>0.01</td><td>4.61 — painful</td></tr>
      </tbody>
    </table></div>

    <div class="callout">
      <div class="callout-title">The loss is your specification</div>
      <p>A model does not optimise what you meant. It optimises the number you wrote down. If your loss treats every mistake equally but your users are hurt far more by one kind of mistake, the model will happily make the expensive one — and it will look correct on your metrics while doing it.</p>
    </div>

    <h2>Training loss and the loss you actually care about</h2>
    <p>The loss used for training must be smooth and differentiable. The thing you care about — accuracy, revenue, whether someone found the answer useful — usually is not. So you train on a smooth stand-in and <em>evaluate</em> on the real thing, and keep an eye on the gap between them. When training loss drops while your evaluation metric stalls, the model is learning the stand-in rather than the goal.</p>`,

  init(root) {
    const canvas = root.querySelector('#lossCanvas');
    const valEl = root.querySelector('#lossVal');
    const state = { slope: 0.35, intercept: 0.35 };

    const pts = Array.from({ length: 22 }, () => {
      const x = Math.random();
      return { x, y: clamp(0.18 + 1.35 * x + (Math.random() - 0.5) * 0.3, 0.02, 0.98) };
    });
    const mse = (m, b) => pts.reduce((s, p) => s + (m * p.x + b - p.y) ** 2, 0) / pts.length;

    controls(root, state, () => { valEl.textContent = mse(state.slope, state.intercept).toFixed(4); });

    root.querySelector('#lossBest').addEventListener('click', () => {
      // closed-form least squares, so the "best" is honest
      const n = pts.length;
      const sx = pts.reduce((s, p) => s + p.x, 0), sy = pts.reduce((s, p) => s + p.y, 0);
      const sxy = pts.reduce((s, p) => s + p.x * p.y, 0), sxx = pts.reduce((s, p) => s + p.x * p.x, 0);
      const m = (n * sxy - sx * sy) / (n * sxx - sx * sx);
      const b = (sy - m * sx) / n;
      const setEl = (key, v) => {
        const input = root.querySelector(`input[data-key="${key}"]`);
        input.value = String(clamp(v, +input.min, +input.max));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
      setEl('slope', m); setEl('intercept', b);
    });

    const s = scene(canvas, (ctx, { w, h, c }) => {
      const gap = 26, half = (w - gap) / 2, pad = 30;

      /* --- left: the fit --- */
      const gw = half - pad * 1.4, gh = h - pad * 1.8;
      const X = v => pad + v * gw, Y = v => pad * 0.7 + (1 - v) * gh;
      ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(X(0), Y(i / 4)); ctx.lineTo(X(1), Y(i / 4)); ctx.stroke();
      }
      // residual stalks
      ctx.strokeStyle = c.accent3; ctx.globalAlpha = .55; ctx.lineWidth = 1.4;
      for (const p of pts) {
        const pred = state.slope * p.x + state.intercept;
        ctx.beginPath(); ctx.moveTo(X(p.x), Y(p.y)); ctx.lineTo(X(p.x), Y(clamp(pred, -0.2, 1.2))); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.accent; ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(X(0), Y(clamp(state.intercept, -0.25, 1.25)));
      ctx.lineTo(X(1), Y(clamp(state.slope + state.intercept, -0.25, 1.25)));
      ctx.stroke();
      ctx.fillStyle = c.accent2;
      for (const p of pts) { ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 4, 0, 7); ctx.fill(); }
      ctx.fillStyle = c.muted; ctx.font = `500 10px ${c.mono}`; ctx.textAlign = 'left';
      ctx.fillText('data + current line', pad, h - 8);

      /* --- right: the loss curve --- */
      const ox = half + gap;
      const lw = half - pad * 1.2, lh = gh;
      const LX = v => ox + ((v + 0.5) / 3) * lw;      // slope range -0.5 .. 2.5
      let maxL = 0;
      const curve = [];
      for (let i = 0; i <= 90; i++) {
        const m = -0.5 + (i / 90) * 3;
        const l = mse(m, state.intercept);
        curve.push([m, l]); maxL = Math.max(maxL, l);
      }
      const LY = l => pad * 0.7 + (1 - l / (maxL * 1.05)) * lh;

      ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ox, LY(0)); ctx.lineTo(ox + lw, LY(0)); ctx.stroke();

      const grad = ctx.createLinearGradient(0, LY(maxL), 0, LY(0));
      grad.addColorStop(0, c.accent); grad.addColorStop(1, 'transparent');
      ctx.globalAlpha = .16; ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(LX(curve[0][0]), LY(0));
      curve.forEach(([m, l]) => ctx.lineTo(LX(m), LY(l)));
      ctx.lineTo(LX(curve[curve.length - 1][0]), LY(0)); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = c.accent; ctx.lineWidth = 2.2; ctx.beginPath();
      curve.forEach(([m, l], i) => (i ? ctx.lineTo(LX(m), LY(l)) : ctx.moveTo(LX(m), LY(l))));
      ctx.stroke();

      const cur = mse(state.slope, state.intercept);
      ctx.strokeStyle = c.line; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(LX(state.slope), LY(cur)); ctx.lineTo(LX(state.slope), LY(0)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = c.accent3;
      ctx.beginPath(); ctx.arc(LX(state.slope), LY(cur), 5.5, 0, 7); ctx.fill();
      ctx.strokeStyle = c.surface; ctx.lineWidth = 2; ctx.stroke();

      ctx.fillStyle = c.muted; ctx.font = `500 10px ${c.mono}`;
      ctx.fillText('loss for every slope', ox, h - 8);
      ctx.textAlign = 'right';
      ctx.fillText(`MSE ${cur.toFixed(4)}`, ox + lw, pad * 0.7 - 8);
      ctx.textAlign = 'left';
    }, { height: 280, still: true });

    const repaint = () => s.redraw();
    root.querySelectorAll('input[data-key]').forEach(i => i.addEventListener('input', repaint));
    window.addEventListener('ltb:theme', repaint);
    return () => { window.removeEventListener('ltb:theme', repaint); s.stop(); };
  },
};
