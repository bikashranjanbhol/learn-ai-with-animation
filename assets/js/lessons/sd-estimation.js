import { scene, clamp } from '../anim.js';

/* A day of traffic, normalised so the mean is exactly 1.0.
   The peak of this curve is where the "peak factor" comes from. */
const DAY = Array.from({ length: 96 }, (_, i) => {
  const h = (i / 96) * 24;
  const bump = (c, w, a) => a * Math.exp(-(((h - c) / w) ** 2));
  return 0.15 + bump(11, 3.2, 1.0) + bump(20, 2.4, 2.4) + bump(15, 4, 0.45);
});
const DAY_MEAN = DAY.reduce((a, b) => a + b, 0) / DAY.length;
const CURVE = DAY.map(v => v / DAY_MEAN);
const PEAK_FACTOR = Math.max(...CURVE);

const fmt = n => {
  if (!isFinite(n)) return '—';
  const u = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [d, s] of u) if (n >= d) return (n / d).toFixed(n / d < 10 ? 1 : 0) + s;
  return n < 10 ? n.toFixed(1) : String(Math.round(n));
};
const bytes = n => {
  const u = [[1e15, 'PB'], [1e12, 'TB'], [1e9, 'GB'], [1e6, 'MB'], [1e3, 'KB']];
  for (const [d, s] of u) if (n >= d) return (n / d).toFixed(n / d < 10 ? 1 : 0) + ' ' + s;
  return Math.round(n) + ' B';
};

