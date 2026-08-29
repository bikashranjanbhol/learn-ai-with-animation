/**
 * Learn to Build — portal shell.
 * Hash router + left course nav + right "on this page" outline with scrollspy.
 */
import { sections, lessons, byId, tracks, trackPosition } from './content.js';
import { home } from './lessons/home.js';

const $ = (sel, root = document) => root.querySelector(sel);
const els = {
  article:      $('#article'),
  main:         $('#main'),
  nav:          $('#sidebarNav'),
  navEmpty:     $('#sidebarEmpty'),
  toc:          $('#toc'),
  search:       $('#search'),
  left:         $('#sidebarLeft'),
  right:        $('#sidebarRight'),
  scrim:        $('#scrim'),
  navToggle:    $('#navToggle'),
  tocToggle:    $('#tocToggle'),
  themeToggle:  $('#themeToggle'),
  topBtn:       $('#topBtn'),
  progressBar:  $('#progressBar'),
  progressMeter:$('#progressMeter'),
  progressCount:$('#progressCount'),
  headerProg:   $('#headerProgress'),
};

/* ----------------------------- theme ----------------------------- */
const THEME_KEY = 'ltb:theme';
function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', mode === 'dark' ? 'dark light' : 'light dark');
}
applyTheme(
  localStorage.getItem(THEME_KEY) ||
  (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
);
els.themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
  window.dispatchEvent(new CustomEvent('ltb:theme'));
});

/* --------------------------- completion --------------------------- */
const DONE_KEY = 'ltb:completed';
const readDone = () => {
  try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]')); }
  catch { return new Set(); }
};
let done = readDone();
const saveDone = () => localStorage.setItem(DONE_KEY, JSON.stringify([...done]));

function refreshProgress() {
  const total = lessons.length;
  const count = lessons.filter(l => done.has(l.id)).length;
  const pct = total ? Math.round((count / total) * 100) : 0;
  els.progressBar.style.width = pct + '%';
  els.progressCount.textContent = `${count} / ${total}`;
  els.progressMeter.setAttribute('aria-valuenow', String(pct));
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('done', done.has(a.dataset.id));
  });
}

/* ------------------------- left navigation ------------------------- */
function buildNav() {
  els.nav.innerHTML = tracks.map(t => `
    <div class="nav-track" data-track="${esc(t.track)}">
      <p class="nav-track-title">
        <span>${esc(t.track)}</span>
        <em>${t.lessons.length} lessons · ${t.minutes} min</em>
      </p>
      ${t.sections.map((section, i) => `
        <div class="nav-section" data-section="${sections.indexOf(section)}">
          <h2 class="nav-section-title"><span class="num">${i + 1}</span>${esc(section.title)}</h2>
          <ul class="nav-list">
            ${section.lessons.map(l => `
              <li>
                <a class="nav-link" data-id="${l.id}" href="#/${l.id}" title="${esc(l.title)}">
                  <span class="dot"></span>
                  <span class="label">${esc(l.title)}</span>
                  <span class="mins">${l.minutes}m</span>
                </a>
              </li>`).join('')}
          </ul>
        </div>`).join('')}
    </div>`).join('');
}

