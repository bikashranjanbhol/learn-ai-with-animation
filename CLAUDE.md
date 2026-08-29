# CLAUDE.md

The working instructions for this repo live in **[AGENTS.md](AGENTS.md)** —
project shape, the lesson contract, the demo rules, the CSS gotchas, and the
bugs that have already bitten this codebase once.

**Read AGENTS.md before writing code.** Everything in it applies here; this file
adds only what is specific to Claude Code.

## Quick orientation

- Static site: HTML + CSS + ES modules, no build step, no dependencies.
- A lesson is one module in `assets/js/lessons/`, registered in
  `assets/js/content.js`. That registry drives navigation, search, the outline,
  paging and progress.
- Canvas demos go through the helpers in `assets/js/anim.js`. `init()` must
  return a cleanup function.
- Colours come from theme tokens, never literals — see AGENTS.md §5 and §6.

## Verifying a change

There is no test suite; verification means driving the page. Serve it and drive
it with the pre-installed Chromium:

```bash
python3 -m http.server 8123
```

```js
// scratch script, run with node
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
p.on('pageerror', e => console.log('PAGE ERROR', e.message));
p.on('console', m => m.type() === 'error' && console.log('CONSOLE', m.text()));
await p.goto('http://localhost:8123/index.html#/sd-caching');
await p.waitForTimeout(1500);
await p.screenshot({ path: 'check.png' });
await b.close();
```

Then **look at the screenshot**. Read the numbers the demo prints and judge
whether they are plausible — several real bugs here produced clean consoles and
wrong output (AGENTS.md §7).

Google Fonts is blocked in the sandbox, so `ERR_TUNNEL_CONNECTION_FAILED` for
`fonts.googleapis.com` is expected and not a failure; fallback fonts render.

## Conventions

- Use the branch you were assigned. No PR unless asked.
- Keep model names and tool identifiers out of commits, comments and any other
  pushed artifact.
- `/new-lesson` (`.claude/skills/new-lesson/`) walks the full add-a-lesson flow.
