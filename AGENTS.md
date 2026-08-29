# Working on this repo

Instructions for AI coding agents (Claude Code, OpenAI Codex, and anything else
that reads this file). Humans: this is also the fastest orientation.

**Read this before writing code. It exists because the conventions here are not
obvious from the file tree, and getting them wrong produces changes that look
fine in review and are broken in the browser.**

---

## 1. What this project is

A tutorial portal — static HTML, CSS and ES modules, served straight from the
repo root by GitHub Pages.

- **No build step. No bundler. No dependencies. No framework.** Do not add
  React, Vite, Tailwind, a `package.json`, or a CDN `<script>` tag. If a change
  seems to need one, it does not — say so instead of adding it.
- Everything ships as source. The file you edit is the file that runs.
- Two subject **tracks** (`How AI Works`, `System Design`), each split into
  sections of lessons.

## 2. Run and verify it

There is no test suite. **Verification means driving the real page in a
browser** — several bugs in this repo's history were invisible in the source and
obvious on screen.

```bash
python3 -m http.server 8123      # ES modules need HTTP; file:// will not work
# open http://localhost:8123
```

Chromium is available for headless checks (in the Claude Code web sandbox it is
at `/opt/pw-browsers/chromium`; elsewhere use whatever Playwright/Puppeteer
resolves). A change is not done until you have confirmed, on the affected pages:

1. **No console errors and no page errors.** A missing import or a typo in a
   lesson module silently renders an empty article.
2. **Both themes.** Toggle light/dark and look at the demos, not just the prose.
3. **At least one narrow width** (~390px) and one wide (~1440px). Check that
   `document.documentElement.scrollWidth <= innerWidth` — the page must never
   scroll horizontally.
4. **The demo actually behaves.** Drag every slider and press every button you
   added. Read the numbers it prints and ask whether they are plausible.

That last one is not ceremony. It is how the real bugs were caught (§7).

## 3. Layout

```
index.html              page shell: header, left sidebar, main, right sidebar
assets/css/style.css    design tokens + all styling (one file, no preprocessor)
assets/js/app.js        hash router, search, scrollspy outline, progress, header menu
assets/js/anim.js       canvas/animation helpers — read this before writing a demo
assets/js/content.js    registry: tracks, sections, lesson order
assets/js/lessons/      one module per lesson (system-design lessons are sd-*)
assets/js/lessons/home.js   the landing page
```

## 4. Adding or editing a lesson

A lesson is one ES module with a default export. Nothing else needs touching
except the registry.

```js
import { scene, controls, clamp } from '../anim.js';

export default {
  id: 'sd-queues',          // the #/sd-queues route; kebab-case; sd- prefix for system design
  title: 'Queues',          // shown in the sidebar and the <h1>
  minutes: 8,               // honest reading estimate; feeds the progress totals
  interactive: true,        // true if the lesson has a demo (it should)
  tags: ['queue', 'backpressure'],   // extra search terms beyond title + summary
  summary: 'One sentence, rendered under the title as the lede.',

  body: () => `
    <h2>A section</h2>      <!-- h2/h3 build the right-hand outline automatically -->
    <p>…</p>`,

  init(root) {              // optional; runs after body() is in the DOM
    const s = scene(root.querySelector('#myCanvas'), (ctx, { w, h, dt, t, c }) => { … });
    return () => s.stop();  // REQUIRED if you start anything. See §5.
  },
};
```

Then import it in `assets/js/content.js` and place it in a section. Navigation,
routing, the outline, prev/next paging, search and progress tracking all follow
from that one registry — never hand-write a link to a lesson.

`content.js` also exports `tracks`, `byId`, `lessons` and `trackPosition`; the
sidebar and header menu are generated from `tracks`, so a new track needs no
markup.

### Content rules

- **Every lesson carries a working demo, not a diagram.** The bar in this repo
  is that the thing on screen genuinely computes: a real MLP trained with
  hand-written backprop, a real M/M/1 queue, a real consistent-hashing ring, a
  real token-bucket limiter. A static SVG of a concept is not acceptable here.
- Prose is direct and concrete. Short paragraphs, no filler, no "in today's
  fast-paced world". Explain the mechanism and say what the trade-off costs.
