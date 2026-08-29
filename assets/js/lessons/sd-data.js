import { scene, controls, roundRect, clamp } from '../anim.js';

const KEY_COUNT = 420;
const hash = str => {                    // small, stable string hash → [0, 1)
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
};
const KEYS = Array.from({ length: KEY_COUNT }, (_, i) => ({ id: i, pos: hash('key:' + i) }));

export default {
  id: 'sd-data',
  title: 'Replication and sharding',
  minutes: 9,
  interactive: true,
  tags: ['database', 'replication', 'sharding', 'partitioning', 'consistent hashing', 'read replica', 'hot shard'],
  summary: 'The stateless tier scales by adding boxes. Data does not — you have to decide what goes where, and changing your mind later is expensive.',

  body: () => `
    <h2>Two different problems</h2>
    <p>When one database stops coping, there are two distinct moves and they solve different things.</p>
    <ul>
      <li><strong>Replication</strong> — the same data on several machines. Buys read capacity and survival of a failed node. Does nothing for write volume or dataset size.</li>
      <li><strong>Sharding</strong> — different data on different machines. Buys write capacity and unbounded size. Costs you cross-shard queries, transactions and a lot of operational sharp edges.</li>
    </ul>
    <p>Reach for replication first. It is far less invasive, and most systems are read-heavy enough that it is all they ever need.</p>

    <h2>Replication</h2>
    <p>The usual arrangement is one <strong>leader</strong> accepting writes and several <strong>followers</strong> replaying its log. Reads can go to any of them, which is where the capacity comes from. The interesting choice is when the leader considers a write done:</p>
    <div class="table-wrap"><table>
      <thead><tr><th></th><th>Asynchronous</th><th>Synchronous</th></tr></thead>
      <tbody>
        <tr><td><strong>Leader waits for</strong></td><td>Nothing — acknowledges immediately</td><td>At least one follower to confirm</td></tr>
        <tr><td><strong>Write latency</strong></td><td>Fast</td><td>Slower, and bounded by the slowest replica</td></tr>
        <tr><td><strong>If the leader dies</strong></td><td>Recent writes can be lost</td><td>Confirmed writes survive</td></tr>
        <tr><td><strong>Reads from replicas</strong></td><td>May be stale</td><td>May still be stale on unconfirmed replicas</td></tr>
      </tbody>
    </table></div>
    <p>Most systems run asynchronous replication and accept a small window of possible loss. The one thing to be deliberate about is <strong>reading your own writes</strong>: a user who posts a comment and is then served by a lagging replica sees their comment vanish. Route a user's reads to the leader for a few seconds after they write, and the problem disappears.</p>

    <h2>Sharding, and the cost of moving keys</h2>
    <p>Sharding needs a rule mapping each key to a machine. The naive rule, <code>server = hash(key) % N</code>, works perfectly until N changes — and then almost every key belongs somewhere new. <strong>Consistent hashing</strong> exists to make that change cheap.</p>
    <p>Place both servers and keys on a ring. A key belongs to the first server clockwise from it. Add a server and only the keys in the arc it landed on move; everything else stays put.</p>

    <div class="demo">
      <div class="demo-head"><h4>The hash ring</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage"><canvas id="ringCanvas"></canvas></div>
      <div class="demo-controls">
        <div class="ctrl"><label>servers <output data-for="nodes">4</output></label>
          <input type="range" data-key="nodes" data-decimals="0" min="2" max="8" step="1" value="4"></div>
        <div class="ctrl"><label>virtual nodes each <output data-for="vnodes">1</output></label>
          <input type="range" data-key="vnodes" data-decimals="0" min="1" max="40" step="1" value="1"></div>
        <div class="ctrl" style="flex:1 1 100%"><label>placement rule</label>
          <div class="pill-row" id="ringMode">
            <button class="pill" type="button" data-mode="ring" aria-pressed="true">consistent hashing</button>
            <button class="pill" type="button" data-mode="mod" aria-pressed="false">hash(key) % N</button>
          </div></div>
        <div class="readout"><span>keys moved on last change <b id="ringMoved">—</b></span><span>largest share <b id="ringSkew">—</b></span></div>
      </div>
    </div>

    <p>Drag the server count with <strong>consistent hashing</strong> selected, then switch to <strong>modulo</strong> and drag it again. Modulo relocates 70–90% of the data for one added server; the ring moves roughly 1/N. At terabyte scale that difference is the difference between a routine operation and a week of planning.</p>
    <p>Now raise <strong>virtual nodes</strong> with the ring selected. One point per server lands unevenly and some server ends up owning a huge arc. Giving each server a hundred scattered points averages the randomness out — real implementations use 100–500 per server for exactly this reason.</p>

    <h3>Choosing a shard key</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Scheme</th><th>Good at</th><th>Bad at</th></tr></thead>
      <tbody>
        <tr><td><strong>Hash of key</strong></td><td>Even spread</td><td>Range scans — neighbours are scattered</td></tr>
        <tr><td><strong>Range</strong> (a–f, g–m…)</td><td>Range scans, ordered reads</td><td>Hot spots; sequential IDs pile onto one shard</td></tr>
        <tr><td><strong>By tenant / user</strong></td><td>Locality, easy per-customer isolation</td><td>One huge tenant that no longer fits</td></tr>
        <tr><td><strong>Directory</strong> (lookup table)</td><td>Total flexibility, easy rebalancing</td><td>The lookup service is now critical infrastructure</td></tr>
      </tbody>
    </table></div>

    <div class="callout warn">
      <div class="callout-title">The shard key is the decision</div>
      <p>Everything else about a sharded system can be changed later. The shard key cannot, cheaply — it determines which queries stay fast, which become fan-outs across every machine, and which transactions remain possible at all. Pick it from your actual read patterns, not from what looks tidy in the schema.</p>
    </div>

    <h2>Before you shard, do these</h2>
    <p>Sharding is the end of single-machine conveniences: no cross-shard joins, no simple transactions, no <code>ORDER BY</code> across the whole dataset without a scatter-gather. Almost every one of these is cheaper and reversible:</p>
    <ul>
      <li><strong>Add the missing index.</strong> An unindexed query on a large table is the single most common "we need to scale the database" that turns out not to be.</li>
      <li><strong>Add read replicas</strong> and move reporting and analytics off the primary.</li>
      <li><strong>Cache the hot reads</strong> — the previous lesson, and often a 10× reduction on its own.</li>
      <li><strong>Move the big cold things out</strong> — files to object storage, old rows to an archive table.</li>
      <li><strong>Buy a bigger machine.</strong> Unfashionable, immediate, and a modern server holds far more than people assume.</li>
    </ul>
    <p>When you have done all of that and the write rate still does not fit, shard — and only then. Next: what happens to correctness once the same data exists in more than one place.</p>`,

  init(root) {
    const canvas = root.querySelector('#ringCanvas');
    const state = { nodes: 4, vnodes: 1 };
    let mode = 'ring';
    let ring = [], assignment = new Map(), movedPct = 0;

    root.querySelector('#ringMode').addEventListener('click', e => {
      const btn = e.target.closest('[data-mode]');
      if (!btn) return;
      mode = btn.dataset.mode;
      root.querySelectorAll('#ringMode .pill').forEach(p => p.setAttribute('aria-pressed', String(p === btn)));
      reassign();
    });

    function buildRing() {
      ring = [];
      for (let n = 0; n < state.nodes; n++) {
        for (let v = 0; v < state.vnodes; v++) ring.push({ node: n, pos: hash(`node:${n}:${v}`) });
      }
      ring.sort((a, b) => a.pos - b.pos);
    }

    const ownerOf = key => {
      if (mode === 'mod') return Math.floor(key.pos * 100000) % state.nodes;
      for (const p of ring) if (p.pos >= key.pos) return p.node;
      return ring[0].node;
    };

    function reassign() {
      buildRing();
      const next = new Map();
      let moved = 0;
      for (const k of KEYS) {
        const owner = ownerOf(k);
        next.set(k.id, owner);
        if (assignment.size && assignment.get(k.id) !== owner) moved++;
      }
      movedPct = assignment.size ? (moved / KEYS.length) * 100 : 0;
      assignment = next;
      root.querySelector('#ringMoved').textContent = movedPct.toFixed(0) + '%';
    }

    controls(root, state, () => reassign());

    const nodeColor = (i, c) => {
      const hues = [c.accent, c.accent2, c.accent3, '#3b82f6', '#d9a441', '#e0619c', '#4bc0a0', '#a78bfa'];
      return hues[i % hues.length];
    };

    const s = scene(canvas, (ctx, { w, h, t, c }) => {
      const counts = new Array(state.nodes).fill(0);
      for (const k of KEYS) counts[assignment.get(k.id)]++;
      const biggest = Math.max(...counts) / KEY_COUNT;
      root.querySelector('#ringSkew').textContent = (biggest * 100).toFixed(0) + '% on one server';

      const barsW = Math.min(200, w * 0.34);
      const cx = (w - barsW) / 2, cy = h / 2;
      const R = Math.min((w - barsW) / 2, h / 2) - 30;
      const spin = mode === 'ring' ? t * 0.05 : 0;
      const at = p => {
        const a = (p + spin) * Math.PI * 2 - Math.PI / 2;
        return [Math.cos(a), Math.sin(a)];
      };

      // the ring
      ctx.strokeStyle = c.grid; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();

      // keys, coloured by owner
      for (const k of KEYS) {
        const [dx, dy] = at(k.pos);
        const col = nodeColor(assignment.get(k.id) ?? 0, c);
        ctx.fillStyle = col; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.arc(cx + dx * R, cy + dy * R, 2.2, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // server positions (only meaningful for the ring)
      if (mode === 'ring') {
        ring.forEach(p => {
          const [dx, dy] = at(p.pos);
          const r = state.vnodes > 12 ? 3 : 6;
          ctx.beginPath(); ctx.arc(cx + dx * (R + 14), cy + dy * (R + 14), r, 0, 7);
          ctx.fillStyle = nodeColor(p.node, c); ctx.fill();
          ctx.strokeStyle = c.surface; ctx.lineWidth = 1.6; ctx.stroke();
        });
      }

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 12px ${c.sans}`; ctx.fillStyle = c.soft;
      ctx.fillText(mode === 'ring' ? 'hash ring' : 'hash(key) % N', cx, cy - 8);
      ctx.font = `500 10px ${c.mono}`; ctx.fillStyle = c.muted;
      ctx.fillText(`${KEY_COUNT} keys · ${state.nodes} servers`, cx, cy + 10);

      // per-server share
      const bx = w - barsW + 8, bw = barsW - 24;
      const rowH = Math.min(26, (h - 40) / state.nodes);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = `500 10px ${c.mono}`; ctx.fillStyle = c.muted;
      ctx.fillText('share of keys', bx, 18);
      const maxFrac = Math.max(...counts) / KEY_COUNT || 1;
      const evenX = bx + ((1 / state.nodes) / maxFrac) * bw;
      counts.forEach((n, i) => {
        const y = 30 + i * rowH;
        const frac = n / KEY_COUNT;
        ctx.fillStyle = c.sunken; roundRect(ctx, bx, y, bw, 12, 4); ctx.fill();
        ctx.fillStyle = nodeColor(i, c);
        roundRect(ctx, bx, y, clamp((frac / maxFrac) * bw, 2, bw), 12, 4); ctx.fill();
        ctx.fillStyle = c.muted; ctx.font = `500 9.5px ${c.mono}`; ctx.textAlign = 'left';
        ctx.fillText(`s${i + 1}`, bx + bw + 5, y + 10);
      });
      // where every server would sit if the split were perfectly even
      ctx.strokeStyle = c.line; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(evenX, 26); ctx.lineTo(evenX, 30 + state.nodes * rowH - 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = c.muted; ctx.font = `500 9.5px ${c.mono}`;
      ctx.fillText('┆ even split', bx, 30 + state.nodes * rowH + 14);
    }, { height: 300 });

    reassign();
    return () => s.stop();
  },
};
