import { scene, controls, roundRect, clamp } from '../anim.js';

export default {
  id: 'sd-resilience',
  title: 'Timeouts, retries and back-pressure',
  minutes: 9,
  interactive: true,
  tags: ['resilience', 'retry', 'backoff', 'jitter', 'circuit breaker', 'rate limit', 'token bucket', 'load shedding', 'idempotency'],
  summary: 'Every remote call fails eventually. What decides whether that is a blip or an outage is how politely the rest of the system reacts to it.',

  body: () => `
    <h2>The failure that spreads</h2>
    <p>A dependency slows down. Its callers wait, holding threads and connections. Their callers start waiting too. Within a minute a problem in one small service has consumed every request slot in the system, and services with nothing to do with it are down.</p>
    <p>Nothing here is a bug in the failing service. The damage is done by how everything else responds — and that behaviour is entirely under your control.</p>

    <h2>Timeouts come first</h2>
    <p>A call with no timeout is not a call, it is a promise to wait forever. Every remote operation needs a deadline, and the deadline should be derived from reality: if p99 is 80 ms, a 30-second timeout is not generous, it is a way to hold a thread hostage for 30 seconds. Set it a few multiples above p99 and treat crossing it as a failure.</p>
    <p>Better still, propagate a <strong>deadline</strong> through the call chain. If the user's request has 500 ms left, no downstream call should be permitted to take 2 seconds; work that cannot finish in time should be abandoned rather than completed for nobody.</p>

    <h2>Retries are a load multiplier</h2>
    <p>Retrying a failed call is obviously right — the failure might have been a dropped packet. It is also how a small outage becomes a big one: when a service starts failing, every caller retries, offered load triples, and the service can no longer recover even after the original cause is gone. It is being held down by the retries.</p>
    <p>Break the dependency below and compare the policies.</p>

    <div class="demo">
      <div class="demo-head"><h4>Retry storm vs circuit breaker</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage"><canvas id="retryCanvas"></canvas></div>
      <div class="demo-controls">
        <div class="ctrl" style="flex:1 1 100%"><label>retry policy</label>
          <div class="pill-row" id="retryPolicy">
            <button class="pill" type="button" data-policy="none" aria-pressed="true">no retries</button>
            <button class="pill" type="button" data-policy="immediate" aria-pressed="false">3× immediate</button>
            <button class="pill" type="button" data-policy="backoff" aria-pressed="false">3× backoff + jitter</button>
          </div></div>
        <button class="btn" id="retryBreak" type="button" aria-pressed="false">Break the dependency</button>
        <button class="btn secondary" id="retryCb" type="button" aria-pressed="false">Circuit breaker: off</button>
        <div class="readout"><span>load on dependency <b id="retryLoad">—</b></span><span>amplification <b id="retryAmp">—</b></span><span>users served <b id="retryOk">—</b></span></div>
      </div>
    </div>

    <h3>Reading that</h3>
    <ul>
      <li><strong>Immediate retries</strong> multiply offered load by roughly the retry count, exactly when the dependency has the least capacity to spare. The red line goes far above the capacity line and stays there.</li>
      <li><strong>Backoff with jitter</strong> spreads the retries out in time. Backoff alone is not enough — without jitter, every client that failed at the same moment retries at the same moment, and you get a synchronised wave instead of a flood.</li>
      <li><strong>The circuit breaker</strong> stops calling a dependency that is clearly broken, fails fast for a few seconds, then lets a probe through to check. Offered load drops to near zero, which is what actually lets the dependency recover.</li>
    </ul>
    <p>The breaker has three states: <strong>closed</strong> (normal), <strong>open</strong> (fail immediately, do not call), and <strong>half-open</strong> (allow one trial request; promote back to closed if it succeeds, back to open if it does not).</p>

    <div class="callout warn">
      <div class="callout-title">Only retry what is safe to repeat</div>
      <p>A retried write can execute twice — the first attempt may have succeeded with the response lost on the way back. Reads are naturally safe. Writes need an <strong>idempotency key</strong> the server can deduplicate on, or they need to not be retried at all. "Charge the card" is not a retryable operation unless you made it one.</p>
    </div>

    <h2>Rate limiting: protecting yourself deliberately</h2>
    <p>Retries and breakers are how a caller behaves. A rate limiter is how a service defends itself against callers that do not. The standard mechanism is a <strong>token bucket</strong>: tokens refill at a fixed rate, each request spends one, and a request that finds the bucket empty is rejected. The bucket's size is how much burst you tolerate; the refill rate is the sustained limit.</p>

    <div class="demo">
      <div class="demo-head"><h4>Token bucket</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage"><canvas id="bucketCanvas"></canvas></div>
      <div class="demo-controls">
        <div class="ctrl"><label>refill rate /s <output data-for="refill">10</output></label>
          <input type="range" data-key="refill" data-decimals="0" min="1" max="40" step="1" value="10"></div>
        <div class="ctrl"><label>bucket size (burst) <output data-for="burst">15</output></label>
          <input type="range" data-key="burst" data-decimals="0" min="1" max="40" step="1" value="15"></div>
        <div class="ctrl"><label>incoming /s <output data-for="rate">14</output></label>
          <input type="range" data-key="rate" data-decimals="0" min="1" max="60" step="1" value="14"></div>
        <div class="readout"><span>allowed <b id="bkOk">—</b></span><span>rejected <b id="bkNo">—</b></span></div>
      </div>
    </div>

    <p>Note what the bucket does when the request rate is below the refill rate: nothing. It only engages under abuse or a genuine surge, and then it fails requests <em>quickly and cheaply</em>. That is the point — a fast <code>429</code> costs you almost nothing, while the same request timing out ties up a thread for seconds.</p>

    <h2>The rest of the toolkit</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Technique</th><th>What it does</th></tr></thead>
      <tbody>
        <tr><td><strong>Bulkheads</strong></td><td>Separate connection pools per dependency, so one slow downstream cannot consume every thread</td></tr>
        <tr><td><strong>Load shedding</strong></td><td>Reject a fraction of traffic at the edge when overloaded — serving 80% well beats serving 100% badly</td></tr>
        <tr><td><strong>Graceful degradation</strong></td><td>Recommendations service down? Render the page without recommendations rather than failing it</td></tr>
        <tr><td><strong>Retry budgets</strong></td><td>Cap retries at a small percentage of total traffic, so retries can never dominate load</td></tr>
        <tr><td><strong>Backpressure</strong></td><td>Push slowness back to the caller instead of buffering without limit — an unbounded queue only converts an error into a timeout</td></tr>
      </tbody>
    </table></div>

    <div class="callout tip">
      <div class="callout-title">Design for the failed state, not the happy path</div>
      <p>For every dependency, answer three questions before shipping: what is the timeout, what happens when it fails, and what does the user see? "It should not fail" is not an answer — and a system where every dependency is required is only as available as the product of all of them.</p>
    </div>`,

  init(root) {
    const cleanups = [];

    /* ---------------- retry storm / circuit breaker ---------------- */
    {
      const canvas = root.querySelector('#retryCanvas');
      const CAP = 100;              // requests/sec the dependency can serve
      const BASE = 70;              // steady user traffic
      const WINDOW = 0.2;           // seconds per plotted sample
      const SAMPLES = 150;
      let policy = 'none', broken = false, breakerOn = false;
      let pending = [];             // scheduled retries
      let history = [];             // { offered, served, broken } per window
      let clock = 0, debt = 0;
      let breaker = { state: 'closed', changed: 0, fails: 0, total: 0 };
      let winOffered = 0, winServed = 0, winTime = 0, rateEma = BASE;

      root.querySelector('#retryPolicy').addEventListener('click', e => {
        const btn = e.target.closest('[data-policy]');
        if (!btn) return;
        policy = btn.dataset.policy;
        root.querySelectorAll('#retryPolicy .pill').forEach(p => p.setAttribute('aria-pressed', String(p === btn)));
      });
      const breakBtn = root.querySelector('#retryBreak');
      breakBtn.addEventListener('click', () => {
        broken = !broken;
        breakBtn.setAttribute('aria-pressed', String(broken));
        breakBtn.textContent = broken ? 'Repair the dependency' : 'Break the dependency';
      });
      const cbBtn = root.querySelector('#retryCb');
      cbBtn.addEventListener('click', () => {
        breakerOn = !breakerOn;
        cbBtn.setAttribute('aria-pressed', String(breakerOn));
        cbBtn.textContent = `Circuit breaker: ${breakerOn ? 'on' : 'off'}`;
        breaker = { state: 'closed', changed: clock, fails: 0, total: 0 };
      });

      const scheduleRetry = attemptNo => {
        if (policy === 'none' || attemptNo >= 3) return;
        const delay = policy === 'immediate'
          ? 0.05
          : Math.min(4, 0.25 * Math.pow(2, attemptNo)) * (0.5 + Math.random());   // backoff + jitter
        pending.push({ at: clock + delay, attempt: attemptNo + 1 });
      };

      function attempt(attemptNo) {
        // the breaker decides whether the call even reaches the dependency
        if (breakerOn) {
          if (breaker.state === 'open') {
            if (clock - breaker.changed > 3) { breaker.state = 'half'; breaker.changed = clock; }
            else return;
          }
          if (breaker.state === 'half' && Math.random() > 0.04) return;
        }
        winOffered++;
        // past capacity the dependency sheds a proportional share of calls
        const ok = !broken && (rateEma <= CAP || Math.random() < CAP / rateEma);
        breaker.total++; if (!ok) breaker.fails++;
        if (breakerOn) {
          if (breaker.state === 'half') {
            breaker.state = ok ? 'closed' : 'open'; breaker.changed = clock;
            breaker.fails = 0; breaker.total = 0;
          } else if (breaker.total > 30) {
            if (breaker.fails / breaker.total > 0.5) { breaker.state = 'open'; breaker.changed = clock; }
            breaker.fails = 0; breaker.total = 0;
          }
        }
        if (ok) winServed++; else scheduleRetry(attemptNo);
      }

      function step(dt) {
        clock += dt;
        debt += BASE * dt;
        while (debt > 1) { debt -= 1; attempt(0); }
        const due = pending.filter(p => p.at <= clock);
        pending = pending.filter(p => p.at > clock);
        for (const p of due) attempt(p.attempt);

        // rates are measured over a fixed window, not per animation frame
        winTime += dt;
        if (winTime >= WINDOW) {
          const offered = winOffered / winTime, served = winServed / winTime;
          rateEma = rateEma * 0.55 + offered * 0.45;
          history.push({ offered, served, broken });
          if (history.length > SAMPLES) history.shift();
          winOffered = 0; winServed = 0; winTime = 0;
        }
      }

      const s = scene(canvas, (ctx, { w, h, dt, c }) => {
        step(clamp(dt, 0.008, 0.05));

        const last = history[history.length - 1] || { offered: 0, served: 0 };
        root.querySelector('#retryLoad').textContent = Math.round(last.offered) + '/s';
        root.querySelector('#retryAmp').textContent = (last.offered / BASE).toFixed(1) + '×';
        root.querySelector('#retryOk').textContent = Math.round((last.served / BASE) * 100) + '%';

        const padL = 60, padR = 12, padT = 26, padB = 26;
        const gw = w - padL - padR, gh = h - padT - padB;
        const yMax = Math.max(CAP * 2.4, ...history.map(p => p.offered)) * 1.05;
        // newest sample sits at the right edge, so the chart reads like a monitor
        const X = i => padL + gw - ((history.length - 1 - i) / (SAMPLES - 1)) * gw;
        const Y = v => padT + (1 - clamp(v / yMax, 0, 1)) * gh;

        // shading for the windows in which the dependency was down
        history.forEach((p, i) => {
          if (!p.broken) return;
          ctx.fillStyle = c.accent3; ctx.globalAlpha = 0.08;
          ctx.fillRect(X(i), padT, gw / (SAMPLES - 1) + 1, gh);
        });
        ctx.globalAlpha = 1;

        ctx.strokeStyle = c.line; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(padL, Y(CAP)); ctx.lineTo(w - padR, Y(CAP)); ctx.stroke();
        ctx.setLineDash([]);

        const line = (key, col, width) => {
          ctx.strokeStyle = col; ctx.lineWidth = width; ctx.beginPath();
          history.forEach((p, i) => (i ? ctx.lineTo(X(i), Y(p[key])) : ctx.moveTo(X(i), Y(p[key]))));
          ctx.stroke();
        };
        line('offered', c.accent3, 2.2);
        line('served', c.accent2, 2);

        ctx.font = `500 10px ${c.mono}`; ctx.fillStyle = c.muted; ctx.textAlign = 'right';
        ctx.fillText('capacity', padL - 6, Y(CAP) + 3);
        ctx.fillText('0', padL - 6, Y(0) + 3);
        ctx.fillText(`${Math.round(BASE)}/s`, padL - 6, Y(BASE) + 3);
        ctx.textAlign = 'left';
        ctx.fillStyle = c.accent3; ctx.fillText('— offered to dependency', padL + 2, padT - 8);
        ctx.fillStyle = c.accent2; ctx.fillText('— successfully served', padL + 156, padT - 8);

        if (breakerOn) {
          const label = { closed: 'breaker closed', open: 'breaker OPEN — failing fast', half: 'breaker half-open — probing' }[breaker.state];
          ctx.fillStyle = breaker.state === 'closed' ? c.accent2 : breaker.state === 'open' ? c.accent3 : c.accent;
          ctx.font = `600 11px ${c.mono}`; ctx.textAlign = 'right';
          ctx.fillText(label, w - padR, h - 8);
        }
        ctx.textAlign = 'left'; ctx.fillStyle = c.muted; ctx.font = `500 10px ${c.mono}`;
        ctx.fillText('30 seconds →', padL, h - 8);
      }, { height: 240 });

      cleanups.push(() => s.stop());
    }

    /* ---------------- token bucket ---------------- */
    {
      const canvas = root.querySelector('#bucketCanvas');
      const state = { refill: 10, burst: 15, rate: 14 };
      controls(root, state);

      let tokens = state.burst, debt = 0, recent = [], drops = [];
      let clock = 0;

      const s = scene(canvas, (ctx, { w, h, dt, c }) => {
        clock += dt;
        tokens = Math.min(state.burst, tokens + state.refill * dt);
        debt += state.rate * dt;
        while (debt > 1) {
          debt -= 1;
          const allowed = tokens >= 1;
          if (allowed) tokens -= 1;
          recent.push(allowed ? 1 : 0);
          if (recent.length > 240) recent.shift();
          drops.push({ at: clock, allowed, y: 0.25 + Math.random() * 0.5 });
        }
        drops = drops.filter(d => clock - d.at < 1.6);

        const okRate = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
        root.querySelector('#bkOk').textContent = recent.length ? Math.round(okRate * 100) + '%' : '—';
        root.querySelector('#bkNo').textContent = recent.length ? Math.round((1 - okRate) * 100) + '%' : '—';

        const bw = 74, bh = h - 56;
        const bx = w * 0.5 - bw / 2, by = 30;

        // requests flowing in from the left, and the ones bounced away
        for (const d of drops) {
          const age = (clock - d.at) / 1.6;
          const y = by + d.y * bh;
          if (d.allowed) {
            const x = 10 + age * (bx - 10);
            ctx.fillStyle = c.accent2; ctx.globalAlpha = 1 - age * 0.5;
            ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill();
          } else {
            const x = Math.min(bx - 8, 10 + Math.min(age * 3, 1) * (bx - 18));
            ctx.fillStyle = c.accent3; ctx.globalAlpha = 1 - age;
            ctx.beginPath(); ctx.arc(x, y - age * 26, 3.2, 0, 7); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        // the bucket
        const frac = tokens / state.burst;
        ctx.fillStyle = c.sunken; roundRect(ctx, bx, by, bw, bh, 10); ctx.fill();
        ctx.fillStyle = c.accent;
        ctx.globalAlpha = 0.85;
        roundRect(ctx, bx + 3, by + 3 + (bh - 6) * (1 - frac), bw - 6, (bh - 6) * frac, 8); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = c.line; ctx.lineWidth = 1.6;
        roundRect(ctx, bx, by, bw, bh, 10); ctx.stroke();

        ctx.font = `600 13px ${c.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = frac > 0.45 ? '#fff' : c.text;
        ctx.fillText(tokens.toFixed(1), bx + bw / 2, by + bh - 16);
        ctx.font = `500 10px ${c.mono}`; ctx.fillStyle = c.muted; ctx.textBaseline = 'alphabetic';
        ctx.fillText('tokens', bx + bw / 2, by - 8);
        ctx.fillText(`+${state.refill}/s`, bx + bw / 2, by + bh + 16);

        ctx.textAlign = 'left';
        ctx.fillStyle = c.accent2; ctx.fillText('● allowed', 10, h - 10);
        ctx.fillStyle = c.accent3; ctx.fillText('● rejected · HTTP 429', 76, h - 10);
        ctx.textAlign = 'right'; ctx.fillStyle = c.muted;
        ctx.fillText(`${state.rate} req/s in · limit ${state.refill}/s`, w - 10, h - 10);
      }, { height: 220 });

      cleanups.push(() => s.stop());
    }

    return () => cleanups.forEach(fn => fn());
  },
};
