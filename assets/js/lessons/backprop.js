import { scene, controls, mix, clamp } from '../anim.js';

/* ---------- a very small MLP with hand-written backprop ---------- */
function makeNet(sizes) {
  const layers = [];
  for (let i = 0; i < sizes.length - 1; i++) {
    const fanIn = sizes[i], out = sizes[i + 1];
    const scale = Math.sqrt(2 / fanIn);
    layers.push({
      W: Array.from({ length: out }, () => Array.from({ length: fanIn }, () => (Math.random() * 2 - 1) * scale)),
      b: Array.from({ length: out }, () => 0),
      last: i === sizes.length - 2,
    });
  }
  return layers;
}
const act = z => Math.tanh(z);
const dact = a => 1 - a * a;

function forward(net, input) {
  const acts = [input];
  let v = input;
  for (const L of net) {
    v = L.W.map((row, i) => act(row.reduce((s, w, j) => s + w * v[j], L.b[i])));
    acts.push(v);
  }
  return acts;
}

function trainBatch(net, data, lr) {
  const grads = net.map(L => ({
    dW: L.W.map(row => row.map(() => 0)),
    db: L.b.map(() => 0),
  }));
  let loss = 0;

  for (const { x, y } of data) {
    const acts = forward(net, x);          // acts[l] feeds layer l
    const out = acts[acts.length - 1][0];
    loss += 0.5 * (out - y) ** 2;

    // dLoss/dz at the output, then hand it backwards one layer at a time
    let delta = [(out - y) * dact(out)];
    for (let l = net.length - 1; l >= 0; l--) {
      const inp = acts[l];
      for (let i = 0; i < net[l].W.length; i++) {
        grads[l].db[i] += delta[i];
        const row = grads[l].dW[i];
        for (let j = 0; j < inp.length; j++) row[j] += delta[i] * inp[j];
      }
      if (l > 0) {
        delta = inp.map((a, j) =>
          net[l].W.reduce((s, row, i) => s + row[j] * delta[i], 0) * dact(a));
      }
    }
  }

  const n = data.length;
  net.forEach((L, l) => {
    L.W.forEach((row, i) => row.forEach((_, j) => { L.W[i][j] -= (lr * grads[l].dW[i][j]) / n; }));
    L.b.forEach((_, i) => { L.b[i] -= (lr * grads[l].db[i]) / n; });
  });
  return loss / n;
}

/* ---------- datasets ---------- */
const DATASETS = {
  circle: {
    label: 'rings',
    make: () => Array.from({ length: 160 }, () => {
      const inner = Math.random() < 0.5;
      const r = inner ? Math.random() * 0.45 : 0.72 + Math.random() * 0.28;
      const a = Math.random() * Math.PI * 2;
      return { x: [Math.cos(a) * r, Math.sin(a) * r], y: inner ? 1 : -1 };
    }),
  },
  xor: {
    label: 'XOR',
    make: () => Array.from({ length: 160 }, () => {
      const x = Math.random() * 2 - 1, y = Math.random() * 2 - 1;
      return { x: [x, y], y: x * y > 0 ? 1 : -1 };
    }),
  },
  spiral: {
    label: 'spiral',
    make: () => Array.from({ length: 180 }, (_, i) => {
      const arm = i % 2;
      const t = (i / 180) * 4.2 + 0.4;
      const a = t + arm * Math.PI + (Math.random() - 0.5) * 0.25;
      const r = t / 5.2;
      return { x: [Math.cos(a) * r, Math.sin(a) * r], y: arm ? 1 : -1 };
    }),
  },
};

