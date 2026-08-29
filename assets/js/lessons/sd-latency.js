import { scene, controls, roundRect, clamp } from '../anim.js';

export default {
  id: 'sd-latency',
  title: 'Latency, throughput and queues',
  minutes: 8,
  interactive: true,
  tags: ['latency', 'throughput', 'queueing', 'utilisation', 'p99', 'tail latency', 'little’s law'],
  summary: 'Response time does not degrade gracefully as a system fills up. It stays flat, stays flat, and then goes vertical — and knowing where that wall is changes how you run a service.',

  body: () => `
    <h2>Two different numbers</h2>
    <p><strong>Throughput</strong> is how many requests a system finishes per second. <strong>Latency</strong> is how long one request waits. They are related, but not the way intuition suggests: pushing throughput up does not push latency up smoothly. Latency is nearly flat while there is slack, then it explodes.</p>
    <p>The reason is queueing. A server that can handle 100 requests per second and receives exactly 100 has no slack at all, so any burst — and traffic always arrives in bursts — produces a backlog it never gets a quiet moment to clear.</p>

    <h2>Watch the wall</h2>
    <p>Raise the arrival rate slowly. Up to about 70% utilisation almost nothing happens. Past 80% the queue starts to persist. Past 95% it runs away, and the curve on the right shows why: average wait goes as 1/(1−ρ), which has a vertical asymptote at full utilisation.</p>

    <div class="demo">
      <div class="demo-head"><h4>One server, one queue</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage"><canvas id="qCanvas"></canvas></div>
      <div class="demo-controls">
        <div class="ctrl"><label>arrivals λ (req/s) <output data-for="lam">0</output></label>
          <input type="range" data-key="lam" data-decimals="0" min="1" max="97" step="1" value="60"></div>
        <div class="ctrl"><label>capacity µ (req/s) <output data-for="mu">0</output></label>
          <input type="range" data-key="mu" data-decimals="0" min="20" max="200" step="1" value="100"></div>
        <div class="ctrl" style="flex:1 1 100%"><label>service time</label>
          <div class="pill-row" id="qMode">
            <button class="pill" type="button" data-mode="exp" aria-pressed="true">variable</button>
            <button class="pill" type="button" data-mode="det" aria-pressed="false">constant</button>
          </div></div>
        <button class="btn secondary" id="qReset" type="button">Clear the queue</button>
        <div class="readout">
          <span>ρ <b id="qUtil">—</b></span><span>queue <b id="qLen">—</b></span>
          <span>p50 <b id="qP50">—</b></span><span>p99 <b id="qP99">—</b></span>
        </div>
      </div>
    </div>

    <p>Switch service time to <strong>constant</strong> at the same utilisation. The queue roughly halves. Nothing about the average changed — only the <em>variance</em> of how long each request takes. Variability alone creates queues, which is why one slow query mixed into an otherwise fast workload hurts far more than its share of the traffic suggests.</p>

    <h2>Little's Law</h2>
    <p>One equation ties the three quantities together, and it holds for any stable system regardless of how it works inside:</p>
    <pre><code>L = λ × W

L = requests in the system    λ = arrival rate    W = time in the system</code></pre>
    <p>It is more useful than it looks. If 2,000 requests per second arrive and each takes 50 ms, then on average 100 requests are in flight — so a thread pool of 20 is guaranteed to be a bottleneck, without measuring anything. Run it backwards and a growing queue with steady arrivals tells you latency has risen, before any alert fires.</p>

    <h2>Averages lie; percentiles do not</h2>
    <p>An average response time hides exactly the requests you care about. Report percentiles instead:</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Metric</th><th>Means</th><th>Why it matters</th></tr></thead>
      <tbody>
        <tr><td><strong>p50</strong></td><td>Half of requests are faster</td><td>The typical experience</td></tr>
        <tr><td><strong>p95 / p99</strong></td><td>1 in 20 / 1 in 100 are slower</td><td>What your unlucky users get, every day</td></tr>
        <tr><td><strong>p99.9</strong></td><td>1 in 1,000</td><td>Timeouts, retries and pager duty live here</td></tr>
      </tbody>
    </table></div>
    <p>The tail also compounds. If rendering a page needs 10 backend calls and each has a 1% chance of being slow, roughly 10% of pages contain a slow call. This is why systems that fan out widely obsess over p99 — at enough fan-out, the tail becomes the average experience.</p>

    <div class="callout warn">
      <div class="callout-title">Never run a queue at 100%</div>
      <p>Capacity planning targets 50–70% utilisation at peak, not 95%. The remaining headroom is not waste — it is what absorbs bursts, what lets you survive losing an instance, and what keeps p99 from detaching from p50. A "fully utilised" system is one with no margin for a bad minute.</p>
    </div>

    <h2>What actually helps</h2>
    <ul>
      <li><strong>Add capacity</strong> — more servers, or a faster path per request. Moves the wall right.</li>
      <li><strong>Reduce variance</strong> — separate slow work onto its own pool so it cannot block fast work.</li>
      <li><strong>Shed load</strong> — reject or queue excess deliberately. A fast rejection beats a timeout that leaves work half-done.</li>
      <li><strong>Do less</strong> — cache the answer, and the request never reaches the queue at all. That is the next lesson.</li>
    </ul>`,

  init(root) {
    const canvas = root.querySelector('#qCanvas');
    const state = { lam: 60, mu: 100 };
    controls(root, state);

    let mode = 'exp';
    let queue = [];          // arrival timestamps waiting for service
    let serving = null;      // { since, need, arrived }
    let clock = 0, nextArrival = 0;
    let samples = [];        // recent end-to-end latencies, in ms
    const SPEED = 6;         // run the simulation faster than wall-clock

    root.querySelector('#qMode').addEventListener('click', e => {
      const btn = e.target.closest('[data-mode]');
      if (!btn) return;
      mode = btn.dataset.mode;
      root.querySelectorAll('#qMode .pill').forEach(p => p.setAttribute('aria-pressed', String(p === btn)));
    });
    root.querySelector('#qReset').addEventListener('click', () => { queue = []; serving = null; samples = []; });

    const serviceTime = () =>
      mode === 'exp' ? -Math.log(1 - Math.random()) / state.mu : 1 / state.mu;

    function step(dt) {
      // `clock` is advanced as work is consumed, so a request's latency
      // includes its own service time and not just the wait before it
      const start = clock;
      clock += dt;
      if (nextArrival < start) nextArrival = start;
      while (nextArrival < clock) {
        if (queue.length < 4000) queue.push(nextArrival);
        nextArrival += -Math.log(1 - Math.random()) / state.lam;
      }

      let now = start, budget = dt;
      while (budget > 0) {
        if (!serving) {
          if (!queue.length) break;
          if (queue[0] > now) {                    // nothing has arrived yet
            const skip = Math.min(budget, queue[0] - now);
            now += skip; budget -= skip;
            continue;
          }
          serving = { arrived: queue.shift(), need: serviceTime(), done: 0 };
        }
        const take = Math.min(budget, serving.need - serving.done);
        serving.done += take; budget -= take; now += take;
        if (serving.done >= serving.need - 1e-9) {
          samples.push((now - serving.arrived) * 1000);
          if (samples.length > 400) samples.shift();
          serving = null;
        }
      }
    }

    const pct = p => {
      if (!samples.length) return NaN;
      const sorted = [...samples].sort((a, b) => a - b);
      return sorted[clamp(Math.floor(p * sorted.length), 0, sorted.length - 1)];
    };
    // theoretical mean time in system, in ms
    const theory = (rho, mu) => {
      if (rho >= 0.995) return Infinity;
      const wq = mode === 'exp'
        ? rho / (mu * (1 - rho))            // M/M/1
        : rho / (2 * mu * (1 - rho));       // M/D/1
      return (wq + 1 / mu) * 1000;
    };

    const s = scene(canvas, (ctx, { w, h, dt, c }) => {
      for (let i = 0; i < SPEED; i++) step(Math.min(dt, 0.05));

      const rho = clamp(state.lam / state.mu, 0, 1.2);
      root.querySelector('#qUtil').textContent = (rho * 100).toFixed(0) + '%';
      root.querySelector('#qLen').textContent = queue.length + (serving ? 1 : 0);
      root.querySelector('#qP50').textContent = samples.length ? Math.round(pct(0.5)) + ' ms' : '—';
      root.querySelector('#qP99').textContent = samples.length ? Math.round(pct(0.99)) + ' ms' : '—';

      const gap = 24, leftW = Math.min(w * 0.46, 330);
      /* ---------- left: the queue itself ---------- */
      const rowY = h * 0.42;
      const boxW = 15, boxH = 22, shown = Math.min(queue.length, 11);
      ctx.font = `500 10px ${c.mono}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = c.muted;
      ctx.fillText('waiting in the queue', 4, rowY - 26);

      const queueRight = leftW - 74;
      for (let i = 0; i < 11; i++) {
        const x = queueRight - (i + 1) * (boxW + 4);
        ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
        roundRect(ctx, x, rowY - boxH / 2, boxW, boxH, 4); ctx.stroke();
        if (i >= shown) continue;
        const age = clamp((clock - queue[i]) * 2, 0, 1);
        ctx.fillStyle = age > 0.6 ? c.accent3 : c.accent;
        ctx.globalAlpha = 0.4 + 0.55 * age;
        roundRect(ctx, x, rowY - boxH / 2, boxW, boxH, 4); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (!queue.length) {
        ctx.fillStyle = c.muted; ctx.font = `500 10px ${c.mono}`; ctx.textAlign = 'center';
        ctx.fillText('queue empty', queueRight - 5.5 * (boxW + 4), rowY + boxH + 8);
        ctx.textAlign = 'left';
      }
      if (queue.length > shown) {
        ctx.fillStyle = c.accent3; ctx.font = `600 11px ${c.mono}`; ctx.textAlign = 'right';
        ctx.fillText(`+${queue.length - shown}`, queueRight - shown * (boxW + 4) - 6, rowY + 4);
        ctx.textAlign = 'left';
      }

      // the server
      const sx = leftW - 34, sy = rowY;
      ctx.strokeStyle = c.line; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(queueRight + 4, rowY); ctx.lineTo(sx - 24, rowY); ctx.stroke();
      ctx.beginPath(); ctx.arc(sx, sy, 20, 0, 7);
      ctx.fillStyle = c.surface; ctx.fill();
      ctx.strokeStyle = serving ? c.accent2 : c.line; ctx.lineWidth = 2.4; ctx.stroke();
      if (serving) {
        ctx.strokeStyle = c.accent2; ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.arc(sx, sy, 20, -Math.PI / 2, -Math.PI / 2 + (serving.done / serving.need) * Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = c.muted; ctx.font = `500 10px ${c.mono}`; ctx.textAlign = 'center';
      ctx.fillText('server', sx, sy + 36);
      ctx.fillText(`${(rho * 100).toFixed(0)}% busy`, sx, sy + 50);

      /* ---------- right: utilisation vs latency ---------- */
      const ox = leftW + gap, plotW = w - ox - 10;
      const padT = 26, padB = 26, plotH = h - padT - padB;
      const yMax = Math.max(60, theory(0.93, state.mu));
      const X = r => ox + r * plotW;
      const Y = ms => padT + (1 - clamp(ms / yMax, 0, 1)) * plotH;

      ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ox, Y(0)); ctx.lineTo(ox + plotW, Y(0)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox, padT); ctx.lineTo(ox, Y(0)); ctx.stroke();

      // the safe operating zone
      ctx.fillStyle = c.accent2; ctx.globalAlpha = 0.05;
      ctx.fillRect(ox, padT, plotW * 0.7, plotH); ctx.globalAlpha = 1;

      ctx.strokeStyle = c.accent; ctx.lineWidth = 2.2; ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const r = (i / 120) * 0.985;
        const v = Y(theory(r, state.mu));
        i ? ctx.lineTo(X(r), v) : ctx.moveTo(X(r), v);
      }
      ctx.stroke();

      const here = clamp(rho, 0, 0.985);
      ctx.setLineDash([3, 4]); ctx.strokeStyle = c.line;
      ctx.beginPath(); ctx.moveTo(X(here), Y(0)); ctx.lineTo(X(here), Y(theory(here, state.mu))); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = c.accent3;
      ctx.beginPath(); ctx.arc(X(here), Y(theory(here, state.mu)), 5, 0, 7); ctx.fill();

      // what the simulation actually measured
      if (samples.length > 20) {
        ctx.strokeStyle = c.accent2; ctx.lineWidth = 2;
        const my = Y(pct(0.5));
        ctx.beginPath(); ctx.arc(X(here), my, 4, 0, 7); ctx.stroke();
      }

      ctx.font = `500 10px ${c.mono}`; ctx.fillStyle = c.muted;
      ctx.textAlign = 'left'; ctx.fillText('mean latency vs utilisation', ox + 2, padT - 8);
      ctx.fillText('0%', ox, h - 8);
      ctx.textAlign = 'center'; ctx.fillText('70%', X(0.7), h - 8);
      ctx.textAlign = 'right'; ctx.fillText('100%', ox + plotW, h - 8);
      ctx.textAlign = 'right'; ctx.fillStyle = c.accent2;
      ctx.fillText('◯ measured', ox + plotW - 62, padT - 8);
      ctx.fillStyle = c.accent;
      ctx.fillText('— theory', ox + plotW, padT - 8);
    }, { height: 260 });

    return () => s.stop();
  },
};
