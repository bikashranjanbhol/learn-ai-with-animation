import { scene, controls, roundRect, clamp, mix } from '../anim.js';

export default {
  id: 'network',
  title: 'Layers and the forward pass',
  minutes: 8,
  interactive: true,
  tags: ['layers', 'forward pass', 'hidden units', 'depth', 'matrix'],
  summary: 'Wire neurons side by side and you get a layer. Stack layers and straight lines start curving around your data.',

  body: () => `
    <h2>A layer is just neurons in parallel</h2>
    <p>Every neuron in a layer sees the <em>same</em> inputs and applies its own weights to them. Ten neurons looking at four inputs means forty weights plus ten biases — and because they all do the same shaped arithmetic, the whole layer collapses into one matrix multiply:</p>
    <pre><code><span class="tok-com"># one layer, all neurons at once</span>
z = W @ x + b      <span class="tok-com"># W is (units × inputs)</span>
a = relu(z)        <span class="tok-com"># applied element-wise</span></code></pre>
    <p>That is the only reason deep learning is practical. GPUs are matrix-multiply machines, and this shape is exactly the meal they want.</p>

    <h2>Watch the signal travel</h2>
    <p>Press play and follow one wave from left to right. Each node lights in proportion to its activation; each edge brightens by how much it contributed. That single left-to-right sweep is called the <strong>forward pass</strong>, and it is what happens every time a model answers you.</p>

    <div class="demo">
      <div class="demo-head"><h4>Forward pass, layer by layer</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage"><canvas id="fwdCanvas"></canvas></div>
      <div class="demo-controls">
        <button class="btn" id="fwdPlay" type="button">
          <svg viewBox="0 0 24 24"><path d="M6 4l12 8-12 8z"/></svg><span>Pause</span></button>
        <button class="btn secondary" id="fwdStep" type="button">New input</button>
        <div class="readout"><span>stage <b id="fwdStage">input</b></span></div>
      </div>
    </div>

    <h2>Why depth buys you curves</h2>
    <p>Each hidden unit contributes one fold in the input space. Two units give you a corner; twelve give you a region that can wrap around a blob of data. The demo below evaluates an <em>untrained</em> network with random weights, so what you are seeing is not intelligence — it is the raw expressive capacity that training gets to choose from.</p>

    <div class="demo">
      <div class="demo-head"><h4>Capacity: hidden units vs shape</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage"><canvas id="capCanvas"></canvas></div>
      <div class="demo-controls">
        <div class="ctrl"><label>hidden units <output data-for="units">8</output></label>
          <input type="range" data-key="units" data-decimals="0" min="1" max="24" step="1" value="8"></div>
        <div class="ctrl"><label>layers <output data-for="depth">2</output></label>
          <input type="range" data-key="depth" data-decimals="0" min="1" max="4" step="1" value="2"></div>
        <button class="btn secondary" id="capRoll" type="button">Reroll weights</button>
      </div>
    </div>

    <p>Add units and the boundary gets more detailed. Add layers and the details start composing — folds of folds, which is why a deep narrow network can express shapes a shallow wide one struggles with.</p>

    <div class="callout warn">
      <div class="callout-title">More capacity is not more skill</div>
      <p>A network with enough units can memorise your training set perfectly and still be useless on anything new. Capacity is the size of the space of rules the model may choose from; training data and regularisation are what steer it to a rule that <em>generalises</em>.</p>
    </div>

    <h2>Reading a network's shape</h2>
    <p>When you see an architecture written down, it is describing this same picture:</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Term</th><th>Means</th></tr></thead>
      <tbody>
        <tr><td><strong>Input layer</strong></td><td>Your features, one number per slot. Not really a layer — nothing is computed.</td></tr>
        <tr><td><strong>Hidden layer</strong></td><td>Any layer whose outputs you never look at directly.</td></tr>
        <tr><td><strong>Width</strong></td><td>Units in a layer. Controls how much detail one stage can capture.</td></tr>
        <tr><td><strong>Depth</strong></td><td>Number of stacked layers. Controls how much composition is possible.</td></tr>
        <tr><td><strong>Output layer</strong></td><td>Shaped like the answer: 1 unit for a yes/no, 10 for ten classes, 50,000 for a vocabulary.</td></tr>
      </tbody>
    </table></div>

    <h3>Counting parameters</h3>
    <p>A layer with <code>n</code> inputs and <code>m</code> units holds <code>n × m + m</code> parameters. For a 784 → 128 → 10 digit classifier that is 100,480 + 1,290 ≈ <strong>101,770 numbers</strong>, all of which start out random. The next section is about how they stop being random.</p>`,

  init(root) {
    const cleanups = [];

    /* ---------- demo 1: animated forward pass ---------- */
    {
      const canvas = root.querySelector('#fwdCanvas');
      const stageEl = root.querySelector('#fwdStage');
      const playBtn = root.querySelector('#fwdPlay');
      const sizes = [3, 5, 4, 2];
      const names = ['input', 'hidden 1', 'hidden 2', 'output'];
      let W = [], acts = [], wave = 0, playing = true;

      const randomise = () => {
        W = [];
        for (let i = 0; i < sizes.length - 1; i++) {
          W.push(Array.from({ length: sizes[i + 1] }, () =>
            Array.from({ length: sizes[i] }, () => Math.random() * 2 - 1)));
        }
        acts = [Array.from({ length: sizes[0] }, () => Math.random())];
        for (let i = 0; i < W.length; i++) {
          acts.push(W[i].map(row => {
            const z = row.reduce((s, wv, j) => s + wv * acts[i][j], 0);
            return 1 / (1 + Math.exp(-z * 2.2));
          }));
        }
        wave = 0;
      };
      randomise();

      const s = scene(canvas, (ctx, { w, h, dt, c }) => {
        if (playing) { wave += dt * 0.55; if (wave > sizes.length + 0.6) { randomise(); } }
        const stage = clamp(Math.floor(wave), 0, sizes.length - 1);
        stageEl.textContent = names[stage];

        const padX = 62, padY = 30;
        const cols = sizes.map((_, i) => padX + (i * (w - padX * 2)) / (sizes.length - 1));
        const pos = sizes.map((n, i) => Array.from({ length: n }, (_, j) =>
          ({ x: cols[i], y: padY + ((j + 0.5) * (h - padY * 2 - 16)) / n })));

        for (let i = 0; i < pos.length - 1; i++) {
          const prog = clamp(wave - i, 0, 1);
          pos[i].forEach((a, j) => pos[i + 1].forEach((b, k) => {
            const weight = W[i][k][j];
            const on = prog > 0;
            ctx.strokeStyle = weight >= 0 ? c.accent2 : c.accent3;
            ctx.globalAlpha = on ? 0.12 + 0.5 * Math.abs(weight) * prog : 0.1;
            ctx.lineWidth = 0.7 + 2.4 * Math.abs(weight) * (on ? prog : 0.2);
            ctx.beginPath(); ctx.moveTo(a.x + 13, a.y); ctx.lineTo(b.x - 13, b.y); ctx.stroke();
            ctx.globalAlpha = 1;
            if (prog > 0 && prog < 1) {
              const px = a.x + 13 + (b.x - a.x - 26) * prog;
              const py = a.y + (b.y - a.y) * prog;
              ctx.fillStyle = weight >= 0 ? c.accent2 : c.accent3;
              ctx.globalAlpha = 0.9 * Math.sin(Math.PI * prog);
              ctx.beginPath(); ctx.arc(px, py, 2.4, 0, 7); ctx.fill();
              ctx.globalAlpha = 1;
            }
          }));
        }

        pos.forEach((layer, i) => {
          const arrived = clamp(wave - i + 1, 0, 1);
          layer.forEach((n, j) => {
            const a = acts[i][j] * arrived;
            ctx.beginPath(); ctx.arc(n.x, n.y, 13, 0, 7);
            ctx.fillStyle = mix(c.surface, i === pos.length - 1 ? c.accent3 : c.accent, clamp(a, 0, 1) * 0.85);
            ctx.fill();
            ctx.strokeStyle = arrived > 0.05 ? c.accent : c.line;
            ctx.lineWidth = 1.6; ctx.stroke();
            ctx.font = `500 9.5px ${c.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = clamp(a, 0, 1) > 0.55 ? '#fff' : c.soft;
            ctx.fillText(a.toFixed(2), n.x, n.y);
          });
          ctx.font = `500 10px ${c.mono}`; ctx.fillStyle = i === stage ? c.accent : c.muted;
          ctx.textAlign = 'center';
          ctx.fillText(names[i], cols[i], h - 4);
        });
      }, { height: 260 });

      playBtn.addEventListener('click', () => {
        playing = !playing;
        playBtn.querySelector('span').textContent = playing ? 'Pause' : 'Play';
      });
      root.querySelector('#fwdStep').addEventListener('click', randomise);
      cleanups.push(() => s.stop());
    }

    /* ---------- demo 2: capacity ---------- */
    {
      const canvas = root.querySelector('#capCanvas');
      const state = { units: 8, depth: 2 };
      let seed = 1;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return (seed / 4294967296) * 2 - 1;
      };
      let net = [];
      const build = () => {
        seed = Math.floor(Math.random() * 1e6) + 1;
        net = [];
        let inDim = 2;
        for (let l = 0; l < state.depth; l++) {
          const m = state.units;
          net.push({
            W: Array.from({ length: m }, () => Array.from({ length: inDim }, () => rand() * 2.6)),
            b: Array.from({ length: m }, () => rand() * 1.4),
          });
          inDim = m;
        }
        net.push({ W: [Array.from({ length: inDim }, () => rand() * 1.8)], b: [rand() * 0.4] });
      };
      const forward = (x, y) => {
        let v = [x, y];
        for (let l = 0; l < net.length; l++) {
          const { W, b } = net[l];
          const out = W.map((row, i) => row.reduce((s, wv, j) => s + wv * v[j], b[i]));
          v = l === net.length - 1 ? out : out.map(z => Math.max(0, z));
        }
        return Math.tanh(v[0] / 4);
      };

      build();
      controls(root, state, () => build());
      root.querySelector('#capRoll').addEventListener('click', build);

      const s = scene(canvas, (ctx, { w, h, c }) => {
        const pad = 14, cell = 5;
        const size = Math.min(w - pad * 2, h - pad * 2 - 14);
        const ox = (w - size) / 2, oy = pad;
        for (let px = 0; px < size; px += cell) {
          for (let py = 0; py < size; py += cell) {
            const x = ((px + cell / 2) / size) * 4.4 - 2.2;
            const y = 2.2 - ((py + cell / 2) / size) * 4.4;
            const v = forward(x, y);
            // blend into the surface colour rather than stacking alpha,
            // so neighbouring cells cannot leave seams
            const hue = mix(c.accent3, c.accent2, (v + 1) / 2);
            ctx.fillStyle = mix(c.surface, hue, 0.12 + 0.42 * Math.abs(v));
            ctx.fillRect(ox + px, oy + py, cell + 1, cell + 1);
          }
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
        ctx.strokeRect(ox + .5, oy + .5, size, size);
        ctx.fillStyle = c.muted; ctx.font = `500 10px ${c.mono}`; ctx.textAlign = 'left';
        ctx.fillText(`${state.depth} hidden layer${state.depth > 1 ? 's' : ''} × ${state.units} units · random weights`, ox, h - 6);
      }, { height: 300, still: true });

      // repaint on control changes / theme flip
      const repaint = () => s.redraw();
      root.querySelectorAll('input[data-key]').forEach(i => i.addEventListener('input', repaint));
      root.querySelector('#capRoll').addEventListener('click', repaint);
      window.addEventListener('ltb:theme', repaint);
      cleanups.push(() => { window.removeEventListener('ltb:theme', repaint); s.stop(); });
    }

    return () => cleanups.forEach(fn => fn());
  },
};
