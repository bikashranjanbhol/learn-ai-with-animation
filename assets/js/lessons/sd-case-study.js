import { scene, roundRect, clamp } from '../anim.js';

/* node id: [x, y] on a 0–1 canvas, plus a label */
const NODES = {
  client: [0.06, 0.5, 'client'],
  lb:     [0.26, 0.5, 'load balancer'],
  app:    [0.46, 0.5, 'app server'],
  cache:  [0.68, 0.22, 'cache'],
  db:     [0.68, 0.78, 'database'],
  queue:  [0.90, 0.5, 'queue → analytics'],
};

const FLOWS = {
  hit: {
    label: 'redirect · cache hit',
    hops: [['client', 'lb', 2], ['lb', 'app', 1], ['app', 'cache', 1], ['cache', 'app', 1], ['app', 'queue', 0.5], ['app', 'client', 2]],
    note: 'Most redirects look like this — the database is never touched.',
  },
  miss: {
    label: 'redirect · cache miss',
    hops: [['client', 'lb', 2], ['lb', 'app', 1], ['app', 'cache', 1], ['cache', 'app', 1], ['app', 'db', 5], ['db', 'app', 5], ['app', 'cache', 1], ['app', 'queue', 0.5], ['app', 'client', 2]],
    note: 'A miss costs a database round trip, then fills the cache for everyone after.',
  },
  write: {
    label: 'create a short link',
    hops: [['client', 'lb', 2], ['lb', 'app', 1], ['app', 'db', 8], ['db', 'app', 8], ['app', 'cache', 1], ['app', 'client', 2]],
    note: 'Writes are rare, go straight to the database, and warm the cache on the way back.',
  },
};