export default {
  id: 'backprop',
  title: 'Backpropagation',
  minutes: 9,
  interactive: true,
  tags: ['backpropagation', 'chain rule', 'gradients', 'training', 'epoch'],
  summary: 'Gradient descent needs a gradient for every parameter. Backprop computes all of them in one backward sweep — and that efficiency is why deep learning exists.',

  body: () => `
    <h2>The credit assignment problem</h2>
    <p>Your network gets an answer wrong. Somewhere among a hundred thousand weights, some helped and some hurt. Which ones, and by how much?</p>
    <p>The naive approach is to nudge each weight, re-run the whole network, and see what happened to the loss. For a model with a million parameters that means a million forward passes <em>per training step</em>. Nobody would ever have trained anything.</p>
    <p><strong>Backpropagation</strong> gets every gradient in roughly the cost of one extra forward pass, by reusing work. It is the chain rule from calculus, applied bookkeeping-first.</p>

    <h2>Forwards to predict, backwards to blame</h2>
    <p>Training alternates two sweeps over the same network:</p>
    <div class="table-wrap"><table>
      <thead><tr><th></th><th>Forward pass</th><th>Backward pass</th></tr></thead>
      <tbody>
        <tr><td><strong>Direction</strong></td><td>Input → output</td><td>Loss → every parameter</td></tr>
        <tr><td><strong>Carries</strong></td><td>Activations</td><td>Gradients (how much this value affected the loss)</td></tr>
        <tr><td><strong>Produces</strong></td><td>A prediction</td><td>A direction to move each weight</td></tr>
      </tbody>
    </table></div>
    <p>The key move: once you know how much a layer's <em>output</em> affected the loss, you can compute how much its <em>inputs</em> and its <em>weights</em> did, using only local information. So you hand that quantity backwards, one layer at a time, and each layer settles up locally. No layer needs to know anything about the layers beyond its neighbours.</p>

    <div class="demo">
      <div class="demo-head"><h4>Two sweeps, one network</h4><span class="badge">Live</span></div>
      <div class="demo-stage"><canvas id="bpFlow"></canvas></div>
    </div>

    <h2>Train one and watch the boundary form</h2>
    <p>Below is a real network — 2 inputs, two hidden layers, one output — training in your browser with the backprop written out by hand. The background is the model's current opinion about every point in the plane; the sparkline is the loss. Try the spiral: it needs the extra capacity, and you can watch the boundary wrap around each arm.</p>

    <div class="demo">
      <div class="demo-head"><h4>Live training</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage"><canvas id="bpTrain"></canvas></div>
      <div class="demo-controls">
        <div class="ctrl"><label>learning rate <output data-for="lr">0.50</output></label>
          <input type="range" data-key="lr" min="0.05" max="3" step="0.05" value="0.9"></div>
        <div class="ctrl"><label>hidden width <output data-for="width">8</output></label>
          <input type="range" data-key="width" data-decimals="0" min="2" max="16" step="1" value="8"></div>
        <div class="ctrl" style="flex:1 1 100%"><label>dataset</label>
          <div class="pill-row" id="bpData">
            ${Object.entries(DATASETS).map(([k, v], i) =>
              `<button class="pill" type="button" data-set="${k}" aria-pressed="${i === 0}">${v.label}</button>`).join('')}
          </div></div>
        <button class="btn" id="bpRun" type="button">
          <svg viewBox="0 0 24 24"><path d="M6 4l12 8-12 8z"/></svg><span>Pause</span></button>
        <button class="btn secondary" id="bpReset" type="button">Reset weights</button>
        <div class="readout"><span>epoch <b id="bpEpoch">0</b></span><span>loss <b id="bpLoss">—</b></span><span>accuracy <b id="bpAcc">—</b></span></div>
      </div>
    </div>

    <h3>What to try</h3>
    <ul>
      <li>Drop the hidden width to <strong>2</strong> on the spiral. The network no longer has enough folds and the boundary stays crude — capacity, not effort, is the limit.</li>
      <li>Push the learning rate to <strong>3</strong>. The loss thrashes: each step overshoots the valley found in the last lesson.</li>
      <li>Hit reset a few times on XOR. Different random starts find visibly different solutions — there is no single "correct" set of weights.</li>
    </ul>

    <div class="callout">
      <div class="callout-title">Vanishing gradients</div>
      <p>Each backward step multiplies by the activation's slope. <code>tanh</code> and <code>sigmoid</code> have slopes below 1 almost everywhere, so after twenty layers the gradient reaching the first layer can be vanishingly small and the early layers barely learn. ReLU (slope exactly 1 when active), residual connections that let gradients skip layers, and normalisation are the three fixes that made very deep networks trainable.</p>
    </div>

    <h2>Vocabulary you now own</h2>
    <ul>
      <li><strong>Batch</strong> — the group of examples used for one update.</li>
      <li><strong>Epoch</strong> — one pass over the whole training set.</li>
      <li><strong>Autograd</strong> — the machinery in PyTorch or JAX that records your forward operations and derives the backward pass for you. It is doing exactly what the code in this demo does by hand.</li>
    </ul>
    <p>That is a complete picture of training. The rest of the course is about a particular architecture — the one that turned this machinery into models that write.</p>`,

  init(root) {
    const cleanups = [];

    /* ---------- flow diagram ---------- */
    {
      const canvas = root.querySelector('#bpFlow');
      const sizes = [3, 5, 5, 1];
      const s = scene(canvas, (ctx, { w, h, t, c }) => {
        const cycle = (t % 4) / 4;              // 0–0.5 forward, 0.5–1 backward
        const fwd = cycle < 0.5;
        const prog = fwd ? cycle * 2 : (cycle - 0.5) * 2;
        const padX = 60, padY = 30;
        const cols = sizes.map((_, i) => padX + (i * (w - padX * 2)) / (sizes.length - 1));
        const pos = sizes.map((n, i) => Array.from({ length: n }, (_, j) =>
          ({ x: cols[i], y: padY + ((j + 0.5) * (h - padY * 2 - 14)) / n })));

        const span = sizes.length - 1;
        const head = prog * span;

        for (let i = 0; i < span; i++) {
          const seg = fwd ? clamp(head - i, 0, 1) : clamp(head - (span - 1 - i), 0, 1);
          pos[i].forEach(a => pos[i + 1].forEach(b => {
            ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x + 11, a.y); ctx.lineTo(b.x - 11, b.y); ctx.stroke();
            if (seg > 0 && seg < 1) {
              const p = fwd ? seg : 1 - seg;
              const px = a.x + 11 + (b.x - a.x - 22) * p;
              const py = a.y + (b.y - a.y) * p;
              ctx.fillStyle = fwd ? c.accent : c.accent3;
              ctx.globalAlpha = Math.sin(Math.PI * seg);
              ctx.beginPath(); ctx.arc(px, py, 2.8, 0, 7); ctx.fill();
              ctx.globalAlpha = 1;
            }
          }));
        }
        pos.forEach((layer, i) => layer.forEach(n => {
          ctx.beginPath(); ctx.arc(n.x, n.y, 11, 0, 7);
          ctx.fillStyle = c.surface; ctx.fill();
          ctx.strokeStyle = c.line; ctx.lineWidth = 1.6; ctx.stroke();
        }));

        ctx.font = `600 12px ${c.sans}`; ctx.textAlign = 'center';
        ctx.fillStyle = fwd ? c.accent : c.accent3;
        ctx.fillText(fwd ? 'forward pass — computing the prediction'
                         : 'backward pass — sending blame back to every weight', w / 2, h - 6);
        ctx.font = `500 10px ${c.mono}`; ctx.fillStyle = c.muted;
        ctx.textAlign = 'left'; ctx.fillText('input', 22, padY);
        ctx.textAlign = 'right'; ctx.fillText('loss', w - 22, padY);
      }, { height: 210 });
      cleanups.push(() => s.stop());
    }

    /* ---------- live training ---------- */
    {
      const canvas = root.querySelector('#bpTrain');
      const epochEl = root.querySelector('#bpEpoch');
      const lossEl = root.querySelector('#bpLoss');
      const accEl = root.querySelector('#bpAcc');
      const runBtn = root.querySelector('#bpRun');

      const state = { lr: 0.9, width: 8 };
      let dataKey = 'circle', data = DATASETS[dataKey].make();
      let net = makeNet([2, state.width, state.width, 1]);
      let epoch = 0, history = [], running = true, acc = 0;

      const rebuild = () => { net = makeNet([2, state.width, state.width, 1]); epoch = 0; history = []; };
      controls(root, state, () => {});
      root.querySelector('input[data-key="width"]').addEventListener('change', rebuild);

      root.querySelector('#bpData').addEventListener('click', e => {
        const btn = e.target.closest('[data-set]');
        if (!btn) return;
        dataKey = btn.dataset.set;
        data = DATASETS[dataKey].make();
        root.querySelectorAll('#bpData .pill').forEach(p => p.setAttribute('aria-pressed', String(p === btn)));
        rebuild();
      });
      runBtn.addEventListener('click', () => {
        running = !running;
        runBtn.querySelector('span').textContent = running ? 'Pause' : 'Train';
      });
      root.querySelector('#bpReset').addEventListener('click', rebuild);

      const s = scene(canvas, (ctx, { w, h, dt, c }) => {
        if (running) {
          acc += dt;
          const rounds = clamp(Math.floor(acc / 0.016), 0, 6);
          acc = 0;
          for (let i = 0; i < rounds + 1; i++) {
            const l = trainBatch(net, data, state.lr);
            epoch++;
            if (epoch % 4 === 0) { history.push(l); if (history.length > 160) history.shift(); }
          }
        }

        const plotW = Math.min(h * 1.25, w * 0.62);
        const px0 = 8, py0 = 6, size = Math.min(plotW, h - 12);

        // decision surface
        const cell = 7;
        for (let px = 0; px < size; px += cell) {
          for (let py = 0; py < size; py += cell) {
            const x = ((px + cell / 2) / size) * 2.6 - 1.3;
            const y = 1.3 - ((py + cell / 2) / size) * 2.6;
            const out = forward(net, [x, y])[net.length][0];
            const hue = mix(c.accent3, c.accent2, (out + 1) / 2);
            ctx.fillStyle = mix(c.surface, hue, 0.14 + 0.44 * Math.abs(out));
            ctx.fillRect(px0 + px, py0 + py, cell + 1, cell + 1);
          }
        }
        ctx.globalAlpha = 1;

        // data points + accuracy
        let correct = 0;
        for (const d of data) {
          const out = forward(net, d.x)[net.length][0];
          if (Math.sign(out || 1) === d.y) correct++;
          const cx = px0 + ((d.x[0] + 1.3) / 2.6) * size;
          const cy = py0 + ((1.3 - d.x[1]) / 2.6) * size;
          ctx.beginPath(); ctx.arc(cx, cy, 3.4, 0, 7);
          ctx.fillStyle = d.y > 0 ? c.accent2 : c.accent3; ctx.fill();
          ctx.strokeStyle = c.surface; ctx.lineWidth = 1.2; ctx.stroke();
        }
        ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
        ctx.strokeRect(px0 + 0.5, py0 + 0.5, size, size);

        // loss sparkline
        const lx = px0 + size + 22, lw = w - lx - 14, lh = size * 0.62, ly = py0 + 16;
        if (lw > 60) {
          ctx.fillStyle = c.sunken; ctx.fillRect(lx, ly, lw, lh);
          ctx.strokeStyle = c.grid; ctx.strokeRect(lx + .5, ly + .5, lw, lh);
          if (history.length > 1) {
            const hiL = Math.max(...history, 0.05);
            ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.beginPath();
            history.forEach((v, i) => {
              const X = lx + (i / (history.length - 1)) * lw;
              const Y = ly + lh - (v / hiL) * (lh - 6) - 3;
              i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
            });
            ctx.stroke();
          }
          ctx.font = `500 10px ${c.mono}`; ctx.fillStyle = c.muted; ctx.textAlign = 'left';
          ctx.fillText('training loss', lx, ly - 5);
          ctx.fillText(`${state.width} units/layer`, lx, ly + lh + 16);
          ctx.fillText(`lr ${state.lr.toFixed(2)}`, lx, ly + lh + 32);
        }

        epochEl.textContent = epoch;
        lossEl.textContent = history.length ? history[history.length - 1].toFixed(4) : '—';
        accEl.textContent = Math.round((correct / data.length) * 100) + '%';
      }, { height: 320 });

      cleanups.push(() => s.stop());
    }

    return () => cleanups.forEach(fn => fn());
  },
};
