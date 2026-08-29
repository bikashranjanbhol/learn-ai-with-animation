import { scene, controls, roundRect, clamp, mix } from '../anim.js';

/* Toy attention scores. Real ones are learned; these are hand-set so the
   mechanism is visible without needing a 7-billion-parameter model. */
const SENTENCES = {
  pronoun: {
    label: 'pronoun reference',
    tokens: ['The', 'cat', 'chased', 'the', 'mouse', 'because', 'it', 'was', 'hungry'],
    rel: {
      6: { 1: 3.4, 4: 1.2, 8: 1.6 },        // "it" → cat
      8: { 1: 2.2, 6: 2.6 },                // "hungry" → it / cat
      2: { 1: 2.8, 4: 2.4 },                // "chased" → subject + object
      7: { 6: 2.4, 1: 1.4 },
    },
  },
  agreement: {
    label: 'long-range agreement',
    tokens: ['The', 'keys', 'to', 'the', 'cabinet', 'in', 'the', 'hall', 'are', 'lost'],
    rel: {
      8: { 1: 3.6, 4: 0.9, 7: 0.5 },        // "are" agrees with "keys", not "cabinet"
      9: { 1: 2.4, 8: 2.0 },
      4: { 2: 1.6, 1: 1.2 },
      7: { 5: 1.8, 4: 1.0 },
    },
  },
  meaning: {
    label: 'sense disambiguation',
    tokens: ['She', 'sat', 'on', 'the', 'bank', 'of', 'the', 'river', 'at', 'dawn'],
    rel: {
      4: { 7: 3.2, 5: 1.4, 1: 1.0 },        // "bank" → river, not money
      1: { 0: 2.4, 4: 1.8 },
      9: { 1: 1.4, 7: 1.2 },
      7: { 4: 2.6 },
    },
  },
};