function markActiveNav(id) {
  document.querySelectorAll('.nav-link').forEach(a => {
    const active = a.dataset.id === id;
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

/* ------------------------------ search ------------------------------ */
function filterNav(query) {
  const q = query.trim().toLowerCase();
  let visible = 0;
  document.querySelectorAll('.nav-section').forEach(sec => {
    let shown = 0;
    sec.querySelectorAll('.nav-link').forEach(a => {
      const lesson = byId.get(a.dataset.id);
      const hay = `${lesson.title} ${lesson.summary} ${(lesson.tags || []).join(' ')}`.toLowerCase();
      const hit = !q || hay.includes(q);
      a.parentElement.hidden = !hit;
      if (hit) shown++;
    });
    sec.hidden = shown === 0;
    visible += shown;
  });
  document.querySelectorAll('.nav-track').forEach(tr => {
    tr.hidden = ![...tr.querySelectorAll('.nav-section')].some(sec => !sec.hidden);
  });
  els.navEmpty.hidden = visible !== 0;
}
els.search.addEventListener('input', e => filterNav(e.target.value));

/* ------------------------------- TOC ------------------------------- */
let headings = [];
function buildToc() {
  headings = [...els.article.querySelectorAll('h2, h3')];
  headings.forEach((h, i) => { if (!h.id) h.id = slug(h.textContent) || `section-${i}`; });

  if (headings.length < 2) {
    els.toc.innerHTML = '<span class="toc-empty" style="padding:4px 12px;font-size:12.5px;color:var(--text-muted)">No subsections</span>';
    return;
  }
  els.toc.innerHTML = headings.map(h =>
    `<a href="#${h.id}" class="${h.tagName === 'H3' ? 'sub' : ''}" data-target="${h.id}">${esc(h.textContent)}</a>`
  ).join('');

  els.toc.querySelectorAll('a').forEach(a => a.addEventListener('click', ev => {
    ev.preventDefault();
    document.getElementById(a.dataset.target)?.scrollIntoView({ behavior: prefersMotion() ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', `${location.pathname}${location.hash.split('#')[1] ? '#' + location.hash.split('#')[1] : ''}`);
    closeDrawers();
  }));
}

function syncScrollState() {
  // reading progress in the header
  const doc = document.documentElement;
  const max = doc.scrollHeight - innerHeight;
  els.headerProg.style.width = (max > 40 ? Math.min(100, (doc.scrollTop / max) * 100) : 0) + '%';

  if (!headings.length) return;
  const line = doc.scrollTop + (parseInt(getComputedStyle(doc).getPropertyValue('--header-h')) || 62) + 90;
  let current = headings[0];
  for (const h of headings) {
    if (h.offsetTop <= line) current = h; else break;
  }
  els.toc.querySelectorAll('a').forEach(a => a.classList.toggle('active', a.dataset.target === current.id));
}
addEventListener('scroll', () => requestAnimationFrame(syncScrollState), { passive: true });
addEventListener('resize', syncScrollState);

/* ------------------------------ router ------------------------------ */
let teardown = null;

function render() {
  const id = (location.hash.replace(/^#\/?/, '') || '').split('?')[0];
  const lesson = byId.get(id);

  if (typeof teardown === 'function') { try { teardown(); } catch { /* noop */ } teardown = null; }

  if (!lesson) {
    document.title = 'Learn to Build — AI and System Design, Visually';
    els.article.innerHTML = home.body({ tracks, lessons, done });
    markActiveNav(null);
    teardown = home.init?.(els.article) || null;
  } else {
    document.title = `${lesson.title} · Learn to Build`;
    els.article.innerHTML = lessonShell(lesson);
    markActiveNav(lesson.id);
    teardown = lesson.init?.(els.article) || null;
    wireLessonActions(lesson);
  }

  buildToc();
  refreshProgress();
  scrollTo({ top: 0, behavior: 'auto' });
  syncScrollState();
  els.main.focus({ preventScroll: true });
  closeDrawers();
}

function lessonShell(lesson) {
  const i = lessons.indexOf(lesson);
  const prev = lessons[i - 1], next = lessons[i + 1];
  const isDone = done.has(lesson.id);
  const pos = trackPosition(lesson);
  return `
    <div class="eyebrow">
      <span class="chip">${esc(lesson.track)}</span>
      <span class="chip neutral">${esc(lesson.section)}</span>
      <span class="chip neutral">Lesson ${pos.index} of ${pos.total}</span>
      <span class="chip neutral">${lesson.minutes} min read</span>
    </div>
    <h1>${esc(lesson.title)}</h1>
    <p class="lede">${lesson.summary}</p>
    ${lesson.body()}
    <div class="lesson-actions">
      <button class="btn${isDone ? ' secondary' : ''}" id="doneBtn" type="button">
        <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
        <span>${isDone ? 'Completed' : 'Mark as complete'}</span>
      </button>
      ${next ? `<a class="btn secondary" href="#/${next.id}">Next lesson
        <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>` : ''}
    </div>
    <div class="pager">
      ${prev ? `<a class="prev" href="#/${prev.id}"><span>← Previous</span><strong>${esc(prev.title)}</strong></a>` : ''}
      ${next ? `<a class="next" href="#/${next.id}"><span>Next →</span><strong>${esc(next.title)}</strong></a>` : ''}
    </div>`;
}

function wireLessonActions(lesson) {
  const btn = $('#doneBtn', els.article);
  btn?.addEventListener('click', () => {
    if (done.has(lesson.id)) done.delete(lesson.id); else done.add(lesson.id);
    saveDone();
    const isDone = done.has(lesson.id);
    btn.classList.toggle('secondary', isDone);
    $('span', btn).textContent = isDone ? 'Completed' : 'Mark as complete';
    refreshProgress();
  });
}

/* --------------- responsive home for the search box --------------- */
const smallScreen = matchMedia('(max-width: 720px)');
const searchWrap = $('.header-search');
const headerEl = $('.site-header');
const headerRight = $('.header-right');
function placeSearch() {
  if (smallScreen.matches) {
    if (searchWrap.parentElement !== els.left) els.left.prepend(searchWrap);
  } else if (searchWrap.parentElement !== headerEl) {
    headerEl.insertBefore(searchWrap, headerRight);
  }
}
smallScreen.addEventListener('change', placeSearch);
placeSearch();

/* ----------------------------- drawers ----------------------------- */
function openDrawer(which) {
  const panel = which === 'left' ? els.left : els.right;
  const toggle = which === 'left' ? els.navToggle : els.tocToggle;
  panel.classList.add('open');
  toggle.setAttribute('aria-expanded', 'true');
  els.scrim.hidden = false;
}
function closeDrawers() {
  els.left.classList.remove('open');
  els.right.classList.remove('open');
  els.navToggle.setAttribute('aria-expanded', 'false');
  els.tocToggle.setAttribute('aria-expanded', 'false');
  els.scrim.hidden = true;
}
els.navToggle.addEventListener('click', () =>
  els.left.classList.contains('open') ? closeDrawers() : openDrawer('left'));
els.tocToggle.addEventListener('click', () =>
  els.right.classList.contains('open') ? closeDrawers() : openDrawer('right'));
els.scrim.addEventListener('click', closeDrawers);
els.topBtn.addEventListener('click', () => {
  scrollTo({ top: 0, behavior: prefersMotion() ? 'auto' : 'smooth' });
  closeDrawers();
});
addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeDrawers(); if (document.activeElement === els.search) els.search.blur(); }
  if (e.key === '/' && document.activeElement !== els.search && !e.metaKey && !e.ctrlKey) {
    e.preventDefault(); els.search.focus(); els.search.select();
  }
});
addEventListener('hashchange', render);

/* ----------------------------- helpers ----------------------------- */
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function slug(s) {
  return String(s).toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 60);
}
function prefersMotion() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }

/* ------------------------------- boot ------------------------------- */
buildNav();
refreshProgress();
render();
