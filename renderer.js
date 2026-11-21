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
$('splashOpen').addEventListener('click', () => v.open());
$('splashNew').addEventListener('click', () => toggleAgent(true));
$('prev').addEventListener('click', () => v.nav('prev'));
$('next').addEventListener('click', () => v.nav('next'));
$('play').addEventListener('click', () => v.slideshow('default'));
$('playMenu').addEventListener('click', (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  v.slideshowMenu(r.left, r.bottom + 4);
});
$('drawerBtn').addEventListener('click', () => setDrawer(!body.classList.contains('drawer-open')));
$('agentBtn').addEventListener('click', () => toggleAgent());

// ---------------------------------------------------------------- new version

// Main sends { version, current } when a newer release is out, null to hide the banner.
// Showing or hiding it resizes #stage, and the ResizeObserver moves the deck view.
v.onUpdate((u) => {
  const bar = $('update');
  if (!u) { bar.hidden = true; bar.classList.remove('in'); return; }
  const fresh = bar.hidden || bar.dataset.version !== u.version;
  $('updateTitle').textContent = `PPTD ${u.version} is available`;
  $('updateHave').textContent = `You have ${u.current}.`;
  bar.dataset.version = u.version;
  bar.hidden = false;
  if (fresh) { bar.classList.remove('in'); void bar.offsetWidth; bar.classList.add('in'); }
});
for (const [id, action] of [['updateDownload', 'download'], ['updateNotes', 'notes'], ['updateLater', 'later'], ['updateSkip', 'skip']]) {
  $(id).addEventListener('click', () => v.updateAction(action));
}

v.onToggle((what) => {
  if (what === 'drawer') setDrawer(!body.classList.contains('drawer-open'));
  else if (what === 'prompts') { setTab('prompts'); setDrawer(true); }
  else if (what === 'agent-open') toggleAgent(true);   // open (or just focus) the agent
  else toggleAgent();
});

// Keys while focus is in the chrome (not the terminal; the deck has its own preload).
window.addEventListener('keydown', (e) => {
  if (!cur.file || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest?.('#term')) return;            // typing goes to the agent
  const typing = e.target.matches?.('input, textarea, select') || e.target.isContentEditable;
  if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && body.classList.contains('drawer-open') && !body.classList.contains('drawer-prompts') && cur.total > 1) {
    e.preventDefault();
    v.deleteSlide(cur.index);
    return;
  }
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
  for (const id of ['prev', 'next', 'play', 'playMenu']) $(id).disabled = !has;
  $('play').title = `Slideshow, ${s.slideshowMode === 'window' ? 'in window' : 'full screen'} (⌘↩)`;
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

// The agent is running a prompt; with no deck open, building.js animates the stage.
v.onAgentBusy((on) => body.classList.toggle('agent-busy', !!on));

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
    item.draggable = true;
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
  if (t) v.nav(Number(t.dataset.index));
});

// Reorder by dragging a slide in the drawer. Slide drags carry their own type, so the
// file-drop handlers below ignore them (they only act on 'Files').
const SLIDE_TYPE = 'application/x-pptd-slide';
let moving = null; // index of the slide being dragged
let insertAt = null; // gap it would land in: 0 = before the first slide, total = after the last

function clearInsert() {
  $('thumbs').querySelectorAll('.insert-before, .insert-after').forEach((t) => t.classList.remove('insert-before', 'insert-after'));
}
function showInsert(gap) {
  clearInsert();
  insertAt = gap;
  const thumbs = $('thumbs').querySelectorAll('.thumb');
  // No line where the slide already is (dropping there changes nothing).
  if (gap == null || gap === moving || gap === moving + 1) return;
  if (gap < thumbs.length) thumbs[gap].classList.add('insert-before');
  else thumbs[thumbs.length - 1]?.classList.add('insert-after');
}
// Which gap the pointer is nearest: above or below the middle of the thumb under it.
function gapAt(e) {
  const thumbs = [...$('thumbs').querySelectorAll('.thumb')];
  for (let i = 0; i < thumbs.length; i++) {
    const r = thumbs[i].getBoundingClientRect();
    if (e.clientY < r.top + r.height / 2) return i;
  }
  return thumbs.length;
}

