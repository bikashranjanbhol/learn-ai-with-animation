# Learn to Build

An interactive tutorial portal covering two subjects — how modern AI works, and
how to design systems that scale — with every concept paired with something you
can drag, tune, or watch run.

**Live site:** https://bikashranjanbhol.github.io/learn-ai-with-animation/

## The portal

| Region | What it does |
| --- | --- |
| **Header** | Brand, lesson search (press <kbd>/</kbd>), light/dark toggle, reading-progress bar |
| **Left sidebar** | Both tracks in full, grouped into sections, with per-lesson completion tracking |
| **Main content** | The lesson itself, with live canvas demos inline |
| **Right sidebar** | "On this page" outline that follows you as you scroll |

On narrow screens both sidebars become drawers and the search box moves into
the navigation drawer.

## The course

Two tracks, 17 lessons, ~135 minutes of reading, and an interactive demo in
every one.

### How AI Works (9 lessons)

**Foundations** — what machine learning actually is · the artificial neuron ·
layers and the forward pass

**How Models Learn** — loss functions · gradient descent · backpropagation

**Modern AI** — embeddings · attention and the transformer · how a language
model writes

### System Design (8 lessons)

**Sizing and Speed** — estimating before you design · latency, throughput and
queues · caching

**Scaling Out** — load balancing and horizontal scale · replication and
sharding · consistency, CAP and stale reads

**Staying Up** — timeouts, retries and back-pressure · case study: a URL
shortener

### Demos worth a look

- A perceptron whose weights, bias and activation function you set by hand.
- A ball you roll down a loss curve, with learning rate and momentum — push the
  rate too high and watch it diverge.
- A real neural network training live in your browser on rings, XOR or a
  spiral, with backpropagation written out by hand in
  [`assets/js/lessons/backprop.js`](assets/js/lessons/backprop.js).
- A self-attention map you can hover, and a token-by-token generator with a
  temperature dial.
- A single-server queue simulation where latency goes vertical past ~80%
  utilisation, plotted against the M/M/1 curve it is supposed to follow.
- A cache with LRU/LFU/FIFO/random eviction over a Zipf-distributed key stream.
- A consistent-hashing ring: add a server and compare how many keys move
  against plain `hash(key) % N`.
- A retry storm you can trigger, then stop with a circuit breaker.

## Running it locally

No build step, no dependencies — it is static files using ES modules, so it
needs to be served over HTTP rather than opened from disk:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Adding a lesson

1. Create `assets/js/lessons/my-lesson.js` exporting a default object:

   ```js
   export default {
     id: 'my-lesson',          // becomes the #/my-lesson route
     title: 'My lesson',
     minutes: 5,
     interactive: true,
     tags: ['searchable', 'keywords'],
     summary: 'One sentence shown under the title.',
     body: () => `<h2>A heading</h2><p>…</p>`,   // h2/h3 build the right sidebar
     init(root) { /* optional: wire up demos, return a cleanup function */ },
   };
   ```

2. Import it in [`assets/js/content.js`](assets/js/content.js) and drop it into
   the section you want. Each section declares a `track`, and sections are
   grouped by track in the sidebar and on the home page. Navigation, routing,
   the outline, prev/next paging and progress tracking all follow from that one
   registry.

Canvas demos should use the helpers in
[`assets/js/anim.js`](assets/js/anim.js) — `scene()` handles DPI scaling,
resizing, pausing when off-screen and theme changes; `palette()` reads the
current theme's colours.

## Layout

```
index.html              page shell: header, three regions
assets/css/style.css    design tokens + all styling
assets/js/app.js        hash router, search, scrollspy outline, progress
assets/js/anim.js       canvas/animation helpers
assets/js/content.js    course registry (tracks, sections and lesson order)
assets/js/lessons/      one module per lesson, plus the home page
                        (system design lessons are prefixed sd-)
```

## Deployment

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publishes the
repository root to GitHub Pages on every push to `main`, `master` or a
`claude/**` branch, and can also be run by hand from the Actions tab.

**One-time setup.** GitHub does not let a workflow's built-in token create the
Pages site itself, so the first deploy fails with
*"Create Pages site failed: Resource not accessible by integration"* until an
account with repository admin does this once:

1. **Settings → Pages**
2. Set **Source** to **GitHub Actions**
3. **Actions → Deploy to GitHub Pages → Run workflow** (or push any commit)

The site is then served from
`https://<owner>.github.io/learn-ai-with-animation/` and every later push
redeploys it automatically.
