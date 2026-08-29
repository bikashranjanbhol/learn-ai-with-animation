/**
 * Text generation demo — a genuine (tiny) statistical model built from the
 * corpus below, sampled with a temperature you control.
 */
const CORPUS = `
a model learns patterns from data and then predicts what comes next .
a model does not store the text it read , it stores the patterns it found .
learning to build means building small things until the big ones make sense .
every model you use is a stack of the same simple parts repeated many times .
the model predicts one token at a time and feeds its own output back in .
attention lets every token look at every other token in the sentence .
training is a loop of guess , measure the error , and nudge the weights .
a good demo teaches faster than a long paragraph of careful prose .
the network learns to build an internal picture of the data it sees .
temperature decides how surprising the next token is allowed to be .
data quality decides almost everything about how the model behaves .
build small models first , then read the papers , then build bigger ones .
`;

function buildModel(text) {
  const tokens = text.trim().split(/\s+/);
  const bi = new Map(), uni = new Map(), starts = [];
  for (let i = 0; i < tokens.length; i++) {
    if (i >= 2 && tokens[i - 1] === '.') starts.push(tokens[i]);
    if (i >= 1) add(uni, tokens[i - 1], tokens[i]);
    if (i >= 2) add(bi, `${tokens[i - 2]} ${tokens[i - 1]}`, tokens[i]);
  }
  return { bi, uni, starts: starts.length ? starts : [tokens[0]] };
  function add(map, k, v) {
    if (!map.has(k)) map.set(k, new Map());
    const m = map.get(k);
    m.set(v, (m.get(v) || 0) + 1);
  }
}

const MODEL = buildModel(CORPUS);

function nextDistribution(prev2, prev1, temperature) {
  // back off: trust the 2-token context, but keep the 1-token context in play
  // so the distribution has more than one live candidate to show
  const counts = new Map();
  const blend = (src, weight) => {
    if (!src) return;
    for (const [tok, n] of src) counts.set(tok, (counts.get(tok) || 0) + n * weight);
  };
  blend(MODEL.bi.get(`${prev2} ${prev1}`), 1);
  blend(MODEL.uni.get(prev1), 0.45);
  if (!counts.size) counts.set('.', 1);
  const T = Math.max(0.05, temperature);
  const entries = [...counts.entries()].map(([tok, n]) => [tok, Math.pow(n, 1 / T)]);
  const total = entries.reduce((s, [, p]) => s + p, 0);
  return entries.map(([tok, p]) => ({ token: tok, p: p / total })).sort((a, b) => b.p - a.p);
}

function sample(dist) {
  let r = Math.random();
  for (const d of dist) { r -= d.p; if (r <= 0) return d.token; }
  return dist[dist.length - 1].token;
}