$('thumbs').addEventListener('dragstart', (e) => {
  const t = e.target.closest?.('.thumb');
  if (!t) return;
  moving = Number(t.dataset.index);
  e.dataTransfer.setData(SLIDE_TYPE, String(moving));
  e.dataTransfer.effectAllowed = 'move';
  t.classList.add('moving');
});
$('thumbs').addEventListener('dragover', (e) => {
  if (moving == null || ![...e.dataTransfer.types].includes(SLIDE_TYPE)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  showInsert(gapAt(e));
});
$('thumbs').addEventListener('drop', (e) => {
  if (moving == null || ![...e.dataTransfer.types].includes(SLIDE_TYPE)) return;
  e.preventDefault();
  const from = moving, gap = gapAt(e);
  const to = gap > from ? gap - 1 : gap;
  if (to !== from) v.moveSlide(from, to);
});
$('thumbs').addEventListener('dragend', () => {
  $('thumbs').querySelector('.thumb.moving')?.classList.remove('moving');
  clearInsert();
  moving = insertAt = null;
});
$('thumbs').addEventListener('dragleave', (e) => { if (!$('thumbs').contains(e.relatedTarget)) clearInsert(); });

// ---------------------------------------------------------------- prompt history (drawer tab)

// Main sends the deck's prompt rows (lib/history.js) whenever the deck loads or reloads.
let prompts = { deck: false, pptd: false, saving: false, start: null, rows: [] };
const openPrompts = new Set();   // ids whose full text is shown

function setTab(tab) {
  const p = tab === 'prompts';
  body.classList.toggle('drawer-prompts', p);
  $('prompts').hidden = !p;
  $('tabSlides').classList.toggle('on', !p);
  $('tabPrompts').classList.toggle('on', p);
  $('tabSlides').setAttribute('aria-selected', String(!p));
  $('tabPrompts').setAttribute('aria-selected', String(p));
  store.set('drawerTab', tab);
  if (p) requestAnimationFrame(scrollPromptsToCurrent);
  else requestAnimationFrame(() => markActive(true));
}
$('tabSlides').addEventListener('click', () => setTab('slides'));
$('tabPrompts').addEventListener('click', () => setTab('prompts'));

function when(iso) {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '';
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }) });
}

function promptRow(r) {
  const el = document.createElement('div');
  el.className = `prompt${r.kind === 'revert' ? ' reverted' : ''}${r.kind === 'start' ? ' start' : ''}${r.current ? ' current' : ''}${r.live ? '' : ' dim'}${openPrompts.has(r.id) ? ' open' : ''}`;
  el.dataset.id = r.id;
  const num = document.createElement('span');
  num.className = 'num';
  num.textContent = r.n ?? (r.kind === 'revert' ? '↺' : '');
  const text = document.createElement('div');
  text.className = 'ptext';
  text.textContent = r.text;
  text.title = r.kind === 'prompt' ? 'Click to show it all' : '';
  const meta = document.createElement('div');
  meta.className = 'pmeta';
  meta.textContent = [r.at && when(r.at), r.outcome && 'stopped early', r.kind === 'prompt' && !r.live && 'reverted'].filter(Boolean).join(' · ');
  el.append(num, text);
  if (r.canRevert && !r.current) {
    const b = document.createElement('button');
    b.className = 'revert';
    b.textContent = '↺';
    b.title = r.kind === 'start' ? 'Revert the deck to before the first prompt' : `Revert the deck to how it was after prompt ${r.n}`;
    b.setAttribute('aria-label', b.title);
    el.append(b);
  }
  el.append(meta);
  return el;
}

function renderPrompts() {
  const list = $('prompts');
  list.textContent = '';
  const count = prompts.rows.filter((r) => r.kind === 'prompt').length;
  $('promptCount').textContent = count || '';
  const note = (text) => { const n = document.createElement('div'); n.className = 'prompts-note'; n.textContent = text; list.append(n); };
  if (!cur.file) return;
  if (!prompts.pptd) return note('This file isn\'t a PPTD slide deck, so it has no prompt history.');
  if (!prompts.saving) note('Prompts aren\'t being saved. Turn on View › Save Prompts in Decks to keep each prompt that changes this deck, with a way back to it. The prompts are stored in the file, so anyone you send it to can read them.');
  if (prompts.start) list.append(promptRow(prompts.start));
  for (const r of prompts.rows) list.append(promptRow(r));
  if (!count && prompts.saving) note('No prompts yet. When the agent finishes a change to this deck, your prompt appears here.');
}

function scrollPromptsToCurrent() {
  const list = $('prompts');
  const el = list.querySelector('.prompt.current') || list.lastElementChild;
  el?.scrollIntoView({ block: 'nearest' });
}

v.onPrompts((p) => {
  const was = prompts.rows.length;
  prompts = { ...prompts, ...p, rows: p.rows || [] };
  renderPrompts();
  if (prompts.rows.length !== was && !$('prompts').hidden) scrollPromptsToCurrent();
});

