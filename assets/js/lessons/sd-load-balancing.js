import { scene, controls, roundRect, clamp, mix } from '../anim.js';

const STRATEGIES = {
  rr:    'round robin',
  rand:  'random',
  two:   'two choices',
  least: 'least busy',
  hash:  'hash by user',
};

export default {
  id: 'sd-load-balancing',
  title: 'Load balancing and horizontal scale',
  minutes: 8,
  interactive: true,
  tags: ['load balancer', 'horizontal scaling', 'round robin', 'health check', 'stateless', 'autoscaling'],
  summary: 'Adding servers only helps if work lands evenly on them. The routing rule you pick decides whether the tenth server is useful or idle.',

  body: () => `
    <h2>Scale up, or scale out</h2>
    <p>There are two ways to handle more traffic. <strong>Vertical</strong> scaling buys a bigger machine: no code changes, no distributed-systems problems, and a hard ceiling that gets expensive well before you reach it. <strong>Horizontal</strong> scaling adds more machines: effectively unlimited, cheaper per unit, and it forces you to answer a new question — which machine handles this request?</p>
    <p>Everything past that point assumes the servers are <strong>stateless</strong>: any instance can serve any request, because nothing important lives in local memory. Sessions go in a shared store, uploads go to object storage, and the local disk holds nothing you would miss. Get that wrong and horizontal scaling quietly stops working, because requests can no longer go anywhere.</p>

    <h2>Try the routing rules</h2>
    <p>Watch the queue depth on each server. Turn on the slow server and see which strategies notice — and which keep cheerfully feeding a machine that cannot keep up.</p>

    <div class="demo">
      <div class="demo-head"><h4>Five ways to pick a server</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage"><canvas id="lbCanvas"></canvas></div>
      <div class="demo-controls">
        <div class="ctrl"><label>servers <output data-for="servers">6</output></label>
          <input type="range" data-key="servers" data-decimals="0" min="2" max="10" step="1" value="6"></div>
        <div class="ctrl"><label>load <output data-for="load">75</output></label>
          <input type="range" data-key="load" data-decimals="0" min="20" max="95" step="1" value="75"></div>
        <div class="ctrl" style="flex:1 1 100%"><label>strategy</label>
          <div class="pill-row" id="lbStrategy">
            ${Object.entries(STRATEGIES).map(([k, v], i) =>
              `<button class="pill" type="button" data-strategy="${k}" aria-pressed="${i === 0}">${v}</button>`).join('')}
          </div></div>
        <button class="btn secondary" id="lbSlow" type="button" aria-pressed="false">Make server 1 slow</button>
        <div class="readout"><span>p50 <b id="lbP50">—</b></span><span>p99 <b id="lbP99">—</b></span><span>imbalance <b id="lbImb">—</b></span></div>
      </div>
    </div>

    <h3>What you should see</h3>
    <ul>
      <li><strong>Round robin</strong> spreads counts perfectly and load imperfectly — requests are not all the same size, so equal counts still leave uneven queues.</li>
      <li><strong>Random</strong> is worse than it looks. With pure random assignment some server always draws a bad hand, and the tail suffers for it.</li>
      <li><strong>Two choices</strong> — sample two servers at random, send to the shorter queue — is dramatically better than random and nearly as good as checking everything. It is one of the best returns on complexity in all of systems work.</li>
      <li><strong>Least busy</strong> is the most even, and needs live state about every server, which stops being free once there are many balancers and many servers.</li>
      <li><strong>Hash by user</strong> gives you a stable mapping — good for cache locality — and inherits the hot-key problem: one heavy user overwhelms one server while the rest idle.</li>
    </ul>
    <p>Turn on the slow server: round robin, random and hash keep sending it work, and p99 climbs for everyone. The two queue-aware strategies route around it within seconds without being told anything is wrong.</p>

    <h2>Layer 4 or layer 7</h2>
    <div class="table-wrap"><table>
      <thead><tr><th></th><th>L4 (TCP)</th><th>L7 (HTTP)</th></tr></thead>
      <tbody>
        <tr><td><strong>Sees</strong></td><td>Addresses and ports</td><td>Paths, headers, cookies</td></tr>
        <tr><td><strong>Can do</strong></td><td>Forward connections, fast</td><td>Route by path, retry, rewrite, terminate TLS</td></tr>
        <tr><td><strong>Costs</strong></td><td>Almost nothing</td><td>Parsing every request</td></tr>
        <tr><td><strong>Use when</strong></td><td>Raw throughput matters</td><td>You need routing decisions — usually</td></tr>
      </tbody>
    </table></div>

    <h2>Health checks are the point</h2>
    <p>A load balancer's real job is not distribution — it is <strong>removing broken servers from rotation before users notice</strong>. Two properties matter:</p>
    <ul>
      <li>The check must exercise what the request needs. A handler that returns 200 unconditionally will happily certify a server whose database connection pool is exhausted.</li>
      <li>It must not be so strict that a hiccup ejects the whole fleet at once. Requiring several consecutive failures, and refusing to eject below a healthy minimum, is what keeps a bad check from becoming an outage.</li>
    </ul>

    <div class="callout tip">
      <div class="callout-title">Autoscaling reacts on the wrong timescale</div>
      <p>A new instance takes a minute or more to boot, warm its caches and pass health checks. Traffic spikes arrive in seconds. Autoscaling handles daily cycles and gradual growth well; for sudden spikes you need headroom that already exists, a queue that absorbs the burst, or deliberate load shedding.</p>
    </div>

    <h2>What breaks first</h2>
    <p>Horizontal scaling moves the bottleneck rather than removing it. Once the stateless tier scales freely, the pressure lands on whatever is still shared — and that is almost always the database. Which is where the next lesson goes.</p>`,

  init(root) {
    const canvas = root.querySelector('#lbCanvas');
    const state = { servers: 6, load: 75 };
    controls(root, state);

    let strategy = 'rr', slowServer = false, rrIndex = 0;
    let servers = [], samples = [], clock = 0, nextArrival = 0;

    const build = n => {
      servers = Array.from({ length: n }, (_, i) => ({ id: i, queue: [], job: null, done: 0 }));
    };
    build(state.servers);

    root.querySelector('#lbStrategy').addEventListener('click', e => {
      const btn = e.target.closest('[data-strategy]');
      if (!btn) return;
      strategy = btn.dataset.strategy;
      root.querySelectorAll('#lbStrategy .pill').forEach(p => p.setAttribute('aria-pressed', String(p === btn)));
    });
    const slowBtn = root.querySelector('#lbSlow');
    slowBtn.addEventListener('click', () => {
      slowServer = !slowServer;
      slowBtn.setAttribute('aria-pressed', String(slowServer));
      slowBtn.textContent = slowServer ? 'Restore server 1' : 'Make server 1 slow';
    });

    const depth = s => s.queue.length + (s.job ? 1 : 0);
    const capacityOf = s => (slowServer && s.id === 0 ? 0.28 : 1);

    function route(user) {
      const n = servers.length;
      switch (strategy) {
        case 'rr':    return servers[rrIndex++ % n];
        case 'rand':  return servers[Math.floor(Math.random() * n)];
        case 'two': {
          const a = servers[Math.floor(Math.random() * n)];
          const b = servers[Math.floor(Math.random() * n)];
          return depth(a) <= depth(b) ? a : b;
        }
        case 'least': return servers.reduce((m, s) => (depth(s) < depth(m) ? s : m), servers[0]);
        default:      return servers[user % n];
      }
    }

    // a few users are far heavier than the rest — the hot-key case
    const pickUser = () => (Math.random() < 0.45 ? 0 : Math.floor(Math.random() * 40));

    function step(dt) {
      const start = clock;
      clock += dt;
      const perServer = 20;                       // jobs/sec one healthy server handles
      const total = servers.length * perServer * (state.load / 100);
      if (nextArrival < start) nextArrival = start;
      while (nextArrival < clock) {
        const target = route(pickUser());
        if (target.queue.length < 400) target.queue.push(nextArrival);
        nextArrival += -Math.log(1 - Math.random()) / total;
      }
      for (const s of servers) {
        // advance this server's own clock as it consumes work, so a
        // recorded latency covers waiting *and* service
        let now = start, budget = dt * capacityOf(s);
        const rate = dt > 0 ? budget / dt : 1;
        while (budget > 0) {
          if (!s.job) {
            if (!s.queue.length) break;
            if (s.queue[0] > now) {
              const skip = Math.min(budget, (s.queue[0] - now) * rate);
              now += skip / Math.max(rate, 1e-6); budget -= skip;
              continue;
            }
            s.job = { arrived: s.queue.shift(), need: -Math.log(1 - Math.random()) / perServer, done: 0 };
          }
          const take = Math.min(budget, s.job.need - s.job.done);
          s.job.done += take; budget -= take;
          now += take / Math.max(rate, 1e-6);
          if (s.job.done >= s.job.need - 1e-9) {
            samples.push((now - s.job.arrived) * 1000);
            if (samples.length > 500) samples.shift();
            s.done++; s.job = null;
          }
        }
      }
    }

    const pct = p => {
      if (!samples.length) return NaN;
      const sorted = [...samples].sort((a, b) => a - b);
      return sorted[clamp(Math.floor(p * sorted.length), 0, sorted.length - 1)];
    };

    const s = scene(canvas, (ctx, { w, h, dt, c }) => {
      if (servers.length !== state.servers) { build(state.servers); samples = []; }
      for (let i = 0; i < 5; i++) step(Math.min(dt, 0.04));

      const depths = servers.map(depth);
      const mean = depths.reduce((a, b) => a + b, 0) / depths.length || 1;
      root.querySelector('#lbP50').textContent = samples.length ? Math.round(pct(0.5)) + ' ms' : '—';
      root.querySelector('#lbP99').textContent = samples.length ? Math.round(pct(0.99)) + ' ms' : '—';
      root.querySelector('#lbImb').textContent = (Math.max(...depths) / Math.max(mean, 0.5)).toFixed(1) + '×';

      const padT = 46, padB = 34;
      const colW = w / servers.length;
      const barMax = h - padT - padB;
      const scaleTop = Math.max(5, Math.max(...depths) * 1.25);

      // the balancer itself
      ctx.fillStyle = c.surface; ctx.strokeStyle = c.accent; ctx.lineWidth = 1.6;
      roundRect(ctx, w / 2 - 62, 8, 124, 24, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = c.accent; ctx.font = `600 11px ${c.sans}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(STRATEGIES[strategy], w / 2, 21);

      servers.forEach((s2, i) => {
        const cx = colW * (i + 0.5);
        const d = depths[i];
        const bh = clamp((d / scaleTop) * barMax, 2, barMax);
        const hot = d > mean * 1.8 && d > 3;
        const slow = slowServer && i === 0;

        ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(w / 2, 34); ctx.lineTo(cx, padT - 6); ctx.stroke();

        ctx.fillStyle = c.sunken;
        roundRect(ctx, cx - 15, padT, 30, barMax, 5); ctx.fill();
        ctx.fillStyle = slow ? c.accent3 : hot ? mix(c.accent, c.accent3, 0.6) : c.accent2;
        roundRect(ctx, cx - 15, padT + barMax - bh, 30, bh, 5); ctx.fill();

        ctx.font = `500 10px ${c.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = c.soft;
        ctx.fillText(String(d), cx, padT + barMax - bh - 6);
        ctx.fillStyle = slow ? c.accent3 : c.muted;
        ctx.fillText(`s${i + 1}${slow ? ' ⚠' : ''}`, cx, h - 18);
        ctx.fillStyle = c.muted;
        ctx.fillText(`${s2.done}`, cx, h - 5);
      });

      ctx.textAlign = 'left'; ctx.fillStyle = c.muted; ctx.font = `500 10px ${c.mono}`;
      ctx.fillText('queue depth', 6, padT - 8);
      ctx.textAlign = 'right';
      ctx.fillText('requests served ↓', w - 6, padT - 8);   // the row of totals at the bottom
      ctx.textAlign = 'left';
    }, { height: 236 });

    return () => s.stop();
  },
};
