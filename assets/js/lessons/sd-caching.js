import { scene, controls, roundRect, clamp } from '../anim.js';

const KEYS = 56;

export default {
  id: 'sd-caching',
  title: 'Caching',
  minutes: 8,
  interactive: true,
  tags: ['cache', 'lru', 'hit rate', 'cdn', 'invalidation', 'stampede', 'zipf', 'ttl'],
  summary: 'Requests are never evenly spread — a handful of items get most of the traffic. Keeping those few close by is the cheapest performance win in any system.',

  body: () => `
    <h2>Why a small cache works so well</h2>
    <p>Real traffic is wildly skewed. A few popular items take a large share of requests while a long tail is asked for almost never — the pattern turns up in web pages, search queries, product views and social posts alike.</p>
    <p>That skew is what makes caching pay. You do not need to hold most of the data to serve most of the requests. Caching the top 1% of items routinely serves half the traffic, and the arithmetic behind that is brutal in your favour: at a 90% hit rate, your database sees <strong>one tenth</strong> of the load it saw before.</p>

    <h2>Watch the hit rate</h2>
    <p>Keys are requested with a realistic skew — the bars are ordered by popularity, and filled bars are the ones currently cached. Try a very small cache with high skew: a handful of slots out of 56 keys already catches most of the traffic.</p>

    <div class="demo">
      <div class="demo-head"><h4>Cache simulator</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage"><canvas id="cacheCanvas"></canvas></div>
      <div class="demo-controls">
        <div class="ctrl"><label>cache size (keys) <output data-for="size">8</output></label>
          <input type="range" data-key="size" data-decimals="0" min="1" max="40" step="1" value="8"></div>
        <div class="ctrl"><label>popularity skew <output data-for="skew">1.20</output></label>
          <input type="range" data-key="skew" min="0.1" max="1.8" step="0.05" value="1.2"></div>
        <div class="ctrl" style="flex:1 1 100%"><label>eviction policy</label>
          <div class="pill-row" id="cachePolicy">
            <button class="pill" type="button" data-policy="lru" aria-pressed="true">LRU</button>
            <button class="pill" type="button" data-policy="lfu" aria-pressed="false">LFU</button>
            <button class="pill" type="button" data-policy="fifo" aria-pressed="false">FIFO</button>
            <button class="pill" type="button" data-policy="rand" aria-pressed="false">random</button>
          </div></div>
        <div class="readout"><span>hit rate <b id="cacheHit">—</b></span><span>origin load <b id="cacheOrigin">—</b></span></div>
      </div>
    </div>

    <p>Flatten the skew towards 0.1 and the hit rate collapses — with uniform demand a cache only helps in proportion to its size, and the whole strategy stops being interesting. <strong>Caching is a bet on skew.</strong> Before adding one, check that your access pattern actually has any.</p>

    <h3>Which policy?</h3>
    <p>LRU wins here, as it usually does in practice: recency is a good predictor of the near future, and it adapts when popularity shifts. LFU protects genuinely hot keys better but is slow to let go of yesterday's favourites. FIFO ignores usage entirely. Random is a surprisingly respectable baseline and costs nothing to maintain — which is why real caches often use approximations of LRU rather than the real thing.</p>

    <h2>Where caches live</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Layer</th><th>Holds</th><th>Watch out for</th></tr></thead>
      <tbody>
        <tr><td><strong>Browser</strong></td><td>Assets, API responses</td><td>You cannot invalidate it — it expires on its own schedule</td></tr>
        <tr><td><strong>CDN / edge</strong></td><td>Static files, cacheable pages</td><td>Cheapest requests are the ones that never reach you</td></tr>
        <tr><td><strong>Application memory</strong></td><td>Config, hot objects</td><td>Per-instance, so each deploy starts cold</td></tr>
        <tr><td><strong>Shared cache (Redis, Memcached)</strong></td><td>Query results, sessions</td><td>A network hop, and now a thing that can fail</td></tr>
        <tr><td><strong>Database buffer pool</strong></td><td>Recently read pages</td><td>Already working before you add anything</td></tr>
      </tbody>
    </table></div>

    <h2>Keeping it correct</h2>
    <p>A cache is a second copy of the truth, so every cache introduces the possibility of being wrong. The patterns differ mainly in who writes to it and when:</p>
    <ul>
      <li><strong>Cache-aside</strong> — the app checks the cache, and on a miss reads the database and fills the cache. Simple, and the default. Stale windows are bounded by the TTL.</li>
      <li><strong>Write-through</strong> — writes go to cache and database together. Always consistent, slower writes.</li>
      <li><strong>Write-behind</strong> — write to cache, flush later. Fast, and it loses data if the cache dies.</li>
      <li><strong>Explicit invalidation</strong> — delete the key on write. Correct when it works, and easy to miss a path.</li>
    </ul>
    <p>A TTL is the humble option that saves you: even if invalidation is missed somewhere, the wrong answer expires. Pick a TTL by asking how stale this value may be before someone notices — often minutes, occasionally seconds, rarely zero.</p>

    <div class="callout warn">
      <div class="callout-title">Two failures caches cause</div>
      <p><strong>Stampede.</strong> A hot key expires, a thousand requests miss simultaneously, and all thousand hit the database at once. Fix it by letting one request recompute while the others serve the stale value, or by adding jitter so keys do not expire together.</p>
      <p><strong>Cold start.</strong> A cache restart or a deploy sends 100% of traffic to a database sized for 10%. If your system cannot survive its cache being empty, the cache is not an optimisation — it is a load-bearing component, and it needs the same care as one.</p>
    </div>

    <h2>The rule of thumb</h2>
    <p>Cache things that are <strong>read far more than written</strong>, <strong>expensive to produce</strong> and <strong>tolerant of being slightly stale</strong>. If any of the three is false, look for a different fix — usually a better index, a smaller response, or not doing the work at all.</p>`,

  init(root) {
    const canvas = root.querySelector('#cacheCanvas');
    const state = { size: 8, skew: 1.2 };
    controls(root, state);

    let policy = 'lru';
    root.querySelector('#cachePolicy').addEventListener('click', e => {
      const btn = e.target.closest('[data-policy]');
      if (!btn) return;
      policy = btn.dataset.policy;
      root.querySelectorAll('#cachePolicy .pill').forEach(p => p.setAttribute('aria-pressed', String(p === btn)));
      cache.clear();
    });

    const cache = new Map();      // key -> { used, freq, added }
    const recent = [];            // 1 = hit, 0 = miss
    const trend = [];             // rolling hit-rate history
    let tick = 0, lastKey = 0, flash = 0, weights = [], cum = [];

    function rebuildWeights() {
      weights = Array.from({ length: KEYS }, (_, i) => 1 / Math.pow(i + 1, state.skew));
      const total = weights.reduce((a, b) => a + b, 0);
      weights = weights.map(w => w / total);
      cum = []; let run = 0;
      for (const w of weights) { run += w; cum.push(run); }
    }
    rebuildWeights();
    let lastSkew = state.skew;

    const pickKey = () => {
      const r = Math.random();
      let lo = 0, hi = cum.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
      return lo;
    };

    function request(key) {
      tick++;
      const hit = cache.has(key);
      if (hit) {
        const e = cache.get(key);
        e.used = tick; e.freq++;
      } else {
        while (cache.size >= state.size) evict();
        cache.set(key, { used: tick, freq: 1, added: tick });
      }
      recent.push(hit ? 1 : 0);
      if (recent.length > 600) recent.shift();
      lastKey = key; flash = 1;
    }

    function evict() {
      let victim = null, score = Infinity;
      const keys = [...cache.keys()];
      if (policy === 'rand') { cache.delete(keys[Math.floor(Math.random() * keys.length)]); return; }
      for (const k of keys) {
        const e = cache.get(k);
        const s = policy === 'lru' ? e.used : policy === 'lfu' ? e.freq : e.added;
        if (s < score) { score = s; victim = k; }
      }
      cache.delete(victim);
    }

    const s = scene(canvas, (ctx, { w, h, dt, c }) => {
      if (state.skew !== lastSkew) { lastSkew = state.skew; rebuildWeights(); }
      while (cache.size > state.size) evict();

      const n = Math.max(1, Math.round(dt * 90));
      for (let i = 0; i < n; i++) request(pickKey());
      flash = Math.max(0, flash - dt * 3);

      const hitRate = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
      if (tick % 25 === 0) { trend.push(hitRate); if (trend.length > 180) trend.shift(); }
      root.querySelector('#cacheHit').textContent = (hitRate * 100).toFixed(1) + '%';
      root.querySelector('#cacheOrigin').textContent = ((1 - hitRate) * 100).toFixed(1) + '% of reads';

      /* ---------- popularity bars ---------- */
      const padL = 10, padR = 10, top = 22;
      const chartH = h * 0.52;
      const bw = (w - padL - padR) / KEYS;
      const maxW = weights[0];
      for (let i = 0; i < KEYS; i++) {
        const bh = Math.max(2, (weights[i] / maxW) * chartH);
        const x = padL + i * bw, y = top + chartH - bh;
        const cached = cache.has(i);
        ctx.fillStyle = cached ? c.accent2 : c.grid;
        ctx.globalAlpha = cached ? 0.95 : 0.9;
        roundRect(ctx, x + 0.6, y, Math.max(1.5, bw - 1.6), bh, 2); ctx.fill();
        ctx.globalAlpha = 1;
        if (i === lastKey && flash > 0) {
          ctx.fillStyle = c.accent3; ctx.globalAlpha = flash * 0.16;
          ctx.fillRect(x, top - 6, Math.max(1.5, bw), chartH + 12);
          ctx.globalAlpha = flash;
          ctx.beginPath();                                   // a tick under the axis
          ctx.moveTo(x + bw / 2, top + chartH + 3);
          ctx.lineTo(x + bw / 2 - 3.5, top + chartH + 9);
          ctx.lineTo(x + bw / 2 + 3.5, top + chartH + 9);
          ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      ctx.font = `500 10px ${c.mono}`; ctx.textAlign = 'left'; ctx.fillStyle = c.muted;
      ctx.fillText('keys by popularity →', padL, top - 8);
      ctx.textAlign = 'right';
      ctx.fillStyle = c.accent2;
      ctx.fillText(`■ in cache (${cache.size}/${state.size})`, w - padR, top - 8);

      /* ---------- hit-rate trend ---------- */
      const ty = top + chartH + 26, th = h - ty - 20;
      ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
      ctx.strokeRect(padL + .5, ty + .5, w - padL - padR, th);
      [0.5, 0.9].forEach(level => {
        ctx.setLineDash([3, 4]); ctx.strokeStyle = c.line;
        const yy = ty + th - level * th;
        ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(w - padR, yy); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = c.muted; ctx.font = `500 9px ${c.mono}`; ctx.textAlign = 'left';
        ctx.fillText(`${level * 100}%`, padL + 4, yy - 3);
      });
      if (trend.length > 1) {
        ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.beginPath();
        trend.forEach((v, i) => {
          const X = padL + (i / (trend.length - 1)) * (w - padL - padR);
          const Y = ty + th - v * th;
          i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        });
        ctx.stroke();
      }
      ctx.fillStyle = c.muted; ctx.font = `500 10px ${c.mono}`; ctx.textAlign = 'left';
      ctx.fillText('hit rate over time', padL, ty - 6);
      ctx.textAlign = 'right'; ctx.fillStyle = c.accent;
      ctx.fillText(`${(hitRate * 100).toFixed(1)}% hits · origin sees ${((1 - hitRate) * 100).toFixed(0)}%`, w - padR, ty - 6);
    }, { height: 300 });

    return () => s.stop();
  },
};