export default {
  id: 'attention',
  title: 'Attention and the transformer',
  minutes: 9,
  interactive: true,
  tags: ['attention', 'transformer', 'self-attention', 'context', 'softmax', 'heads'],
  summary: 'Instead of reading left to right, look at every other token at once and decide which ones matter. That one change produced the last decade of AI.',

  body: () => `
    <h2>The problem attention solves</h2>
    <p>Take the sentence <em>"The keys to the cabinet in the hall are lost."</em> To choose <code>are</code> rather than <code>is</code>, a model has to connect the verb back to <code>keys</code> — seven tokens away, past two nearer nouns that are both singular.</p>
    <p>The older approach, recurrence, walked through the sentence one token at a time carrying a summary. Distant connections had to survive every intervening step, and mostly they did not. <strong>Attention</strong> deletes the distance: every token can look directly at every other token in a single operation.</p>

    <h2>Query, key, value</h2>
    <p>Each token produces three vectors from its embedding:</p>
    <ul>
      <li><strong>Query</strong> — what this token is looking for.</li>
      <li><strong>Key</strong> — what this token offers to others.</li>
      <li><strong>Value</strong> — the content it hands over if chosen.</li>
    </ul>
    <p>A token's query is compared against every key, the scores are turned into weights that sum to 1, and the output is the weighted blend of values:</p>
    <pre><code>scores  = Q · Kᵀ / √d
weights = softmax(scores)      <span class="tok-com"># each row sums to 1</span>
output  = weights · V</code></pre>
    <p>The <code>√d</code> is not decoration: without it the scores grow with vector size, softmax saturates into a hard pick, and gradients vanish.</p>

    <h2>Follow the arcs</h2>
    <p>Pick a token and watch where it looks. In the agreement example, notice that <code>are</code> reaches past <code>cabinet</code> and <code>hall</code> to land on <code>keys</code> — the connection distance never mattered.</p>

    <div class="demo">
      <div class="demo-head"><h4>Self-attention on one sentence</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage"><canvas id="attnCanvas"></canvas></div>
      <div class="demo-controls">
        <div class="ctrl" style="flex:1 1 100%"><label>example</label>
          <div class="pill-row" id="attnPills">
            ${Object.entries(SENTENCES).map(([k, v], i) =>
              `<button class="pill" type="button" data-sent="${k}" aria-pressed="${i === 0}">${v.label}</button>`).join('')}
          </div></div>
        <div class="ctrl"><label>sharpness (1/√d) <output data-for="temp">1.00</output></label>
          <input type="range" data-key="temp" min="0.2" max="3" step="0.05" value="1"></div>
        <div class="readout"><span id="attnInfo">Hover a token to see what it attends to</span></div>
      </div>
    </div>

    <p>Drag the sharpness slider to zero and every weight becomes the same — the token blends everything equally and learns nothing. Push it high and attention collapses onto a single token, ignoring useful context. Training has to find the middle, which is exactly what the <code>√d</code> scaling is there to protect.</p>

    <h2>Many heads, many questions</h2>
    <p>One attention pattern can only ask one kind of question. So a layer runs several in parallel — <strong>heads</strong> — each with its own query, key and value projections, and concatenates the results. In practice, probing trained models finds heads that specialise: some track syntactic dependencies, some resolve pronouns, some just attend to the previous token.</p>

    <h3>The transformer block</h3>
    <p>Stack these two pieces and you have essentially the entire architecture:</p>
    <ol>
      <li><strong>Multi-head self-attention</strong> — every token gathers context from every other.</li>
      <li><strong>Feed-forward network</strong> — the neurons from lesson 3, applied to each position independently, where most of the parameters actually live.</li>
    </ol>
    <p>Each sub-layer is wrapped in a residual connection (<code>x + f(x)</code>, so gradients have a clean path backwards) and a normalisation step. Repeat the block 32, 80, or 120 times and you have a modern language model.</p>

    <div class="callout">
      <div class="callout-title">Why position has to be added back in</div>
      <p>Attention has no inherent sense of order — shuffle the tokens and the maths gives the same answer. So position information is injected explicitly, these days usually by rotating the query and key vectors by an angle that depends on position (RoPE). Order is a feature the architecture has to be told about.</p>
    </div>

    <h2>The cost</h2>
    <p>Every token attending to every token means n² comparisons. Double the context and you quadruple the attention work — which is why long-context models are expensive, and why flash attention, sliding windows and sparse patterns are such an active area. The idea is simple; making it cheap is not.</p>`,

  init(root) {
    const canvas = root.querySelector('#attnCanvas');
    const info = root.querySelector('#attnInfo');
    const state = { temp: 1 };
    controls(root, state);

    let key = 'pronoun', selected = null, layout = [], autoT = 0;

    root.querySelector('#attnPills').addEventListener('click', e => {
      const btn = e.target.closest('[data-sent]');
      if (!btn) return;
      key = btn.dataset.sent; selected = null;
      root.querySelectorAll('#attnPills .pill').forEach(p => p.setAttribute('aria-pressed', String(p === btn)));
    });

    const onMove = e => {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      selected = layout.findIndex(b => mx >= b.x && mx <= b.x + b.w && my >= b.y - 14 && my <= b.y + b.h + 14);
      if (selected < 0) selected = null;
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', () => { selected = null; });

    function weightsFor(idx) {
      const { tokens, rel } = SENTENCES[key];
      const raw = tokens.map((_, j) => (rel[idx]?.[j] ?? 0) + (j === idx ? 1.1 : 0.15));
      const scaled = raw.map(v => v * state.temp);
      const m = Math.max(...scaled);
      const exp = scaled.map(v => Math.exp(v - m));
      const sum = exp.reduce((a, b) => a + b, 0);
      return exp.map(v => v / sum);
    }

    const s = scene(canvas, (ctx, { w, h, t, c }) => {
      const { tokens } = SENTENCES[key];
      autoT += 0.004;
      const active = selected ?? Object.keys(SENTENCES[key].rel)
        .map(Number)[Math.floor(autoT) % Object.keys(SENTENCES[key].rel).length];
      const weights = weightsFor(active);

      // layout the token chips on one row
      ctx.font = `500 13px ${c.sans}`;
      const gaps = 8;
      const widths = tokens.map(tk => Math.max(34, ctx.measureText(tk).width + 20));
      const totalW = widths.reduce((a, b) => a + b, 0) + gaps * (tokens.length - 1);
      const scale = Math.min(1, (w - 24) / totalW);
      let x = (w - totalW * scale) / 2;
      const rowY = h - 76;
      layout = tokens.map((tk, i) => {
        const bw = widths[i] * scale;
        const box = { x, y: rowY, w: bw, h: 30, cx: x + bw / 2, token: tk };
        x += bw + gaps * scale;
        return box;
      });

      // arcs from the active token to the ones it attends to
      const from = layout[active];
      weights.forEach((wt, j) => {
        if (j === active || wt < 0.02) return;
        const to = layout[j];
        const lift = clamp(46 + Math.abs(to.cx - from.cx) * 0.55, 46, rowY - 26);
        ctx.strokeStyle = mix(c.accent, c.accent2, j / tokens.length);
        ctx.globalAlpha = clamp(wt * 2.6, 0.08, 0.95);
        ctx.lineWidth = clamp(wt * 16, 0.8, 9);
        ctx.beginPath();
        ctx.moveTo(from.cx, rowY - 2);
        ctx.quadraticCurveTo((from.cx + to.cx) / 2, rowY - lift, to.cx, rowY - 2);
        ctx.stroke();
        // travelling dot along the arc
        const p = (t * 0.35 + j * 0.13) % 1;
        const bx = (1 - p) ** 2 * from.cx + 2 * (1 - p) * p * ((from.cx + to.cx) / 2) + p * p * to.cx;
        const by = (1 - p) ** 2 * (rowY - 2) + 2 * (1 - p) * p * (rowY - lift) + p * p * (rowY - 2);
        ctx.globalAlpha = clamp(wt * 3, 0, 1);
        ctx.fillStyle = c.accent2;
        ctx.beginPath(); ctx.arc(bx, by, 2.4, 0, 7); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // token chips, tinted by how much attention they receive
      layout.forEach((b, i) => {
        const wt = weights[i];
        const isActive = i === active;
        ctx.fillStyle = isActive ? c.accent : mix(c.surface, c.accent2, clamp(wt * 1.5, 0, 0.9));
        roundRect(ctx, b.x, b.y, b.w, b.h, 8); ctx.fill();
        ctx.strokeStyle = isActive ? c.accent : c.line; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.fillStyle = isActive || wt > 0.4 ? '#fff' : c.text;
        ctx.font = `${isActive ? 600 : 500} 13px ${c.sans}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(b.token, b.cx, b.y + b.h / 2);

        // attention received, as a bar hanging from a shared baseline
        const trackTop = b.y + b.h + 8, trackH = 24;
        ctx.fillStyle = c.grid;
        roundRect(ctx, b.cx - 3, trackTop, 6, trackH, 3); ctx.fill();
        ctx.fillStyle = c.accent2;
        roundRect(ctx, b.cx - 3, trackTop, 6, Math.max(2, trackH * wt), 3); ctx.fill();
        ctx.font = `500 9px ${c.mono}`; ctx.fillStyle = c.muted;
        ctx.fillText(wt.toFixed(2), b.cx, trackTop + trackH + 10);
      });

      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = `600 11.5px ${c.mono}`; ctx.fillStyle = c.muted;
      ctx.fillText(`query token: "${tokens[active]}"   ·   weights sum to 1.00`, 14, 20);

      const top = weights.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).filter(([, i]) => i !== active).slice(0, 2);
      info.textContent = `"${tokens[active]}" attends mostly to ${top.map(([v, i]) => `"${tokens[i]}" (${(v * 100).toFixed(0)}%)`).join(', ')}`;
    }, { height: 235 });

    return () => { canvas.removeEventListener('pointermove', onMove); s.stop(); };
  },
};