$('prompts').addEventListener('click', (e) => {
  const row = e.target.closest('.prompt');
  if (!row) return;
  if (e.target.closest('.revert')) return v.revertPrompt(row.dataset.id);
  if (!e.target.closest('.ptext') || window.getSelection()?.toString()) return;
  row.classList.toggle('open');
  if (row.classList.contains('open')) openPrompts.add(row.dataset.id); else openPrompts.delete(row.dataset.id);
});

// ---------------------------------------------------------------- terminal

let term = null, fit = null, live = false, started = false;
// Keys typed while an agent session is starting are kept and sent once it is live.
let starting = false, earlyInput = '';

// Terminal colours for the app's appearance (View › Appearance). Background matches --term-bg.
const TERM_THEMES = {
  dark: {
    background: '#131416', foreground: '#e6e7ea', cursor: '#14a19e', cursorAccent: '#131416',
    selectionBackground: 'rgba(20,161,158,.35)',
    black: '#1d1f22', red: '#ff6b6b', green: '#3fb950', yellow: '#e3b341', blue: '#58a6ff', magenta: '#d2a8ff', cyan: '#39c5cf', white: '#c9d1d9',
    brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364', brightYellow: '#f2cc60', brightBlue: '#79c0ff', brightMagenta: '#e2c5ff', brightCyan: '#56d4dd', brightWhite: '#f0f6fc',
  },
  light: {
    background: '#fbfbfc', foreground: '#1f2328', cursor: '#0e8c89', cursorAccent: '#fbfbfc',
    selectionBackground: 'rgba(20,161,158,.25)',
    black: '#24292f', red: '#cf222e', green: '#116329', yellow: '#7d4e00', blue: '#0969da', magenta: '#8250df', cyan: '#1b7c83', white: '#6e7781',
    brightBlack: '#57606a', brightRed: '#a40e26', brightGreen: '#1a7f37', brightYellow: '#633c01', brightBlue: '#218bff', brightMagenta: '#a475f9', brightCyan: '#3192aa', brightWhite: '#8c959f',
  },
};
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const termTheme = () => TERM_THEMES[darkQuery.matches ? 'dark' : 'light'];
// pi asks for light/dark change reports (mode 2031) and re-reads the terminal's colours when
// one comes; xterm.js doesn't send them itself, so watch for the mode and send the report.
let schemeReports = false;
darkQuery.addEventListener('change', () => {
  if (!term) return;
  term.options.theme = termTheme();
  if (live && schemeReports) v.ptyInput(darkQuery.matches ? '\x1b[?997;1n' : '\x1b[?997;2n');
});

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
    theme: termTheme(),
  });
  fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open($('xterm'));
  // xterm.js sends a bare \r for Shift+Enter and speaks neither the Kitty keyboard protocol
  // nor modifyOtherKeys, so pi can't tell it from Enter. Send a sequence each agent reads as
  // "insert newline": CSI-u Shift+Enter for pi, ESC CR (Option+Enter) for Claude Code.
  term.attachCustomKeyEventHandler((e) => {
    if (e.key !== 'Enter' || !e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return true;
    if (e.type === 'keydown' && live) v.ptyInput(agentName === 'Pi' ? '\x1b[13;2u' : '\x1b\r');
    return false;
  });
  term.onData((d) => {
    if (live) v.ptyInput(d);
    else if (starting) earlyInput += d;
  });
  term.onResize(({ cols, rows }) => v.ptyResize(cols, rows));
  new ResizeObserver(() => { if (body.classList.contains('term-open')) safeFit(); }).observe($('xterm'));
}

function safeFit() { try { fit.fit(); } catch {} }
const size = () => ({ cols: term.cols, rows: term.rows });

function toggleAgent(force) {
  const open = force ?? !body.classList.contains('term-open');
  body.classList.toggle('term-open', open);
  $('agentBtn').classList.toggle('on', open);
  requestAnimationFrame(() => {
    reportStage();
    if (!open) { v.focusDeck(); return; }
    ensureTerm();
    safeFit();
    if (!started) { started = true; starting = true; earlyInput = ''; v.agentStart(size()); }
    // The deck is a separate view that usually holds keyboard focus; take it back so you can
    // type to the agent straight after ⌘J.
    v.focusUi();
    term.focus();
  });
}

