import { scene, palette } from '../anim.js';

export const home = {
  body({ sections, lessons, done }) {
    const next = lessons.find(l => !done.has(l.id)) || lessons[0];
    const completed = lessons.filter(l => done.has(l.id)).length;
    const minutes = lessons.reduce((n, l) => n + l.minutes, 0);

    return `
      <section class="hero">
        <svg class="hero-orbit" viewBox="0 0 200 200" aria-hidden="true">
          <g fill="none" stroke="currentColor" stroke-opacity=".35" style="color:var(--accent)">
            <circle cx="100" cy="100" r="46"/><circle cx="100" cy="100" r="70"/><circle cx="100" cy="100" r="92"/>
          </g>
          <g style="color:var(--accent)">
            <circle cx="100" cy="54" r="6" fill="currentColor">
              <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="9s" repeatCount="indefinite"/>
            </circle>
          </g>
          <g style="color:var(--accent-2)">
            <circle cx="100" cy="30" r="5" fill="currentColor">
              <animateTransform attributeName="transform" type="rotate" from="360 100 100" to="0 100 100" dur="15s" repeatCount="indefinite"/>
            </circle>
          </g>
          <circle cx="100" cy="100" r="15" fill="currentColor" style="color:var(--accent)" opacity=".9"/>
        </svg>

        <div class="eyebrow"><span class="chip">Interactive course</span><span class="chip neutral">${lessons.length} lessons · ~${minutes} min</span></div>
        <h1>Understand AI by<br>watching it work.</h1>
        <p class="lede">Every idea here comes with something that moves — a neuron you can tune, a loss surface you can roll a ball down, an attention map you can hover. Read a little, then play with the thing you just read about.</p>
        <div class="hero-cta">
          <a class="btn" href="#/${next.id}">${completed ? 'Continue' : 'Start'}: ${escape_(next.title)}
            <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
          <a class="btn secondary" href="#/${lessons[0].id}">Start from the beginning</a>
        </div>
        <div class="stat-row">
          <div class="stat"><b>${completed}/${lessons.length}</b><span>lessons completed</span></div>
          <div class="stat"><b>${lessons.filter(l => l.interactive).length}</b><span>hands-on lessons</span></div>
          <div class="stat"><b>0</b><span>maths prerequisites</span></div>
        </div>
      </section>

      <div class="demo">
        <div class="demo-head"><h4>A neural network, thinking out loud</h4><span class="badge">Live</span></div>
        <div class="demo-stage"><canvas id="heroNet"></canvas></div>
      </div>

      <h2>What you will learn</h2>
      <p>The course runs in three passes. First the pieces, then the learning rule that tunes them, then the architecture that turned all of it into the models you use today.</p>

      ${sections.map((s, i) => `
        <h3>${i + 1}. ${escape_(s.title)}</h3>
        <div class="card-grid">
          ${s.lessons.map(l => `
            <a class="card" href="#/${l.id}">
              <span class="card-num">${l.minutes} min${done.has(l.id) ? ' · done' : ''}</span>
              <h3>${escape_(l.title)}</h3>
              <p>${l.summary.replace(/<[^>]+>/g, '')}</p>
            </a>`).join('')}
        </div>`).join('')}

      <h2>How to use this portal</h2>
      <ul>
        <li><strong>Left rail</strong> — the whole syllabus. Your progress is stored in this browser, so the dots stay filled when you come back.</li>
        <li><strong>Right rail</strong> — the outline of the page you are on; it follows you as you scroll.</li>
        <li><strong>Search</strong> — press <code>/</code> anywhere to jump to the search box and filter lessons.</li>
        <li><strong>Theme</strong> — the sun/moon button flips between light and dark; the demos repaint to match.</li>
      </ul>
      <div class="callout tip">
        <div class="callout-title">Tip</div>
        <p>Drag every slider you meet. The demos are the lesson — the prose is just there to tell you what to look for.</p>
      </div>`;
  },

  init(root) {
    const canvas = root.querySelector('#heroNet');
    if (!canvas) return null;

    const layers = [4, 6, 6, 3];
    const pulses = Array.from({ length: 26 }, () => ({
      layer: Math.floor(Math.random() * (layers.length - 1)),
      from: 0, to: 0, p: Math.random(), speed: 0.28 + Math.random() * 0.5,
    }));
    pulses.forEach(seed);
    function seed(p) {
      p.layer = Math.floor(Math.random() * (layers.length - 1));
      p.from = Math.floor(Math.random() * layers[p.layer]);
      p.to = Math.floor(Math.random() * layers[p.layer + 1]);
      p.p = 0;
    }

    const s = scene(canvas, (ctx, { w, h, t, dt, c }) => {
      const padX = 46, padY = 26;
      const cols = layers.map((n, i) => padX + (i * (w - padX * 2)) / (layers.length - 1));
      const pos = layers.map((n, i) =>
        Array.from({ length: n }, (_, j) => ({ x: cols[i], y: padY + ((j + 0.5) * (h - padY * 2)) / n })));

      // edges
      ctx.lineWidth = 1;
      for (let i = 0; i < pos.length - 1; i++) {
        for (const a of pos[i]) for (const b of pos[i + 1]) {
          ctx.strokeStyle = c.grid;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      // travelling activations
      for (const p of pulses) {
        p.p += dt * p.speed;
        if (p.p >= 1) seed(p);
        const a = pos[p.layer]?.[p.from], b = pos[p.layer + 1]?.[p.to];
        if (!a || !b) { seed(p); continue; }
        const x = a.x + (b.x - a.x) * p.p, y = a.y + (b.y - a.y) * p.p;
        const fade = Math.sin(Math.PI * p.p);
        ctx.strokeStyle = p.layer % 2 ? c.accent2 : c.accent;
        ctx.globalAlpha = 0.55 * fade;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(a.x + (b.x - a.x) * Math.max(0, p.p - 0.16), a.y + (b.y - a.y) * Math.max(0, p.p - 0.16));
        ctx.lineTo(x, y); ctx.stroke();
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.layer % 2 ? c.accent2 : c.accent;
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // nodes
      pos.forEach((layer, i) => layer.forEach((n, j) => {
        const puls = 0.5 + 0.5 * Math.sin(t * 1.7 + i * 0.9 + j * 0.6);
        ctx.fillStyle = c.surface;
        ctx.strokeStyle = i === 0 ? c.accent2 : i === pos.length - 1 ? c.accent3 : c.accent;
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = 0.45 + 0.55 * puls;
        ctx.beginPath(); ctx.arc(n.x, n.y, 8.5, 0, 7); ctx.fill(); ctx.stroke();
        ctx.globalAlpha = 1;
      }));
      // labels
      ctx.font = `500 10px ${c.mono}`;
      ctx.fillStyle = c.muted;
      ctx.textAlign = 'center';
      ['input', 'hidden', 'hidden', 'output'].forEach((lbl, i) => ctx.fillText(lbl, cols[i], h - 6));
    }, { height: 250 });

    return () => s.stop();
  },
};

function escape_(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