export default {
  id: 'sd-case-study',
  title: 'Case study: a URL shortener',
  minutes: 10,
  interactive: true,
  tags: ['case study', 'url shortener', 'interview', 'architecture', 'design', 'api'],
  summary: 'One design, end to end — requirements, numbers, key generation, storage, the read path, and the parts people forget.',

  body: () => `
    <h2>Start by narrowing the problem</h2>
    <p>"Design a URL shortener" is deliberately vague. The first move is to agree what is in scope, because the answer changes the design:</p>
    <ul>
      <li><strong>Functional.</strong> Submit a long URL, get a short one back. Visiting the short one redirects. Optional: custom aliases, expiry, click analytics.</li>
      <li><strong>Non-functional.</strong> Redirects must be fast (they sit in front of a page load) and highly available (a broken redirect breaks every link ever shared). Creating links can be slower and can tolerate the odd failure.</li>
      <li><strong>Explicitly out.</strong> Editing a link's destination — allowing that makes every cached copy a correctness problem for very little user value.</li>
    </ul>
    <p>Note the asymmetry that falls out immediately: this is an overwhelmingly read-heavy system, and reads and writes deserve completely different treatment.</p>

    <h2>The numbers</h2>
    <p>Assume 100 million new links per day and a 100:1 read ratio — the method from the estimation lesson:</p>
    <pre><code>writes   100M / 86,400        ≈ 1,200 /s   (peak ~3,500 /s)
reads    1,200 × 100          ≈ 120,000 /s (peak ~350,000 /s)
storage  100M × 500 bytes     ≈ 50 GB/day  ≈ 18 TB/year
</code></pre>
    <p>Three conclusions before drawing a single box. 350k reads per second means the redirect path must be served from memory, not disk. 18 TB a year means one machine will not hold it for long, so the storage layer must shard. And 1,200 writes per second is small — the write path can stay simple.</p>

    <h2>Generating the key</h2>
    <p>A 7-character key from a 62-character alphabet gives 62⁷ ≈ 3.5 trillion combinations, which is comfortable for decades at this rate. Three ways to produce them:</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Approach</th><th>How</th><th>Trade-off</th></tr></thead>
      <tbody>
        <tr><td><strong>Hash the URL</strong></td><td>base62 of the first bytes of a hash</td><td>Same URL gives the same key; needs a collision check on every write</td></tr>
        <tr><td><strong>Global counter</strong></td><td>base62 of an incrementing number</td><td>No collisions ever; keys are guessable and leak volume</td></tr>
        <tr><td><strong>Pre-generated keys</strong></td><td>A service hands out blocks of random unused keys</td><td>No collision check on the hot path; one more service to run</td></tr>
      </tbody>
    </table></div>
    <p>The counter deserves care: a single counter is a single point of failure and a bottleneck. Give each app server a block of ten thousand IDs to hand out locally and it refills rarely — the coordination cost effectively disappears, at the price of gaps in the sequence, which nobody cares about.</p>

    <h2>The read path</h2>
    <p>Follow a request through the system. Switch between a cache hit, a cache miss, and a write, and watch where the milliseconds go.</p>

    <div class="demo">
      <div class="demo-head"><h4>One request, end to end</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage"><canvas id="flowCanvas"></canvas></div>
      <div class="demo-controls">
        <div class="pill-row" id="flowPills">
          ${Object.entries(FLOWS).map(([k, v], i) =>
            `<button class="pill" type="button" data-flow="${k}" aria-pressed="${i === 0}">${v.label}</button>`).join('')}
        </div>
        <div class="readout"><span>elapsed <b id="flowMs">—</b></span></div>
      </div>
    </div>

    <p>The gap between the two redirect paths is the entire argument for the cache. With a working set of hot links measured in gigabytes and a hit rate above 90%, the database sees a small fraction of the read traffic — and the traffic it does see is spread across shards by key.</p>

    <h3>Schema and storage</h3>
    <pre><code>short_key   CHAR(7)   PRIMARY KEY     <span class="tok-com">-- also the shard key</span>
long_url    TEXT
user_id     BIGINT
created_at  TIMESTAMP
expires_at  TIMESTAMP NULL</code></pre>
    <p>Every read is a lookup by primary key, so a key-value store fits perfectly and a relational database works just as well if you shard on <code>short_key</code>. There are no joins, no range scans, and no transactions beyond a single row — which is exactly the shape that scales without drama.</p>

    <h2>The parts people forget</h2>
    <ul>
      <li><strong>301 or 302?</strong> A permanent redirect gets cached by browsers, which is fast and free — and means you never see the click again. Use 302 if analytics matter, 301 if speed and cost do.</li>
      <li><strong>Analytics must be asynchronous.</strong> Push click events onto a queue and process them elsewhere. A redirect must never wait on a write to an analytics store.</li>
      <li><strong>Abuse.</strong> A shortener is a phishing tool by default. Check destinations against a safe-browsing list, rate limit creation per account, and be able to disable a key instantly.</li>
      <li><strong>Custom aliases</strong> need a uniqueness check and their own namespace, so they cannot collide with generated keys.</li>
      <li><strong>Expiry</strong> is best handled lazily — check <code>expires_at</code> on read and let a background job reclaim rows, rather than deleting on a deadline.</li>
      <li><strong>The 404 path</strong> gets attacked. Cache negative lookups too, or every scan for random keys becomes a database query.</li>
    </ul>

    <div class="callout tip">
      <div class="callout-title">How to run through a design</div>
      <p>Requirements → rough numbers → API → data model → the happy path → scale the bottleneck the numbers pointed at → failure modes. Say the trade-off out loud at each step; the choices are what matters, and there is rarely a single right answer.</p>
    </div>

    <h2>Where this generalises</h2>
    <p>Almost every read-heavy system is this same skeleton: a stateless tier behind a balancer, a cache in front of a sharded store, asynchronous work on a queue, and careful behaviour when a dependency fails. Pastebin, image hosting, feature flags and product catalogues are all variations on the shape you just drew.</p>
    <p>You now have both tracks: how the models work, and how to build systems that can serve them. The best next step is the same as it was — build one, and come back to whichever lesson stops making sense.</p>`,

  init(root) {
    const canvas = root.querySelector('#flowCanvas');
    const msEl = root.querySelector('#flowMs');
    let flow = 'hit', hop = 0, prog = 0, elapsed = 0, pause = 0;

    root.querySelector('#flowPills').addEventListener('click', e => {
      const btn = e.target.closest('[data-flow]');
      if (!btn) return;
      flow = btn.dataset.flow; hop = 0; prog = 0; elapsed = 0; pause = 0;
      root.querySelectorAll('#flowPills .pill').forEach(p => p.setAttribute('aria-pressed', String(p === btn)));
    });

    const s = scene(canvas, (ctx, { w, h, dt, c }) => {
      const hops = FLOWS[flow].hops;
      const pad = 34;
      const P = id => {
        const [x, y] = NODES[id];
        return [pad + x * (w - pad * 2), 26 + y * (h - 76)];
      };

      // advance the packet
      if (pause > 0) pause -= dt;
      else {
        prog += dt * 1.5;
        while (prog >= 1) {
          prog -= 1;
          elapsed += hops[hop][2];
          hop++;
          if (hop >= hops.length) { hop = 0; elapsed = 0; pause = 1.1; prog = 0; break; }
        }
      }
      const visited = new Set(hops.slice(0, hop + 1).flatMap(([a, b]) => [a, b]));

      // edges actually used by this flow
      const drawn = new Set();
      hops.forEach(([a, b], i) => {
        const key = [a, b].sort().join('-');
        if (drawn.has(key)) return;
        drawn.add(key);
        const [x0, y0] = P(a), [x1, y1] = P(b);
        ctx.strokeStyle = i <= hop ? c.accent : c.grid;
        ctx.globalAlpha = i <= hop ? 0.55 : 1;
        ctx.lineWidth = i <= hop ? 2 : 1.2;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.globalAlpha = 1;
      });

      // nodes
      Object.entries(NODES).forEach(([id, [, , label]]) => {
        const [x, y] = P(id);
        const on = visited.has(id);
        const bw = Math.min(112, w * 0.19), bh = 34;
        ctx.fillStyle = on ? c.surface : c.sunken;
        roundRect(ctx, x - bw / 2, y - bh / 2, bw, bh, 9); ctx.fill();
        ctx.strokeStyle = on ? c.accent : c.grid; ctx.lineWidth = on ? 1.8 : 1.2;
        roundRect(ctx, x - bw / 2, y - bh / 2, bw, bh, 9); ctx.stroke();
        ctx.font = `600 10.5px ${c.sans}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = on ? c.text : c.muted;
        ctx.fillText(label, x, y);
      });

      // the packet
      if (hops[hop]) {
        const [a, b, cost] = hops[hop];
        const [x0, y0] = P(a), [x1, y1] = P(b);
        const px = x0 + (x1 - x0) * prog, py = y0 + (y1 - y0) * prog;
        ctx.fillStyle = c.accent3;
        ctx.beginPath(); ctx.arc(px, py, 5.5, 0, 7); ctx.fill();
        ctx.strokeStyle = c.surface; ctx.lineWidth = 2; ctx.stroke();
        ctx.font = `500 9.5px ${c.mono}`; ctx.fillStyle = c.muted; ctx.textAlign = 'center';
        ctx.fillText(`${cost} ms`, px, py - 12);
      }

      const totalMs = hops.reduce((n, hh) => n + hh[2], 0);
      msEl.textContent = `${elapsed.toFixed(1)} / ${totalMs} ms`;

      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = `500 10.5px ${c.mono}`; ctx.fillStyle = c.muted;
      ctx.fillText(FLOWS[flow].note, pad - 20, h - 10);
      ctx.textAlign = 'right'; ctx.fillStyle = c.accent;
      ctx.fillText(`total ${totalMs} ms`, w - 10, h - 10);
    }, { height: 260 });

    return () => s.stop();
  },
};