v.onPtyStart((e) => {
  starting = false;
  live = true; agentName = e?.agent || 'Agent'; updateTermTitle();
  // Keys typed while the agent was starting (straight after ⌘J) go to it now.
  if (earlyInput) { v.ptyInput(earlyInput); earlyInput = ''; }
});
v.onPtyData((d) => {
  const i = Math.max(d.lastIndexOf('\x1b[?2031h'), d.lastIndexOf('\x1b[?2031l'));
  if (i >= 0) schemeReports = d[i + 7] === 'h';
  term?.write(d);
});
v.onPtyExit((e) => {
  live = false; schemeReports = false;
  starting = false; earlyInput = '';
  if (!e?.notFound) term?.write(`\r\n\x1b[2m[session ended${e?.exitCode ? `, exit code ${e.exitCode}` : ''}; press Restart for a new one]\x1b[0m\r\n`);
  updateTermTitle();
});

$('hide').addEventListener('click', () => toggleAgent(false));
$('stop').addEventListener('click', () => v.agentStop());
$('restart').addEventListener('click', () => {
  ensureTerm();
  term.reset();
  started = true;
  starting = true; earlyInput = '';
  v.agentRestart(size());
  term.focus();
});

let agentName = 'Agent';
function updateTermTitle() {
  $('dot').classList.toggle('live', live);
  $('stop').disabled = !live;
  const doing = cur.file ? `editing ${escapeHtml(cur.file)}` : 'ask for a new presentation';
  const slide = cur.total ? `<span class="slide-pill">slide ${cur.index + 1} of ${cur.total}</span>` : '';
  $('termTitle').innerHTML = live
    ? `<strong>${escapeHtml(agentName)}</strong> · ${doing}${slide}`
    : !$('login').hidden ? 'Agent · sign in to start' : `Agent · ${started ? 'stopped' : 'not started'}`;
  $('termTitle').title = live ? 'Requests that don\'t name a slide apply to the slide on screen.' : '';
}
const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------- model sign-in (pi)

// Shown in the agent pane (the deck view covers the stage, never this pane) when pi has
// no model to use, or from View › Agent. Main runs the sign-in; this only asks and shows.
const login = { providers: {}, starting: false, url: null, provider: null };
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  for (const k of kids) if (k != null) n.append(k);
  return n;
};
const loginBox = () => $('loginBox');

function setLoginOpen(open) {
  $('login').hidden = !open;
  if (open) {
    starting = false; earlyInput = ''; // the sign-in panel takes the keys now
    v.focusUi();
    body.classList.add('term-open');
    $('agentBtn').classList.add('on');
    requestAnimationFrame(reportStage);
  }
  updateTermTitle();
}

function loginChoices() {
  const p = login.providers;
  const choice = (title, sub, signedIn, onClick, primary) => {
    const b = el('button', { className: `login-choice${primary ? ' primary' : ''}`, type: 'button' },
      el('strong', { textContent: title }),
      el('span', { textContent: sub }),
      signedIn ? el('span', { className: 'ok', textContent: '✓ Signed in' }) : null);
    b.addEventListener('click', onClick);
    return b;
  };
  const box = loginBox();
  box.replaceChildren(
    el('h2', { textContent: 'Choose the AI model for Pi' }),
    el('p', { className: 'hint', textContent: 'Pi is the agent that builds and edits your slides. Sign in once; it remembers.' }),
    el('div', { className: 'login-choices' },
      choice('Sign in with ChatGPT', 'ChatGPT Plus or Pro', p['openai-codex'], () => beginOAuth('openai-codex', 'ChatGPT'), true),
      choice('Sign in with Claude', 'Claude Pro or Max', p.anthropic, () => beginOAuth('anthropic', 'Claude')),
      choice('Use an Anthropic API key', 'Pay as you go, from the Anthropic console', false, loginKeyForm)),
    loginFooter(),
  );
  box.querySelector('button')?.focus();
}

function loginFooter() {
  const row = el('div', { className: 'login-row end' });
  if (login.starting) {
    const claude = el('button', { type: 'button', textContent: 'Use Claude Code instead', title: 'Run your installed Claude Code as the agent' });
    claude.addEventListener('click', () => v.loginUseClaude());
    row.append(claude);
  }
  const close = el('button', { type: 'button', textContent: login.starting ? 'Not now' : 'Close' });
  close.addEventListener('click', closeLogin);
  row.append(close);
  return row;
}

function closeLogin() {
  v.loginCancel();
  setLoginOpen(false);
  if (login.starting) {
    ensureTerm();
    safeFit();
    term.write('\x1b[2mPi needs an AI model to work with. Press Restart to sign in, or choose Claude Code in View › Agent.\x1b[0m\r\n');
  }
}