export default {
  id: 'generation',
  title: 'How a language model writes',
  minutes: 8,
  interactive: true,
  tags: ['llm', 'sampling', 'temperature', 'autoregressive', 'context window', 'hallucination'],
  summary: 'One token at a time, each one chosen from a probability distribution and then fed back in as input. There is no plan and no draft — only the next token.',

  body: () => `
    <h2>The loop</h2>
    <p>Everything from the previous lessons now runs in a cycle:</p>
    <ol>
      <li>Turn the text so far into tokens, and the tokens into embeddings.</li>
      <li>Run them through the transformer blocks.</li>
      <li>Get a probability for <em>every</em> token in the vocabulary — 50,000 numbers summing to 1.</li>
      <li>Pick one.</li>
      <li>Append it to the text and go back to step 1.</li>
    </ol>
    <p>That is what "autoregressive" means. The model has no buffer where it drafts a whole reply; the reply is the trace left behind by repeating this loop.</p>

    <h2>Watch it choose</h2>
    <p>The demo below is a real (if very small) statistical model built from a dozen sentences. It shows the candidates for the next token and how likely each one is, then samples one. The mechanism is the same as a large model's — only the quality of the distribution differs.</p>

    <div class="demo">
      <div class="demo-head"><h4>Sampling the next token</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage">
        <div class="gen-out" id="genOut"><span id="genText"></span><span class="caret"></span></div>
        <div class="gen-cands" id="genCands"></div>
      </div>
      <div class="demo-controls">
        <div class="ctrl"><label>temperature <output data-for="temp">0.80</output></label>
          <input type="range" data-key="temp" min="0.05" max="2" step="0.05" value="0.8"></div>
        <button class="btn" id="genRun" type="button">
          <svg viewBox="0 0 24 24"><path d="M6 4l12 8-12 8z"/></svg><span>Pause</span></button>
        <button class="btn secondary" id="genRestart" type="button">Restart</button>
      </div>
    </div>

    <h2>Temperature is the whole personality dial</h2>
    <p>Before sampling, the probabilities are reshaped. Low temperature exaggerates the leader — the model becomes predictable, repetitive and safe. High temperature flattens the distribution — unlikely tokens get a real chance, and the text becomes inventive, then incoherent.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Temperature</th><th>Behaviour</th><th>Use for</th></tr></thead>
      <tbody>
        <tr><td><strong>0</strong></td><td>Always the single most likely token</td><td>Extraction, classification, code fixes</td></tr>
        <tr><td><strong>0.7 – 1.0</strong></td><td>Follows the model's actual distribution</td><td>Ordinary conversation and writing</td></tr>
        <tr><td><strong>&gt; 1.3</strong></td><td>Flattened — rare tokens become plausible</td><td>Brainstorming, and not much else</td></tr>
      </tbody>
    </table></div>
    <p>Two relatives you will see next to it: <strong>top-k</strong> keeps only the k most likely tokens before sampling, and <strong>top-p</strong> (nucleus) keeps the smallest set whose probabilities add up to p. Both cut off the long tail of nonsense while leaving the sensible options in play.</p>

    <h2>What this explains</h2>
    <ul>
      <li><strong>Why answers vary.</strong> Unless temperature is 0, you are drawing a sample. The same prompt is a new draw each time.</li>
      <li><strong>Why models hallucinate.</strong> Nothing in the loop checks facts. The model emits the most plausible continuation, and a fluent falsehood scores well on plausibility. Grounding it in retrieved documents works because it changes what is plausible.</li>
      <li><strong>Why the context window matters.</strong> Only what is in the window can influence the next token. Anything outside it does not exist to the model.</li>
      <li><strong>Why prompting works at all.</strong> Your prompt is the prefix everything is conditioned on. Changing it changes the distribution — that is the entire mechanism.</li>
      <li><strong>Why "think step by step" helps.</strong> Each token is one fixed amount of computation. Writing out intermediate steps gives the model more forward passes to reach the answer, and lets it condition on its own reasoning.</li>
    </ul>

    <div class="callout tip">
      <div class="callout-title">One more stage, briefly</div>
      <p>A model trained only to predict the next token continues text; it does not answer questions. Turning it into an assistant takes further training on demonstrations of helpful replies, plus optimisation against human preference judgements. Same architecture, same loss, different data.</p>
    </div>

    <h2>Where to go from here</h2>
    <p>You now have the full path: numbers in, weighted sums, activations, a loss, gradients pushed backwards, attention wiring tokens together, and a sampling loop at the end. That is the entire stack — everything else is engineering, scale and data.</p>
    <p>The best next step is to build something. Train a small classifier on data you actually care about, feel the difference a learning rate makes, and come back to whichever lesson stops making sense.</p>`,

  init(root) {
    const textEl = root.querySelector('#genText');
    const candsEl = root.querySelector('#genCands');
    const runBtn = root.querySelector('#genRun');
    const tempInput = root.querySelector('input[data-key="temp"]');
    const tempOut = root.querySelector('output[data-for="temp"]');

    let temperature = 0.8, running = true, timer = null;
    let words = [], prev2 = '.', prev1 = '';

    tempInput.addEventListener('input', () => {
      temperature = parseFloat(tempInput.value);
      tempOut.textContent = temperature.toFixed(2);
      renderCands();
    });
    tempOut.textContent = temperature.toFixed(2);

    function restart() {
      prev2 = '.';
      prev1 = MODEL.starts[Math.floor(Math.random() * MODEL.starts.length)];
      words = [prev1];
      paint();
      renderCands();
    }

    function paint() {
      textEl.textContent = words.join(' ')
        .replace(/ \./g, '.').replace(/ ,/g, ',');
    }

    function renderCands(chosen) {
      const dist = nextDistribution(prev2, prev1, temperature).slice(0, 6);
      candsEl.innerHTML = dist.map(d => `
        <div class="cand${chosen === d.token ? ' chosen' : ''}">
          <span class="cand-tok">${d.token === '.' ? '·' : escapeHtml(d.token)}</span>
          <span class="cand-track"><span class="cand-fill" style="width:${(d.p * 100).toFixed(1)}%"></span></span>
          <span class="cand-p">${(d.p * 100).toFixed(0)}%</span>
        </div>`).join('');
    }

    function step() {
      const dist = nextDistribution(prev2, prev1, temperature);
      const tok = sample(dist);
      words.push(tok);
      if (words.length > 44) { words = words.slice(-30); }
      prev2 = prev1; prev1 = tok;
      paint();
      renderCands(tok);
    }

    runBtn.addEventListener('click', () => {
      running = !running;
      runBtn.querySelector('span').textContent = running ? 'Pause' : 'Generate';
    });
    root.querySelector('#genRestart').addEventListener('click', restart);

    restart();
    timer = setInterval(() => { if (running && !document.hidden) step(); }, 750);

    return () => clearInterval(timer);
  },
};

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
