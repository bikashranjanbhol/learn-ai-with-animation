import { scene, controls, roundRect, clamp } from '../anim.js';

export default {
  id: 'sd-consistency',
  title: 'Consistency, CAP and stale reads',
  minutes: 8,
  interactive: true,
  tags: ['cap theorem', 'consistency', 'eventual consistency', 'replication lag', 'stale read', 'quorum', 'partition'],
  summary: 'The moment data exists in two places, "what is the current value?" stops having one answer. What you choose here shapes the product, not just the infrastructure.',

  body: () => `
    <h2>Copies drift</h2>
    <p>Replication solved read capacity, and created a new question. A write lands on the leader and reaches the followers some milliseconds later. During that window, a read served by a follower returns the old value — a <strong>stale read</strong>. Nothing is broken; this is how the system works.</p>
    <p>The lag is usually a few milliseconds. It is also unbounded: a follower doing a slow disk flush, catching up after a restart, or sitting on the wrong side of a saturated link can be seconds or minutes behind.</p>

    <h2>Watch reads go stale</h2>
    <p>Writes leave the leader and ripple out. Reads land somewhere and are marked <span style="color:var(--accent-2)">fresh</span> or <span style="color:var(--accent-3)">stale</span> depending on whether the replica had caught up. Push the lag up, or the write rate, and watch the stale fraction climb.</p>

    <div class="demo">
      <div class="demo-head"><h4>Leader, replicas, and the window in between</h4><span class="badge">Interactive</span></div>
      <div class="demo-stage"><canvas id="repCanvas"></canvas></div>
      <div class="demo-controls">
        <div class="ctrl"><label>replication lag (ms) <output data-for="lag">150</output></label>
          <input type="range" data-key="lag" data-decimals="0" min="0" max="1500" step="10" value="150"></div>
        <div class="ctrl"><label>writes per second <output data-for="wps">1.5</output></label>
          <input type="range" data-key="wps" min="0.2" max="8" step="0.1" value="1.5"></div>
        <div class="ctrl"><label>reads sent to replicas (%) <output data-for="split">80</output></label>
          <input type="range" data-key="split" data-decimals="0" min="0" max="100" step="5" value="80"></div>
        <div class="ctrl" style="flex:1 1 100%"><label>during a network partition, prefer</label>
          <div class="pill-row" id="capMode">
            <button class="pill" type="button" data-cap="ap" aria-pressed="true">availability (AP)</button>
            <button class="pill" type="button" data-cap="cp" aria-pressed="false">consistency (CP)</button>
          </div></div>
        <button class="btn secondary" id="repPartition" type="button" aria-pressed="false">Cut the network</button>
        <div class="readout"><span>stale <b id="repStale">—</b></span><span>errors <b id="repErr">—</b></span></div>
      </div>
    </div>

    <h2>CAP, stated usefully</h2>
    <p>CAP is often summarised as "pick two of consistency, availability, partition tolerance", which is misleading — you do not get to decline partitions. Networks drop packets and links fail, so <strong>P is a fact, not a choice</strong>. The real statement is narrower and more useful:</p>
    <blockquote><p>When the network partitions, you must choose: refuse the request (consistency), or answer with data that might be wrong (availability).</p></blockquote>
    <p>Press <strong>Cut the network</strong> above with each mode selected. In AP the replicas keep answering and the stale count climbs. In CP they refuse and the error count climbs. Neither is correct in general — it depends entirely on what the data is for.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Data</th><th>Choose</th><th>Because</th></tr></thead>
      <tbody>
        <tr><td>Account balance, inventory, seat booking</td><td>Consistency</td><td>Selling the same seat twice costs more than an error page</td></tr>
        <tr><td>Feed, likes, view counts, notifications</td><td>Availability</td><td>A slightly stale count is invisible; an error is not</td></tr>
        <tr><td>Session and preferences</td><td>Availability</td><td>Worst case, the user's theme is briefly wrong</td></tr>
        <tr><td>Unique username at signup</td><td>Consistency</td><td>Two owners of one name is not repairable later</td></tr>
      </tbody>
    </table></div>
    <p>Note that this is a per-operation decision, not a per-company one. The same product can take payments with strict consistency and serve its home feed from whatever replica is closest.</p>

    <h2>The guarantees, weakest to strongest</h2>
    <ul>
      <li><strong>Eventual consistency</strong> — if writes stop, replicas converge. Says nothing about when.</li>
      <li><strong>Read your own writes</strong> — you always see your own changes; other people's may lag. Usually the one users actually notice.</li>
      <li><strong>Monotonic reads</strong> — you never see time go backwards. Prevents the refresh that makes a comment disappear.</li>
      <li><strong>Linearizability</strong> — the system behaves as if there were one copy and every operation happened at a single instant. The strongest, and the most expensive: it needs coordination on every write.</li>
    </ul>

    <h3>Quorums</h3>
    <p>Systems without a single leader tune this with two numbers: how many replicas must acknowledge a write (W) and how many must answer a read (R), out of N copies. If <code>W + R &gt; N</code>, any read set overlaps any write set, so a read is guaranteed to see the latest write.</p>
    <pre><code>N = 3, W = 2, R = 2   →  W + R = 4 &gt; 3   strong-ish, survives one node down
N = 3, W = 1, R = 1   →  W + R = 2 ≤ 3   fast, may read stale</code></pre>
    <p>Same cluster, two different guarantees, chosen per query.</p>

    <div class="callout tip">
      <div class="callout-title">Cheap fixes that avoid the hard choice</div>
      <p>Most stale-read complaints are fixed without touching consistency levels: send a user's reads to the leader for a few seconds after they write, pin a session to one replica so time never runs backwards, or return the new value straight from the write response instead of re-reading it. Reach for these before reaching for a consensus protocol.</p>
    </div>

    <h2>Nothing is free</h2>
    <p>Strong consistency costs latency, because coordination means waiting for other machines — and if those machines are in another region, physics sets the floor. Weak consistency costs correctness in ways that surface as strange bug reports months later. The engineering skill is knowing which data deserves which price.</p>`,

  init(root) {
    const canvas = root.querySelector('#repCanvas');
    const state = { lag: 150, wps: 1.5, split: 80 };
    controls(root, state);

    let capMode = 'ap', partitioned = false;
    root.querySelector('#capMode').addEventListener('click', e => {
      const btn = e.target.closest('[data-cap]');
      if (!btn) return;
      capMode = btn.dataset.cap;
      root.querySelectorAll('#capMode .pill').forEach(p => p.setAttribute('aria-pressed', String(p === btn)));
    });
    const partBtn = root.querySelector('#repPartition');
    partBtn.addEventListener('click', () => {
      partitioned = !partitioned;
      partBtn.setAttribute('aria-pressed', String(partitioned));
      partBtn.textContent = partitioned ? 'Heal the network' : 'Cut the network';
    });

    const LANES = ['leader', 'replica A', 'replica B'];
    let clock = 0, version = 0, writeDebt = 0, readDebt = 0;
    let applied = [0, 0, 0];          // version each lane currently holds
    let inflight = [];                // { to, from, at, arrive, version }
    let marks = [];                   // read results drawn as fading dots
    let stale = 0, fresh = 0, errors = 0;

    function step(dt) {
      clock += dt;

      // writes land on the leader, then propagate
      writeDebt += state.wps * dt;
      while (writeDebt > 1) {
        writeDebt -= 1;
        version++;
        applied[0] = version;
        for (const lane of [1, 2]) {
          const jitter = 1 + (lane === 2 ? 0.6 : 0) + Math.random() * 0.5;
          inflight.push({ lane, at: clock, arrive: clock + (state.lag / 1000) * jitter, version });
        }
      }
      // a partition stops replication traffic reaching the replicas
      inflight = inflight.filter(p => {
        if (partitioned) return true;
        if (clock >= p.arrive) { applied[p.lane] = Math.max(applied[p.lane], p.version); return false; }
        return true;
      });

      // reads
      readDebt += 9 * dt;
      while (readDebt > 1) {
        readDebt -= 1;
        const toReplica = Math.random() * 100 < state.split;
        const lane = toReplica ? 1 + Math.floor(Math.random() * 2) : 0;
        let kind;
        if (toReplica && partitioned && capMode === 'cp') { kind = 'error'; errors++; }
        else if (applied[lane] === version) { kind = 'fresh'; fresh++; }
        else { kind = 'stale'; stale++; }
        marks.push({ lane, at: clock, kind, x: Math.random() });
      }
      marks = marks.filter(m => clock - m.at < 2.4);
    }

    const s = scene(canvas, (ctx, { w, h, dt, c }) => {
      step(Math.min(dt, 0.05));

      const total = stale + fresh;
      root.querySelector('#repStale').textContent = total ? ((stale / total) * 100).toFixed(1) + '%' : '—';
      root.querySelector('#repErr').textContent = errors ? errors + ' refused' : '0';

      const padL = 96, padR = 16, top = 34;
      const laneH = (h - top - 26) / 3;
      const trackW = w - padL - padR;

      LANES.forEach((name, i) => {
        const y = top + laneH * i + laneH / 2;
        const cut = partitioned && i > 0;

        ctx.strokeStyle = cut ? c.accent3 : c.grid;
        ctx.lineWidth = cut ? 1.6 : 1;
        if (cut) ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = `600 11px ${c.sans}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillStyle = i === 0 ? c.accent : c.soft;
        ctx.fillText(name, padL - 34, y);
        // the version this lane currently holds
        const behind = applied[i] < version;
        ctx.fillStyle = behind ? c.accent3 : c.accent2;
        roundRect(ctx, padL - 28, y - 9, 24, 18, 5); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `600 10px ${c.mono}`; ctx.textAlign = 'center';
        ctx.fillText('v' + applied[i], padL - 16, y + 1);
      });

      // replication packets in flight
      for (const p of inflight) {
        const y0 = top + laneH * 0 + laneH / 2;
        const y1 = top + laneH * p.lane + laneH / 2;
        const prog = partitioned
          ? clamp((clock - p.at) / Math.max(0.001, p.arrive - p.at), 0, 0.42)
          : clamp((clock - p.at) / Math.max(0.001, p.arrive - p.at), 0, 1);
        const x = padL + 10 + prog * (trackW - 20);
        const y = y0 + (y1 - y0) * Math.min(1, prog * 1.6);
        ctx.fillStyle = partitioned && prog >= 0.41 ? c.accent3 : c.accent;
        ctx.globalAlpha = partitioned && prog >= 0.41 ? 0.45 + 0.3 * Math.sin(clock * 8) : 0.9;
        ctx.beginPath(); ctx.arc(x, y, 3.4, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // read outcomes
      for (const m of marks) {
        const age = (clock - m.at) / 2.4;
        const y = top + laneH * m.lane + laneH / 2 + 16;
        const x = padL + 12 + m.x * (trackW - 24);
        ctx.globalAlpha = 1 - age;
        ctx.fillStyle = m.kind === 'fresh' ? c.accent2 : m.kind === 'stale' ? c.accent3 : c.muted;
        if (m.kind === 'error') {
          ctx.strokeStyle = c.accent3; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3);
          ctx.moveTo(x + 3, y - 3); ctx.lineTo(x - 3, y + 3); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      if (partitioned) {
        const px = padL + (trackW - 20) * 0.42 + 10;
        ctx.strokeStyle = c.accent3; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(px, top + laneH * 0.6); ctx.lineTo(px, h - 24); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = c.accent3; ctx.font = `600 10px ${c.mono}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(capMode === 'cp' ? 'partition · CP: replicas refuse reads'
                                      : 'partition · AP: replicas answer anyway', px + 6, top + laneH * 0.6 + 10);
      }

      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = `500 10px ${c.mono}`; ctx.fillStyle = c.muted;
      ctx.fillText(`latest committed version v${version}`, padL, 18);
      ctx.textAlign = 'right';
      ctx.fillStyle = c.accent2; ctx.fillText('● fresh', w - padR - 152, 18);
      ctx.fillStyle = c.accent3; ctx.fillText('● stale', w - padR - 86, 18);
      ctx.fillStyle = c.muted; ctx.fillText('✕ refused', w - padR, 18);
    }, { height: 260 });

    return () => s.stop();
  },
};
