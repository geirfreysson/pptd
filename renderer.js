// App chrome: toolbar, slide drawer, agent terminal. Real work happens in main via window.viewer.
const $ = (id) => document.getElementById(id);
const v = window.viewer;
const body = document.body;

const store = {
  get(k, d) { try { const x = localStorage.getItem(k); return x == null ? d : JSON.parse(x); } catch { return d; } },
  set(k, x) { try { localStorage.setItem(k, JSON.stringify(x)); } catch {} },
};

let cur = { file: null, total: 0, index: 0, mode: 'normal' };

// ---------------------------------------------------------------- stage → main

// The deck is a native view laid over #stage; tell main where #stage is.
const stage = $('stage');
function reportStage() {
  const r = stage.getBoundingClientRect();
  v.stageRect({ x: r.left, y: r.top, width: r.width, height: r.height });
}
new ResizeObserver(reportStage).observe(stage);
window.addEventListener('resize', reportStage);

// ---------------------------------------------------------------- toolbar

$('open').addEventListener('click', () => v.open());
$('prev').addEventListener('click', () => v.nav('prev'));
$('next').addEventListener('click', () => v.nav('next'));
$('play').addEventListener('click', () => v.slideshow('fullscreen'));
$('playMenu').addEventListener('click', (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  v.slideshowMenu(r.left, r.bottom + 4);
});
$('drawerBtn').addEventListener('click', () => setDrawer(!body.classList.contains('drawer-open')));
$('agentBtn').addEventListener('click', () => toggleAgent());

let toastTimer = null;
v.onToast(({ text, kind }) => {
  const t = $('toast');
  t.textContent = text;
  t.title = text;
  t.classList.toggle('error', kind === 'error');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), kind === 'error' ? 9000 : 5000);
});

v.onToggle((what) => (what === 'drawer' ? setDrawer(!body.classList.contains('drawer-open')) : toggleAgent()));

// Keys while focus is in the chrome (not the terminal; the deck has its own preload).
window.addEventListener('keydown', (e) => {
  if (!cur.file || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest?.('#term')) return;            // typing goes to the agent
  const radio = cur.total > 0, inShow = cur.mode !== 'normal';
  const map = {
    ArrowRight: radio && 'next', ArrowDown: radio && 'next', PageDown: radio && 'next',
    ArrowLeft: radio && 'prev', ArrowUp: radio && 'prev', PageUp: radio && 'prev',
    Home: radio && 'first', End: radio && 'last',
    Escape: inShow && 'exit',
  };
  const action = map[e.key];
  if (!action) return;
  e.preventDefault();
  v.nav(action);
}, true);

// ---------------------------------------------------------------- state

v.onState((s) => {
  const fileChanged = s.path !== cur.path;
  const totalChanged = s.total !== cur.total;
  cur = s;
  const has = !!s.file;
  body.classList.toggle('has-deck', has);
  $('file').textContent = s.file || '';
  $('file').title = s.path || '';
  for (const id of ['prev', 'next', 'play', 'playMenu', 'agentBtn']) $(id).disabled = !has;
  if (has && s.total) {
    $('counter').textContent = `${s.index + 1} / ${s.total}`;
    $('prev').disabled = s.index <= 0;
    $('next').disabled = s.index >= s.total - 1;
  } else {
    $('counter').textContent = '';
  }
  if (fileChanged || totalChanged) buildThumbs(fileChanged);
  markActive();
  updateTermTitle();
});

// ---------------------------------------------------------------- drawer

let thumbGen = 0;

function setDrawer(open) {
  body.classList.toggle('drawer-open', open);
  $('drawerBtn').classList.toggle('on', open);
  store.set('drawer', open);
  v.drawer(open);
  if (open) requestAnimationFrame(() => markActive(true));
}

function buildThumbs(clear) {
  const list = $('thumbs');
  const old = clear ? [] : [...list.querySelectorAll('.thumb img')].map((i) => i.src);
  list.textContent = '';
  $('drawerCount').textContent = cur.total ? cur.total : '';
  if (!cur.file) return;
  if (!cur.total) {
    list.innerHTML = '<div class="drawer-empty">This file isn\'t a PPTD slide deck, so there are no slides to show.</div>';
    return;
  }
  for (let i = 0; i < cur.total; i++) {
    const item = document.createElement('div');
    item.className = 'thumb';
    item.dataset.index = i;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `Slide ${i + 1}`);
    item.innerHTML = `<span class="num">${i + 1}</span><div class="pic"></div>`;
    if (old[i]) { const img = new Image(); img.alt = ''; img.src = old[i]; item.querySelector('.pic').appendChild(img); }
    list.appendChild(item);
  }
}

v.onThumb(({ gen, index, total, dataUrl }) => {
  if (gen < thumbGen) return;
  thumbGen = gen;
  if (total !== cur.total) return;
  const pic = $('thumbs').querySelector(`.thumb[data-index="${index}"] .pic`);
  if (!pic) return;
  let img = pic.querySelector('img');
  if (!img) { img = new Image(); img.alt = ''; pic.appendChild(img); }
  img.src = dataUrl;
});

function markActive(scroll = true) {
  const list = $('thumbs');
  list.querySelectorAll('.thumb.active').forEach((t) => t.classList.remove('active'));
  const el = list.querySelector(`.thumb[data-index="${cur.index}"]`);
  if (!el) return;
  el.classList.add('active');
  if (scroll && body.classList.contains('drawer-open')) el.scrollIntoView({ block: 'nearest' });
}

$('thumbs').addEventListener('click', (e) => {
  const t = e.target.closest('.thumb');
  if (t) v.nav(Number(t.dataset.index), { focus: true });
});

// ---------------------------------------------------------------- terminal

