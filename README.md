# Learn to Build

An interactive tutorial portal covering three subjects — how modern AI works,
how to design systems that scale, and how to prompt models well.

**Live site:** https://bikashranjanbhol.github.io/learn-ai-with-animation/

## The portal

| Region | What it does |
| --- | --- |
| **Header** | Brand, a menu of the two subjects, lesson search (press <kbd>/</kbd>), light/dark toggle, reading-progress bar |
| **Left sidebar** | The lessons of the subject you are in, grouped into sections, with completion tracking |
| **Main content** | The lesson itself, with live canvas demos inline |
| **Right sidebar** | "On this page" outline that follows you as you scroll |

The header menu is the subject switcher. The entry for the subject you are
reading is highlighted, and each entry links back to the last lesson you had
open in that track, so switching subjects resumes rather than restarts.

The sidebar is scoped to one subject at a time — it lists the lessons of the
track you are in, and the progress meter counts that track only. Search is the
exception: a query deliberately reaches across both subjects and labels results
by track, so nothing becomes unreachable just because you are in the other one.

On narrow screens both sidebars become drawers and the search box moves into
the navigation drawer. Below 900px the header menu gives way to a segmented
subject switcher at the top of that drawer, so subjects stay switchable when
the header has no room.

## The course

Three tracks, 29 lessons. The AI and System Design tracks pair every lesson with
an interactive demo you can drag, tune or watch run; Prompt Engineering is
currently prose and worked examples.

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

### Prompt Engineering (12 lessons)

**Foundations** — what prompt engineering is · anatomy of a strong prompt ·
roles and instruction hierarchy

**Prompting Techniques** — zero-shot and few-shot · reasoning and decomposition ·
structured outputs

**Context and Tools** — context engineering · RAG prompting · tool calling and
agents

**Reliability and Production** — injection and safety · evaluation · production
prompting

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

## Working on this with an AI agent

[`AGENTS.md`](AGENTS.md) is the contract: project shape, the lesson module
contract, the demo rules, CSS gotchas, and a table of bugs this codebase has
already had so they do not come back. OpenAI Codex reads it directly;
[`CLAUDE.md`](CLAUDE.md) points Claude Code at the same file and adds the
browser-verification script. `.claude/skills/new-lesson/` is a Claude Code skill
that walks the whole add-a-lesson flow.

The short version for any agent: no build step and no dependencies, every lesson
carries a working simulation rather than a diagram, colours come from theme
tokens only, `init()` must return a cleanup function, and nothing is done until
it has been driven in a browser in both themes.

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
AGENTS.md               conventions for AI agents (Codex + anything else)
CLAUDE.md               Claude Code entry point, points at AGENTS.md
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
