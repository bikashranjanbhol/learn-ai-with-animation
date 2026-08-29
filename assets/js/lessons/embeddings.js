import { scene, clamp } from '../anim.js';

/* Hand-placed 2-D coordinates: a stylised version of what a real embedding
   space looks like after projection. Clusters are meaning, not spelling. */
const WORDS = [
  ['king', 0.20, 0.82, 'royal'], ['queen', 0.34, 0.86, 'royal'],
  ['prince', 0.15, 0.71, 'royal'], ['princess', 0.29, 0.75, 'royal'],
  ['man', 0.20, 0.50, 'people'], ['woman', 0.34, 0.54, 'people'],
  ['boy', 0.14, 0.40, 'people'], ['girl', 0.28, 0.44, 'people'],
  ['dog', 0.66, 0.78, 'animal'], ['cat', 0.74, 0.83, 'animal'],
  ['puppy', 0.60, 0.70, 'animal'], ['kitten', 0.79, 0.74, 'animal'],
  ['horse', 0.86, 0.86, 'animal'],
  ['apple', 0.62, 0.26, 'food'], ['banana', 0.71, 0.20, 'food'],
  ['bread', 0.55, 0.16, 'food'], ['cheese', 0.66, 0.10, 'food'],
  ['python', 0.14, 0.16, 'code'], ['java', 0.24, 0.11, 'code'],
  ['compiler', 0.33, 0.20, 'code'], ['server', 0.40, 0.09, 'code'],
  ['walk', 0.90, 0.48, 'verb'], ['run', 0.95, 0.56, 'verb'],
  ['swim', 0.88, 0.38, 'verb'], ['jump', 0.96, 0.40, 'verb'],
];