let term = null, fit = null, live = false, started = false;

function ensureTerm() {
  if (term) return;
  term = new Terminal({
    fontFamily: '"SF Mono", Menlo, Monaco, monospace',
    fontSize: 13,
    lineHeight: 1.15,
    cursorBlink: true,
    macOptionIsMeta: true,
    scrollback: 10000,
    allowProposedApi: false,
    theme: {
      background: '#131416', foreground: '#e6e7ea', cursor: '#14a19e', cursorAccent: '#131416',
      selectionBackground: 'rgba(20,161,158,.35)',
      black: '#1d1f22', red: '#ff6b6b', green: '#3fb950', yellow: '#e3b341', blue: '#58a6ff', magenta: '#d2a8ff', cyan: '#39c5cf', white: '#c9d1d9',
      brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364', brightYellow: '#f2cc60', brightBlue: '#79c0ff', brightMagenta: '#e2c5ff', brightCyan: '#56d4dd', brightWhite: '#f0f6fc',
    },
  });
  fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open($('xterm'));
  term.onData((d) => { if (live) v.ptyInput(d); });
  term.onResize(({ cols, rows }) => v.ptyResize(cols, rows));
  new ResizeObserver(() => { if (body.classList.contains('term-open')) safeFit(); }).observe($('xterm'));
}

function safeFit() { try { fit.fit(); } catch {} }
const size = () => ({ cols: term.cols, rows: term.rows });

function toggleAgent(force) {
  const open = force ?? !body.classList.contains('term-open');
  if (open && !cur.file) return;
  body.classList.toggle('term-open', open);
  $('agentBtn').classList.toggle('on', open);
  requestAnimationFrame(() => {
    reportStage();
    if (!open) { v.focusDeck(); return; }
    ensureTerm();
    safeFit();
    if (!started) { started = true; v.agentStart(size()); }
    term.focus();
  });
}

v.onPtyStart(() => { live = true; updateTermTitle(); });
v.onPtyData((d) => term?.write(d));
v.onPtyExit((e) => {
  live = false;
  if (!e?.notFound) term?.write(`\r\n\x1b[2m[session ended${e?.exitCode ? `, exit code ${e.exitCode}` : ''}; press Restart for a new one]\x1b[0m\r\n`);
  updateTermTitle();
});

$('hide').addEventListener('click', () => toggleAgent(false));
$('stop').addEventListener('click', () => v.agentStop());
$('restart').addEventListener('click', () => {
  ensureTerm();
  term.reset();
  started = true;
  v.agentRestart(size());
  term.focus();
});

function updateTermTitle() {
  $('dot').classList.toggle('live', live);
  $('stop').disabled = !live;
  const deck = cur.file ? escapeHtml(cur.file) : 'no deck';
  const slide = cur.total ? `<span class="slide-pill">slide ${cur.index + 1} of ${cur.total}</span>` : '';
  $('termTitle').innerHTML = live
    ? `<strong>Claude</strong> · editing ${deck}${slide}`
    : `Agent · ${started ? 'stopped' : 'not started'}`;
  $('termTitle').title = live ? 'Requests that don\'t name a slide apply to the slide on screen.' : '';
}
const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Resize the terminal by dragging the divider.
(() => {
  const div = $('divider');
  let startY = 0, startH = 0;
  const setH = (h) => {
    const max = Math.max(160, window.innerHeight - 46 - 160);
    h = Math.min(max, Math.max(120, h));
    document.documentElement.style.setProperty('--term-h', `${h}px`);
    return h;
  };
  setH(store.get('termH', 300));
  div.addEventListener('pointerdown', (e) => {
    startY = e.clientY; startH = $('term').getBoundingClientRect().height;
    div.setPointerCapture(e.pointerId); div.classList.add('dragging');
  });
  div.addEventListener('pointermove', (e) => {
    if (!div.hasPointerCapture(e.pointerId)) return;
    setH(startH + (startY - e.clientY));
  });
  div.addEventListener('pointerup', (e) => {
    div.releasePointerCapture(e.pointerId); div.classList.remove('dragging');
    store.set('termH', $('term').getBoundingClientRect().height);
  });
})();

// ---------------------------------------------------------------- drag and drop

// Over a thumbnail: add to that slide. Over the terminal: paste the paths.
// Anywhere else in the chrome: .html opens, media goes on the current slide.
// (Drops on the deck itself are handled inside the deck.)
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
let dropThumb = null;
function setDropThumb(t) {
  if (dropThumb === t) return;
  dropThumb?.classList.remove('dropping');
  dropThumb = t;
  dropThumb?.classList.add('dropping');
}
document.addEventListener('dragenter', (e) => { if (hasFiles(e)) e.preventDefault(); });
document.addEventListener('dragover', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  body.classList.add('dragging');
  setDropThumb(e.target.closest?.('.thumb') || null);
});
document.addEventListener('dragleave', (e) => {
  if (!e.relatedTarget) { body.classList.remove('dragging'); setDropThumb(null); }
});
document.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  body.classList.remove('dragging');
  const thumb = e.target.closest?.('.thumb');
  setDropThumb(null);
  const paths = [...e.dataTransfer.files].map((f) => v.pathForFile(f)).filter(Boolean);
  if (!paths.length) return;
  if (e.target.closest?.('#term') && live) {
    const quoted = paths.map((p) => `'${p.replace(/'/g, `'\\''`)}'`).join(' ');
    v.ptyInput(quoted + ' ');
    term?.focus();
    return;
  }
  v.dropPaths(paths, thumb ? Number(thumb.dataset.index) : undefined);
});

// ---------------------------------------------------------------- restore layout

if (store.get('drawer', true)) setDrawer(true); else v.drawer(false);
updateTermTitle();
reportStage();
