---
name: new-lesson
description: Add a lesson to the Learn to Build portal — scaffold the module, register it in the track, build a real interactive demo, and verify it in the browser. Use when asked to add, draft or replace a lesson, page, topic or subject in this tutorial site.
---

# Add a lesson

Read `AGENTS.md` first if it is not already in context — this skill is the
workflow; that file is the contract.

## 1. Place it

Decide the track and section in `assets/js/content.js`:

- `How AI Works` — Foundations · How Models Learn · Modern AI
- `System Design` — Sizing and Speed · Scaling Out · Staying Up

A new subject area means a new entry in `sections` with its own `track`; the
sidebar, header menu and home page pick it up with no markup changes. Ask the
user which track a lesson belongs to only if it genuinely fits neither.

## 2. Decide the demo before writing the prose

This is the step that determines whether the lesson is any good. Write down, in
one sentence, **what the reader will do and what they will see change.** Then
check it against the bar:

- It must *compute*, not illustrate. Simulate the queue, train the network,
  evict from the cache. If the demo would be equally true with the numbers
  hardcoded, it is a diagram — think again.
- It must have a knob whose effect is surprising, or teaches the lesson's
  central trade-off (utilisation → latency, skew → hit rate, retries → load).
- It must be legible at 390px wide.

Good demos in the repo to model on: `sd-latency.js` (live sim vs theory curve),
`backprop.js` (real training), `sd-data.js` (interaction on a diagram),
`sd-estimation.js` (calculator with a DOM output grid).

## 3. Write the module

Copy the shape from a neighbouring lesson: `id`, `title`, `minutes`,
`interactive`, `tags`, `summary`, `body()`, `init(root)`.

- `sd-` prefix for system design ids and filenames.
- `body()` returns an HTML string; `h2`/`h3` become the right-hand outline.
- `init(root)` wires the demo through `scene()`/`controls()` from
  `assets/js/anim.js` and **returns a cleanup function**.
- Colours from the `c` palette argument only.

Then import it in `content.js` and add it to a section's `lessons` array.

## 4. Verify (not optional)

Serve the site, then drive it headless — see CLAUDE.md for a ready script.
Confirm on the new route and one neighbour:

1. Zero console/page errors.
2. Screenshot the demo and **look at it**; check the printed numbers are
   plausible. If it simulates something with known theory, plot or spot-check
   against that theory.
3. Light and dark.
4. 390px and 1440px; no horizontal scroll.
5. Navigate away and back — nothing keeps running, nothing double-starts.

## 5. Finish

- Confirm the lesson appears in the sidebar, its track's header menu, search
  (try one of its `tags`), and prev/next paging.
- Update `README.md`'s course list and lesson count.
- Commit with an imperative subject and a body explaining the choice of demo.
- Report what you verified — and anything you did not.