- Point at what to look for in the demo ("push the rate past 1.0 and watch it
  diverge") rather than describing what the reader can already see.
- Use `<h2>` for main sections and `<h3>` beneath — they become the outline.
- Available prose components, already styled: `.demo`, `.callout` (`.tip`,
  `.warn`), `.table-wrap > table`, `pre > code` with `.tok-key`/`.tok-num`/
  `.tok-com`/`.tok-str` spans, `.pill-row > .pill`, `.ctrl` + `input[type=range]`,
  `.readout`. Copy the markup from an existing lesson rather than inventing new
  classes.

## 5. Writing a demo — the rules that bite

Read `assets/js/anim.js` first. It exports `scene`, `palette`, `controls`,
`roundRect`, `mix`, `lerp`, `clamp`, `reduced`.

- **Use `scene(canvas, frame, { height, still })`.** It handles device-pixel
  ratio, resize, pausing when off-screen, and theme changes. Never call
  `getContext('2d')` and `requestAnimationFrame` yourself.
- **`init()` must return a cleanup function** that calls `.stop()` on every
  scene and clears every timer/listener you created. The router calls it on
  navigation; skip it and animation loops accumulate on every route change.
- **Never hardcode a colour.** The `frame` callback receives `c` — the current
  theme's palette. A literal `#fff` or `rgba(0,0,0,.5)` will look correct in one
  theme and be invisible in the other. If you need a colour outside the palette,
  pick one that works in both and add it to the local group map (see
  `embeddings.js`), not to a `@media` block.
- `still: true` for demos that only repaint on input; then call `s.redraw()`
  from your input handlers *and* on the `ltb:theme` event, and remove that
  listener in cleanup.
- Wire sliders with `controls(root, state, onChange)` — it reads
  `input[data-key]`, writes `state`, and formats the matching
  `output[data-for]` using `data-decimals`.
- Canvas text needs explicit `textAlign`/`textBaseline` per draw; the context is
  shared across a frame and leaking alignment causes labels to drift.
- Respect `prefers-reduced-motion` for anything decorative (`reduced()`).

## 6. CSS

- **Design tokens only.** Everything comes from the custom properties at the top
  of `style.css`. Both `:root` and `[data-theme="dark"]` must define any token
  you add — never let a colour exist in only one theme.
- Existing breakpoints: **1240** (tighter rails, drop the tagline), **1100**
  (hero art), **1080** (right sidebar becomes a drawer), **1000** (menu
  padding), **900** (header subject menu hides), **860** (left sidebar becomes a
  drawer), **720** (search moves into the drawer, handled in JS), **640**
  (small-phone type). Reuse these rather than inventing new ones.
- **`[hidden]` loses to a class that sets `display`.** If you hide an element
  from JS and its class sets `display: flex/grid`, add an explicit
  `.thing[hidden] { display: none; }` — this exact bug left an empty track
  heading in the sidebar during search.
- Flex children that hold text need `min-width: 0` plus `overflow: hidden`, or
  they overflow their box and overlap a sibling instead of shrinking.

## 7. Bugs this repo has already had — do not reintroduce them

Each of these passed code review and was caught only by looking at the running
page. They are the reason §2 exists.

| Symptom | Cause | Rule |
| --- | --- | --- |
| Queue demo reported `p50 = 0 ms` | Latency measured wall-clock at frame boundaries, so service time inside a frame counted as zero | In a simulation, advance a local clock as work is consumed — do not reuse the frame timestamp |
| Simulated latency sat below the theoretical curve | Arrivals were generated from a deterministic accumulator, which is not a Poisson process | Use exponential inter-arrival gaps when the maths you plot assumes them |
| Faint grid lines across a heat map | Semi-transparent cells overlapping at fractional device pixels | Blend into the surface colour with `mix()` and draw opaque, slightly overlapping cells |
| A rate limiter reported 100% allowed while visibly rejecting | Counters were cumulative since page load, so slider changes never showed | Report rates over a rolling window, not since-boot totals |
| Brand text overlapped the header menu at ~910px | A flex item that could shrink but whose content could not | See §6 on `min-width: 0` |
| A "just requested" marker read as a data bar | The highlight was drawn full-height in the same style as the bars | Annotations must not look like data |

## 8. Git and deployment

- Work on the branch you were given; do not push to `main` without being asked.
- Commit messages: a short imperative subject, then a body explaining *why*.
  Wrap at ~72 characters. Do not put model names or tool identifiers in commits,
  code comments, or anything else pushed to the repo.
- `.github/workflows/deploy.yml` publishes the repo root to GitHub Pages on push
  to `main`, `master` or `claude/**`. Pages must be enabled once by hand
  (Settings → Pages → Source → GitHub Actions); the workflow token cannot do it.
- Do not create a pull request unless asked.

## 9. Before you say you are finished

- [ ] Every route still loads, with zero console errors
- [ ] New lesson is registered in `content.js` and appears in the sidebar, the
      header menu's track, search, and prev/next paging
- [ ] The demo runs, responds to its controls, and prints plausible numbers
- [ ] Light **and** dark checked
- [ ] Narrow and wide checked, no horizontal scroll
- [ ] `init()` returns cleanup, and navigating away leaves nothing running
- [ ] No new dependency, build step, or hardcoded colour
- [ ] Report honestly what you verified and what you did not