function loginKeyForm() {
  const input = el('input', { type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off', spellcheck: false, 'aria-label': 'Anthropic API key' });
  const save = el('button', { className: 'go', type: 'button', textContent: 'Save key' });
  const back = el('button', { type: 'button', textContent: 'Back' });
  const get = el('button', { className: 'link', type: 'button', textContent: 'Get a key' });
  const submit = () => {
    const key = input.value.trim();
    if (!key) { input.focus(); return; }
    login.provider = 'Claude';
    loginWaiting('Saving your key…', false);
    v.loginStart({ provider: 'anthropic', method: 'api_key', key });
  };
  save.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  back.addEventListener('click', loginChoices);
  get.addEventListener('click', () => v.openLink('https://console.anthropic.com/settings/keys'));
  loginBox().replaceChildren(
    el('h2', { textContent: 'Anthropic API key' }),
    el('p', { className: 'hint' }, 'Paste a key from the Anthropic console (', get, '). Pi keeps it in ~/.pi/agent on this computer.'),
    el('div', { className: 'login-row' }, input, save, back),
  );
  input.focus();
}

function beginOAuth(provider, name) {
  login.provider = name;
  login.url = null;
  loginWaiting(`Finish signing in to ${name} in your browser…`, true);
  v.loginStart({ provider, method: 'oauth' });
}

function loginWaiting(text, browser) {
  const cancel = el('button', { type: 'button', textContent: 'Cancel' });
  cancel.addEventListener('click', () => { v.loginCancel(); loginChoices(); });
  const row = el('div', { className: 'login-row' });
  if (browser) {
    const again = el('button', { type: 'button', textContent: 'Open the sign-in page again', id: 'loginAgain', disabled: true });
    again.addEventListener('click', () => { if (login.url) v.loginOpenUrl(); });
    row.append(again);
  }
  row.append(cancel);
  loginBox().replaceChildren(
    el('h2', {}, el('span', { className: 'spinner' }), text),
    el('p', { className: 'hint', id: 'loginMsg', textContent: browser ? 'A browser window opens for you to sign in. Come back here when it says you are done.' : '' }),
    el('div', { id: 'loginPrompt' }),
    row,
  );
}

function loginPrompt({ id, kind, message, placeholder }) {
  const slot = $('loginPrompt');
  if (!slot) return;
  const input = el('input', { type: kind === 'secret' ? 'password' : 'text', placeholder: placeholder || '', spellcheck: false, autocomplete: 'off' });
  const go = el('button', { type: 'button', textContent: 'Continue' });
  const submit = () => { const val = input.value.trim(); if (val) { v.loginAnswer(id, val); slot.replaceChildren(el('p', { className: 'note', textContent: 'Checking…' })); } };
  go.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  slot.dataset.id = id;
  slot.replaceChildren(
    el('p', { className: 'note', textContent: /browser/i.test(message) ? 'Browser didn’t come back here? Paste the code, or the address the browser ended on:' : message }),
    el('div', { className: 'login-row' }, input, go),
  );
}

function loginError(text) {
  const again = el('button', { className: 'go', type: 'button', textContent: 'Try again' });
  again.addEventListener('click', loginChoices);
  loginBox().replaceChildren(
    el('h2', { textContent: `Couldn’t sign in${login.provider ? ` to ${login.provider}` : ''}` }),
    el('p', { className: 'hint err', textContent: text || 'Sign-in failed.' }),
    el('div', { className: 'login-row' }, again, loginFooter()),
  );
}

v.onLoginShow(({ providers, starting }) => {
  login.providers = providers || {};
  login.starting = !!starting;
  if (starting) started = true;
  setLoginOpen(true);
  loginChoices();
});
v.onLoginEvent((e) => {
  if (!e || $('login').hidden) return;
  if (e.type === 'auth_url') { login.url = e.url; const b = $('loginAgain'); if (b) b.disabled = false; }
  else if (e.type === 'device_code') { const m = $('loginMsg'); if (m) m.textContent = `Enter the code ${e.userCode} on the page that opened.`; }
  else if (e.type === 'info' || e.type === 'progress') { const m = $('loginMsg'); if (m && e.message) m.textContent = e.message; }
  else if (e.type === 'prompt') loginPrompt(e);
  else if (e.type === 'prompt_closed') { const slot = $('loginPrompt'); if (slot?.dataset.id === e.id) slot.replaceChildren(); }
  else if (e.type === 'error') loginError(e.error);
});
v.onLoginHide(() => {
  setLoginOpen(false);
  if (body.classList.contains('term-open')) { ensureTerm(); safeFit(); v.focusUi(); term.focus(); }
});

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

setTab(store.get('drawerTab', 'slides') === 'prompts' ? 'prompts' : 'slides');
if (store.get('drawer', true)) setDrawer(true); else v.drawer(false);
updateTermTitle();
reportStage();