export default {
  id: 'sd-estimation',
  title: 'Estimating before you design',
  minutes: 7,
  interactive: true,
  tags: ['capacity', 'estimation', 'qps', 'back of the envelope', 'latency numbers', 'scale'],
  summary: 'Before choosing a database, work out how big the problem is. Two minutes of arithmetic decides whether you need one box or a fleet.',

  body: () => `
    <h2>The number that decides everything</h2>
    <p>"Design a photo sharing service" has no answer until you know the scale. A thousand uploads a day fits on a single server with a directory of files. A billion uploads a day is a different discipline entirely — and no amount of good taste in architecture recovers from getting that wrong.</p>
    <p>So the first move is always the same: turn the product description into numbers.</p>
    <ol>
      <li><strong>Traffic.</strong> Users × actions per user per day ÷ 86,400 = average requests per second.</li>
      <li><strong>Peak.</strong> Multiply by 2–5×. Traffic is not flat — everyone is awake at the same time.</li>
      <li><strong>Storage.</strong> Writes per day × bytes per write × retention, plus replication.</li>
      <li><strong>Bandwidth.</strong> Reads per second × bytes per read.</li>
    </ol>
    <p>Four lines. The point is not precision — it is finding out which order of magnitude you are in, because the answer changes the design.</p>

    <h2>Size a system</h2>
    <p>Drag the inputs and watch which numbers become uncomfortable first. For most read-heavy products, storage stays boring for years while read bandwidth becomes the problem — which is exactly why caches and CDNs exist.</p>

    <div class="demo">
      <div class="demo-head"><h4>Back-of-the-envelope calculator</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage">
        <canvas id="dayCanvas"></canvas>
        <div class="calc-grid" id="calcOut"></div>
      </div>
      <div class="demo-controls">
        <div class="ctrl"><label>daily active users <output id="oUsers">—</output></label>
          <input type="range" id="iUsers" min="0" max="100" step="1" value="55"></div>
        <div class="ctrl"><label>writes per user/day <output id="oActions">—</output></label>
          <input type="range" id="iActions" min="1" max="120" step="1" value="4"></div>
        <div class="ctrl"><label>bytes per item <output id="oSize">—</output></label>
          <input type="range" id="iSize" min="0" max="100" step="1" value="45"></div>
        <div class="ctrl"><label>read : write ratio <output id="oRatio">—</output></label>
          <input type="range" id="iRatio" min="0" max="100" step="1" value="50"></div>
        <div class="ctrl"><label>retention <output id="oDays">—</output></label>
          <input type="range" id="iDays" min="30" max="1825" step="5" value="365"></div>
      </div>
    </div>

    <h3>Reading the result</h3>
    <p>Rough thresholds worth carrying in your head, for one ordinary server:</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Quantity</th><th>Comfortable</th><th>Needs a real design</th></tr></thead>
      <tbody>
        <tr><td>Requests per second</td><td>&lt; 1,000</td><td>&gt; 10,000</td></tr>
        <tr><td>Total data</td><td>&lt; 1 TB</td><td>&gt; 10 TB — sharding territory</td></tr>
        <tr><td>Egress bandwidth</td><td>&lt; 100 MB/s</td><td>&gt; 1 GB/s — you need a CDN</td></tr>
        <tr><td>Writes per second</td><td>&lt; 5,000 to one primary</td><td>Beyond that, partition by key</td></tr>
      </tbody>
    </table></div>

    <h2>Latency numbers worth memorising</h2>
    <p>The other half of estimation is knowing what things cost. These are approximate and have been for years — what matters is the ratios between them, which are stable.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Operation</th><th>Time</th><th>Relative</th></tr></thead>
      <tbody>
        <tr><td>L1 cache reference</td><td>~1 ns</td><td>1×</td></tr>
        <tr><td>Main memory reference</td><td>~100 ns</td><td>100×</td></tr>
        <tr><td>Read 1 MB sequentially from memory</td><td>~50 µs</td><td>50,000×</td></tr>
        <tr><td>SSD random read</td><td>~100 µs</td><td>100,000×</td></tr>
        <tr><td>Round trip within a datacentre</td><td>~500 µs</td><td>500,000×</td></tr>
        <tr><td>Read 1 MB from SSD</td><td>~1 ms</td><td>1,000,000×</td></tr>
        <tr><td>Disk seek (spinning)</td><td>~10 ms</td><td>10,000,000×</td></tr>
        <tr><td>Round trip across a continent</td><td>~150 ms</td><td>150,000,000×</td></tr>
      </tbody>
    </table></div>
    <p>Two consequences fall straight out of that table. Memory is roughly a thousand times faster than an SSD, which is the entire argument for caching. And a cross-continent round trip costs more than ten thousand memory lookups, which is the entire argument for putting servers near users — and for not making thirty sequential calls to render one page.</p>

    <div class="callout tip">
      <div class="callout-title">Round aggressively</div>
      <p>Use 100,000 seconds for a day, not 86,400. Call a year 3 × 10⁷ seconds. Round every input to one significant figure. You are looking for "gigabytes or petabytes", and precision you did not have in the inputs cannot appear in the output.</p>
    </div>

    <h2>What the estimate is actually for</h2>
    <p>An estimate is not a plan — it is a filter. It tells you which parts of the system are allowed to be simple.</p>
    <ul>
      <li><strong>It rules designs out.</strong> If the whole dataset is 40 GB, it fits in RAM, and half the complicated answers are unnecessary.</li>
      <li><strong>It finds the bottleneck early.</strong> The number that goes uncomfortable first is the one your design has to be built around.</li>
      <li><strong>It sets the budget.</strong> Bandwidth and storage convert directly into money, and often the cheapest fix is a product decision — smaller images, shorter retention — not an architectural one.</li>
    </ul>
    <p>With the scale in hand, the next question is what happens to response times as the system gets busy.</p>`,

  init(root) {
    const $ = s => root.querySelector(s);
    const out = $('#calcOut');
    const inputs = {
      users: $('#iUsers'), actions: $('#iActions'), size: $('#iSize'),
      ratio: $('#iRatio'), days: $('#iDays'),
    };
    // log-scaled sliders: position 0–100 maps onto a decade range
    const logScale = (pos, lo, hi) => lo * Math.pow(hi / lo, pos / 100);
    let model = {};

    function recompute() {
      const users = logScale(+inputs.users.value, 1e3, 1e9);
      const actions = +inputs.actions.value;
      const size = logScale(+inputs.size.value, 200, 5e6);
      const ratio = logScale(+inputs.ratio.value, 1, 1000);
      const days = +inputs.days.value;

      const writesPerDay = users * actions;
      const writeQps = writesPerDay / 86400;
      const readQps = writeQps * ratio;
      const peakRead = readQps * PEAK_FACTOR;
      const storage = writesPerDay * size * days;
      const egress = readQps * size;

      model = { users, actions, size, ratio, days, writeQps, readQps, peakRead, storage, egress };

      $('#oUsers').textContent = fmt(users);
      $('#oActions').textContent = actions;
      $('#oSize').textContent = bytes(size);
      $('#oRatio').textContent = fmt(ratio) + ' : 1';
      $('#oDays').textContent = days >= 365 ? (days / 365).toFixed(1) + ' yr' : days + ' d';

      const cell = (label, value, note, hot) => `
        <div class="calc-cell${hot ? ' hot' : ''}">
          <span class="calc-label">${label}</span>
          <span class="calc-value">${value}</span>
          <span class="calc-note">${note}</span>
        </div>`;

      out.innerHTML =
        cell('Writes', fmt(writeQps) + '/s', fmt(writesPerDay) + ' per day', writeQps > 5000) +
        cell('Reads (average)', fmt(readQps) + '/s', 'at ' + fmt(ratio) + ':1 read ratio', readQps > 10000) +
        cell('Reads (peak)', fmt(peakRead) + '/s', PEAK_FACTOR.toFixed(1) + '× the daily average', peakRead > 10000) +
        cell('Stored data', bytes(storage), 'over ' + (days >= 365 ? (days / 365).toFixed(1) + ' years' : days + ' days'), storage > 1e13) +
        cell('Stored ×3 replicas', bytes(storage * 3), 'what you actually buy', storage * 3 > 1e13) +
        cell('Read bandwidth', bytes(egress) + '/s', egress > 1e9 ? 'CDN territory' : 'origin can serve this', egress > 1e9);
    }

    Object.values(inputs).forEach(i => i.addEventListener('input', recompute));
    recompute();

    const s = scene(root.querySelector('#dayCanvas'), (ctx, { w, h, t, c }) => {
      const padL = 44, padR = 12, padT = 18, padB = 22;
      const gw = w - padL - padR, gh = h - padT - padB;
      const X = i => padL + (i / (CURVE.length - 1)) * gw;
      const Y = v => padT + (1 - v / (PEAK_FACTOR * 1.12)) * gh;

      ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(w - padR, Y(0)); ctx.stroke();

      // the daily average, and the peak the design has to survive
      ctx.setLineDash([4, 4]); ctx.strokeStyle = c.line;
      ctx.beginPath(); ctx.moveTo(padL, Y(1)); ctx.lineTo(w - padR, Y(1)); ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(padL, Y(0));
      CURVE.forEach((v, i) => ctx.lineTo(X(i), Y(v)));
      ctx.lineTo(w - padR, Y(0)); ctx.closePath();
      const g = ctx.createLinearGradient(0, padT, 0, Y(0));
      g.addColorStop(0, c.accent); g.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.16; ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1;

      ctx.strokeStyle = c.accent; ctx.lineWidth = 2.2; ctx.beginPath();
      CURVE.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
      ctx.stroke();

      // a marker sweeping through the day, reading off the live rate
      const pos = (t * 0.06) % 1;
      const idx = clamp(Math.round(pos * (CURVE.length - 1)), 0, CURVE.length - 1);
      const rate = model.readQps * CURVE[idx];
      ctx.strokeStyle = c.accent3; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(X(idx), Y(0)); ctx.lineTo(X(idx), Y(CURVE[idx])); ctx.stroke();
      ctx.fillStyle = c.accent3;
      ctx.beginPath(); ctx.arc(X(idx), Y(CURVE[idx]), 4.5, 0, 7); ctx.fill();

      ctx.font = `500 10px ${c.mono}`; ctx.fillStyle = c.muted; ctx.textAlign = 'right';
      ctx.fillText('avg', padL - 6, Y(1) + 3);
      ctx.fillText('peak', padL - 6, Y(PEAK_FACTOR) + 3);
      ctx.textAlign = 'left';
      ctx.fillText('00:00', padL, h - 6);
      ctx.textAlign = 'center'; ctx.fillText('12:00', padL + gw / 2, h - 6);
      ctx.textAlign = 'right'; ctx.fillText('24:00', w - padR, h - 6);
      ctx.textAlign = 'left'; ctx.fillStyle = c.accent3;
      ctx.fillText(`${fmt(rate)} reads/s right now`, padL + 4, padT - 5);
    }, { height: 150 });

    return () => s.stop();
  },
};
