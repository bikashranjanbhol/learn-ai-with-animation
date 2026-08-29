import { scene } from '../anim.js';

export default {
  id: 'what-is-ai',
  title: 'What machine learning actually is',
  minutes: 6,
  interactive: true,
  tags: ['intro', 'rules', 'learning', 'training data'],
  summary: 'Traditional software is a list of rules you write. A model is a list of numbers a computer <em>finds</em>. That single swap is the whole idea.',

  body: () => `
    <h2>Two ways to get a computer to decide</h2>
    <p>Say you want to sort fruit into "ripe" and "not ripe" from two measurements: how soft it is and how dark it is. The classical approach is to write the rule yourself:</p>
    <pre><code><span class="tok-key">if</span> softness &gt; <span class="tok-num">0.6</span> <span class="tok-key">and</span> darkness &gt; <span class="tok-num">0.5</span>:
    <span class="tok-key">return</span> <span class="tok-str">"ripe"</span></code></pre>
    <p>That works until reality shows up: some fruit is dark but firm, some is soft but pale, and the thresholds are different for peaches and plums. You end up maintaining a thicket of special cases that only the person who wrote it understands.</p>
    <p>Machine learning turns the problem inside out. <strong>You supply examples, and the computer searches for the rule.</strong> The rule still exists — it is just written as numbers rather than as <code>if</code> statements, and it was chosen by fitting, not by arguing.</p>

    <h2>Watch a rule get found</h2>
    <p>Each dot below is one piece of fruit that a person already labelled. The line is the model's current guess at the boundary between the two classes. It starts as a random guess and gets nudged toward the mistakes it is making — that nudge is all of training, in miniature.</p>

    <div class="demo">
      <div class="demo-head"><h4>Fitting a decision boundary</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage"><canvas id="fitCanvas"></canvas></div>
      <div class="demo-controls">
        <button class="btn" id="fitTrain" type="button">
          <svg viewBox="0 0 24 24"><path d="M6 4l12 8-12 8z"/></svg><span>Train</span>
        </button>
        <button class="btn secondary" id="fitReset" type="button">New data</button>
        <div class="readout"><span>step <b id="fitStep">0</b></span><span>accuracy <b id="fitAcc">—</b></span></div>
      </div>
    </div>

    <p>Nobody told the model where the boundary was. It only ever saw labelled points and a signal that said "you got this one wrong, lean that way." Repeat a few hundred times and the line lands somewhere sensible.</p>

    <h2>The three ingredients</h2>
    <p>Every model in this course — from the single neuron in the next lesson to a language model with a trillion parameters — is built from the same three parts.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Ingredient</th><th>What it is</th><th>Fruit example</th></tr></thead>
      <tbody>
        <tr><td><strong>Parameters</strong></td><td>The numbers the model is allowed to change</td><td>The slope and offset of the line</td></tr>
        <tr><td><strong>Loss</strong></td><td>A single number saying how wrong the model currently is</td><td>How many fruits it mislabelled</td></tr>
        <tr><td><strong>Update rule</strong></td><td>How to change the parameters to make the loss smaller</td><td>Tilt the line toward the mistakes</td></tr>
      </tbody>
    </table></div>

    <h3>What changes at scale</h3>
    <p>Going from this toy to GPT-class models changes the size of each ingredient, not their nature: a few parameters become hundreds of billions, one line becomes dozens of stacked layers, and "how many did I get wrong" becomes "how surprised was I by the next word." The loop stays <em>guess → measure → nudge</em>.</p>

    <div class="callout">
      <div class="callout-title">The trade you are making</div>
      <p>A learned rule handles messy real-world variation far better than hand-written thresholds. In exchange, you give up being able to read the rule. Nobody can point at parameter 40,213 and say what it means — which is exactly why interpretability is an open research field.</p>
    </div>

    <h2>Where the data comes from matters</h2>
    <p>The model can only find patterns that exist in the examples you give it. If every "ripe" example in your dataset happened to be photographed in warm light, the model may learn "warm light" instead of "ripe" — and it will look brilliant on your test set and fail in the shop. Most real ML failures are data failures wearing a maths costume.</p>
    <ul>
      <li><strong>Coverage</strong> — did you show it the cases it will actually meet?</li>
      <li><strong>Labels</strong> — is the answer key itself correct and consistent?</li>
      <li><strong>Leakage</strong> — does the input secretly contain the answer?</li>
    </ul>
    <p>Keep those three in mind and you already avoid most beginner mistakes. Next: the smallest possible model, one neuron.</p>`,

  init(root) {
    const canvas = root.querySelector('#fitCanvas');
    const stepEl = root.querySelector('#fitStep');
    const accEl = root.querySelector('#fitAcc');
    const trainBtn = root.querySelector('#fitTrain');

    let pts = [], w = [0, 0], b = 0, step = 0, running = false;

    function makeData() {
      pts = Array.from({ length: 90 }, () => {
        const x = Math.random(), y = Math.random();
        const label = 1.15 * x + 0.85 * y + (Math.random() - 0.5) * 0.32 > 1.05 ? 1 : 0;
        return { x, y, label };
      });
      w = [Math.random() * 2 - 1, Math.random() * 2 - 1];
      b = Math.random() * 0.4 - 0.2;
      step = 0;
      update();
    }

    const predict = p => (w[0] * p.x + w[1] * p.y + b > 0 ? 1 : 0);

    function trainStep() {
      const lr = 0.08;
      for (const p of pts) {
        const err = p.label - predict(p);
        if (err) { w[0] += lr * err * p.x; w[1] += lr * err * p.y; b += lr * err; }
      }
      step++;
      update();
    }

    function update() {
      const correct = pts.filter(p => predict(p) === p.label).length;
      accEl.textContent = pts.length ? Math.round((correct / pts.length) * 100) + '%' : '—';
      stepEl.textContent = step;
    }

    makeData();

    let acc = 0;
    const s = scene(canvas, (ctx, { w: W, h: H, dt, c }) => {
      if (running) {
        acc += dt;
        while (acc > 0.09) { acc -= 0.09; trainStep(); if (step > 400) { running = false; setLabel('Train'); } }
      }
      const pad = 26;
      const size = Math.min(W - pad * 2, H - pad * 2);
      const ox = (W - size) / 2, oy = pad;
      const gw = size, gh = size;
      const X = v => ox + v * gw, Y = v => oy + (1 - v) * gh;

      ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(X(i / 4), Y(0)); ctx.lineTo(X(i / 4), Y(1)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(X(0), Y(i / 4)); ctx.lineTo(X(1), Y(i / 4)); ctx.stroke();
      }

      // shaded half-planes from the current boundary
      ctx.save();
      ctx.beginPath(); ctx.rect(X(0), Y(1), gw, gh); ctx.clip();
      const yAt = x => (-b - w[0] * x) / (w[1] || 1e-6);
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.moveTo(X(0), Y(yAt(0))); ctx.lineTo(X(1), Y(yAt(1)));
      ctx.lineTo(X(1), Y(w[1] > 0 ? 1.4 : -0.4)); ctx.lineTo(X(0), Y(w[1] > 0 ? 1.4 : -0.4));
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.accent; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(X(0), Y(yAt(0))); ctx.lineTo(X(1), Y(yAt(1))); ctx.stroke();
      ctx.restore();

      for (const p of pts) {
        const ok = predict(p) === p.label;
        ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), ok ? 4.2 : 5.4, 0, 7);
        ctx.fillStyle = p.label ? c.accent2 : c.accent3;
        ctx.globalAlpha = ok ? 0.85 : 1;
        ctx.fill();
        if (!ok) { ctx.lineWidth = 1.8; ctx.strokeStyle = c.text; ctx.stroke(); }
        ctx.globalAlpha = 1;
      }

      ctx.font = `500 10px ${c.mono}`; ctx.fillStyle = c.muted;
      ctx.textAlign = 'left'; ctx.fillText('softness →', ox, H - 8);
      ctx.save(); ctx.translate(ox - 16, oy + size); ctx.rotate(-Math.PI / 2);
      ctx.fillText('darkness →', 0, 0); ctx.restore();
    }, { height: 300 });

    const setLabel = txt => { trainBtn.querySelector('span').textContent = txt; };
    trainBtn.addEventListener('click', () => {
      running = !running;
      if (running && step > 400) { step = 0; }
      setLabel(running ? 'Pause' : 'Train');
    });
    root.querySelector('#fitReset').addEventListener('click', () => { running = false; setLabel('Train'); makeData(); });

    return () => s.stop();
  },
};