export default {
  id: 'embeddings',
  title: 'Embeddings: meaning as coordinates',
  minutes: 7,
  interactive: true,
  tags: ['embeddings', 'vectors', 'similarity', 'tokens', 'semantic space'],
  summary: 'Networks cannot read. Before anything else happens, every word becomes a point in space — and where it lands is what the model knows about it.',

  body: () => `
    <h2>From symbols to numbers</h2>
    <p>A neuron multiplies and adds. It cannot do that to the word <em>cat</em>. So the first thing any language model does is look the token up in a big table and pull out a list of numbers — its <strong>embedding</strong>. Real models use vectors of a few thousand dimensions; the picture below flattens that to two so you can see it.</p>
    <p>The naive alternative, giving each word its own slot in a 50,000-long vector of zeros, says nothing: every pair of words is exactly as different as every other pair. Embeddings are learned instead, and they end up placing related words near each other because that arrangement makes the model's real job easier.</p>

    <h2>Explore the space</h2>
    <p>Hover or tap a word to see its nearest neighbours. Nothing here was grouped by hand — in a real model these clusters emerge purely from which words show up in similar contexts.</p>

    <div class="demo">
      <div class="demo-head"><h4>A (small) semantic map</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage"><canvas id="embCanvas"></canvas></div>
      <div class="demo-controls">
        <button class="btn secondary" id="embAnalogy" type="button" aria-pressed="false">Show the king − man + woman arrow</button>
        <div class="readout"><span id="embInfo">Hover a word</span></div>
      </div>
    </div>

    <h2>Directions carry meaning too</h2>
    <p>The famous result is not that similar words sit together — it is that the <em>offsets between them</em> are consistent. The step from <code>man</code> to <code>king</code> is roughly the same step as from <code>woman</code> to <code>queen</code>: same direction, same length. That direction behaves like a "royalty" axis nobody designed.</p>
    <pre><code>vec(<span class="tok-str">"king"</span>) - vec(<span class="tok-str">"man"</span>) + vec(<span class="tok-str">"woman"</span>) ≈ vec(<span class="tok-str">"queen"</span>)</code></pre>
    <p>Press the button above to draw both arrows. In real, high-dimensional embeddings these analogies work well for some relations and poorly for others — the effect is real but it is not a law.</p>

    <h2>Measuring closeness</h2>
    <p>"Near" almost always means <strong>cosine similarity</strong>: the angle between two vectors, ignoring their length.</p>
    <pre><code>similarity = (a · b) / (|a| × |b|)      <span class="tok-com"># 1 = same direction, 0 = unrelated</span></code></pre>
    <p>Length tends to encode how frequent or emphatic a word is, which you usually do not want polluting a similarity score — hence the angle rather than the distance. This one function powers most of what gets called "semantic search": embed the documents once, embed the query, return the nearest.</p>

    <div class="callout tip">
      <div class="callout-title">This is what a vector database stores</div>
      <p>Retrieval-augmented generation (RAG) is exactly this pipeline: chop documents into chunks, embed each chunk, and at question time embed the question and fetch the nearest chunks to paste into the prompt. The "magic" is a nearest-neighbour lookup.</p>
    </div>

    <h2>Tokens, not words</h2>
    <p>One correction before the next lesson: models do not embed words, they embed <strong>tokens</strong> — common chunks of characters. Frequent words are one token; rarer ones are split.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Text</th><th>Tokens</th></tr></thead>
      <tbody>
        <tr><td><code>learning</code></td><td><code>learning</code> — one token, it is common</td></tr>
        <tr><td><code>tokenization</code></td><td><code>token</code> + <code>ization</code></td></tr>
        <tr><td><code>Bhubaneswar</code></td><td>four or five fragments</td></tr>
        <tr><td><code>🙂</code></td><td>often several bytes' worth of tokens</td></tr>
      </tbody>
    </table></div>
    <p>This is why models are strangely bad at counting letters in a word: they never see the letters. They see the chunk.</p>`,

  init(root) {
    const canvas = root.querySelector('#embCanvas');
    const info = root.querySelector('#embInfo');
    const analogyBtn = root.querySelector('#embAnalogy');
    let hover = null, showAnalogy = false, layout = [];

    analogyBtn.addEventListener('click', () => {
      showAnalogy = !showAnalogy;
      analogyBtn.setAttribute('aria-pressed', String(showAnalogy));
      analogyBtn.textContent = showAnalogy ? 'Hide the analogy arrows' : 'Show the king − man + woman arrow';
    });

    const pick = (mx, my) => {
      let best = null, bestD = 26 * 26;
      for (const p of layout) {
        const d = (p.px - mx) ** 2 + (p.py - my) ** 2;
        if (d < bestD) { bestD = d; best = p; }
      }
      return best;
    };
    const onMove = e => {
      const r = canvas.getBoundingClientRect();
      hover = pick(e.clientX - r.left, e.clientY - r.top);
      if (hover) {
        const near = layout
          .filter(p => p !== hover)
          .sort((a, b) => dist(a, hover) - dist(b, hover))
          .slice(0, 3).map(p => p.word);
        info.textContent = `${hover.word} → nearest: ${near.join(', ')}`;
      } else info.textContent = 'Hover a word';
    };
    const dist = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', () => { hover = null; info.textContent = 'Hover a word'; });

    // one hue per cluster, readable on both themes
    const GROUPS = [
      ['royal', 'royalty', c => c.accent],
      ['people', 'people', () => '#3b82f6'],
      ['animal', 'animals', c => c.accent2],
      ['food', 'food', c => c.accent3],
      ['code', 'computing', () => '#d9a441'],
      ['verb', 'actions', () => '#e0619c'],
    ];
    const colorOf = (group, c) => (GROUPS.find(g => g[0] === group)?.[2] || (() => c.accent))(c);

    const s = scene(canvas, (ctx, { w, h, t, c }) => {
      const pad = 34;
      layout = WORDS.map(([word, x, y, group], i) => ({
        word, x, y, group,
        px: pad + x * (w - pad * 2) + Math.sin(t * 0.5 + i) * 1.6,
        py: pad + (1 - y) * (h - pad * 2 - 16) + Math.cos(t * 0.42 + i * 1.3) * 1.6,
      }));
      const at = name => layout.find(p => p.word === name);

      ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.globalAlpha = .7;
      for (let i = 0; i <= 5; i++) {
        const gx = pad + (i / 5) * (w - pad * 2), gy = pad + (i / 5) * (h - pad * 2);
        ctx.beginPath(); ctx.moveTo(gx, pad); ctx.lineTo(gx, h - pad); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(w - pad, gy); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      if (hover) {
        const near = layout.filter(p => p !== hover).sort((a, b) => dist(a, hover) - dist(b, hover)).slice(0, 3);
        near.forEach((p, i) => {
          ctx.strokeStyle = c.accent; ctx.globalAlpha = 0.7 - i * 0.16; ctx.lineWidth = 1.8;
          ctx.setLineDash([4, 3]);
          ctx.beginPath(); ctx.moveTo(hover.px, hover.py); ctx.lineTo(p.px, p.py); ctx.stroke();
        });
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }

      if (showAnalogy) {
        const arrow = (a, b, col, label) => {
          if (!a || !b) return;
          const ang = Math.atan2(b.py - a.py, b.px - a.px);
          ctx.strokeStyle = col; ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(b.px, b.py);
          ctx.lineTo(b.px - Math.cos(ang - 0.4) * 10, b.py - Math.sin(ang - 0.4) * 10);
          ctx.lineTo(b.px - Math.cos(ang + 0.4) * 10, b.py - Math.sin(ang + 0.4) * 10);
          ctx.closePath(); ctx.fillStyle = col; ctx.fill();
          ctx.font = `600 10px ${c.mono}`; ctx.textAlign = 'center';
          ctx.fillText(label, (a.px + b.px) / 2 + 26, (a.py + b.py) / 2);
        };
        arrow(at('man'), at('king'), c.accent, '+royal');
        arrow(at('woman'), at('queen'), c.accent2, '+royal');
      }

      layout.forEach(p => {
        const isHot = hover === p;
        const col = colorOf(p.group, c);
        ctx.beginPath(); ctx.arc(p.px, p.py, isHot ? 6 : 4, 0, 7);
        ctx.fillStyle = col; ctx.globalAlpha = isHot ? 1 : 0.8; ctx.fill(); ctx.globalAlpha = 1;
        ctx.font = `${isHot ? 600 : 500} ${isHot ? 12 : 11}px ${c.sans}`;
        ctx.fillStyle = isHot ? c.text : c.soft;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(p.word, p.px, p.py - 8);
      });
      // legend
      let lx = 14;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `500 10px ${c.mono}`;
      GROUPS.forEach(([key, label]) => {
        ctx.fillStyle = colorOf(key, c);
        ctx.beginPath(); ctx.arc(lx + 4, h - 12, 3.5, 0, 7); ctx.fill();
        ctx.fillStyle = c.muted;
        ctx.fillText(label, lx + 12, h - 11);
        lx += 20 + ctx.measureText(label).width;
      });
      ctx.textBaseline = 'alphabetic';
    }, { height: 310 });

    return () => {
      canvas.removeEventListener('pointermove', onMove);
      s.stop();
    };
  },
};
