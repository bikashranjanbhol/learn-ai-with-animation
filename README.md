# Learn to Build

An interactive tutorial portal that teaches how modern AI works — every concept
paired with something you can drag, tune, or watch run.

**Live site:** https://bikashranjanbhol.github.io/learn-ai-with-animation/

## The portal

| Region | What it does |
| --- | --- |
| **Header** | Brand, lesson search (press <kbd>/</kbd>), light/dark toggle, reading-progress bar |
| **Left sidebar** | The full syllabus grouped into three sections, with per-lesson completion tracking |
| **Main content** | The lesson itself, with live canvas demos inline |
| **Right sidebar** | "On this page" outline that follows you as you scroll |

On narrow screens both sidebars become drawers and the search box moves into
the navigation drawer.

## The course

**Foundations** — what machine learning actually is · the artificial neuron ·
layers and the forward pass

**How models learn** — loss functions · gradient descent · backpropagation

**Modern AI** — embeddings · attention and the transformer · how a language
model writes

Nine lessons, ~68 minutes of reading, twelve interactive demos. Highlights:

- A perceptron whose weights, bias and activation function you set by hand.
- A ball you roll down a loss curve, with learning rate and momentum — push the
  rate too high and watch it diverge.
- A real neural network training live in your browser on rings, XOR or a
  spiral, with backpropagation written out by hand in
  [`assets/js/lessons/backprop.js`](assets/js/lessons/backprop.js).
- A self-attention map you can hover, and a token-by-token generator with a
  temperature dial.

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
   the section you want. Navigation, routing, the outline, prev/next paging and
   progress tracking all follow from that one registry.

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
assets/js/content.js    course registry (order of lessons lives here)
assets/js/lessons/      one module per lesson, plus the home page
```

## Deployment

Pushing to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which publishes the repository root to GitHub Pages. The workflow enables Pages
on first run; if the repository settings block that, set
**Settings → Pages → Source** to **GitHub Actions** once and re-run it.
