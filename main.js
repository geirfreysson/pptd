// PPTD ("PowerPoint is dead") — main process.
//
// Window layout:
//   BrowserWindow    index.html: toolbar, slide drawer (left), agent terminal (bottom)
//   WebContentsView  the deck, placed over the "#stage" rectangle reported by index.html
//
// Each window is independent: its own deck, slideshow mode, thumbnails, undo stack and
// agent session. That state lives in a per-window object `w` (see newWindowState).
//
// Modes:
//   "normal"     toolbar + drawer + terminal visible, deck in the stage
//   "window"     slideshow filling the current window
//   "fullscreen" slideshow in native full screen
//
// PPTD decks (docs/pptd-spec.md) switch slides with hidden radio inputs. We hide
// their in-page ‹ › controls and drive the radios ourselves. Other HTML files
// still load; navigation then falls back to sending arrow keys to the page.

const { app, BrowserWindow, WebContentsView, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const media = require('./lib/media');
// Structural deck edits (also the agents' command-line tool); an ES module, loaded on use.
// Packaged, it is unpacked next to app.asar (asarUnpack), so it loads as a plain file.
const deckOps = () => import(require('url').pathToFileURL(
  path.join(__dirname, 'tools', 'pptd-deck.mjs').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`)).href);
const { createThumbs } = require('./lib/thumbs');
const { AgentSession, AGENTS } = require('./lib/agent');
const piLogin = require('./lib/pi-login');
const brand = require('./lib/brand');

const TOOLBAR_HEIGHT = 46;

const HIDE_CONTROLS_CSS = `.controls { display: none !important; }`;
// Centre the 16:9 deck in whatever space it gets. Dark grey while editing, black in a show.
const frameCss = (bg) => `
  html, body { background: ${bg} !important; }
  body { place-items: center !important; }
  .deck { box-shadow: ${bg === '#000' ? 'none' : '0 6px 28px rgba(0,0,0,.45)'} !important; }
`;
const EDIT_BG = '#17181b';
const EMPTY_STATE = () => ({ index: 0, total: 0, label: null });

const windows = new Set();       // every open window's state object
const byContents = new Map();    // webContents id (app UI or deck view) -> window state
let lastFocused = null;          // menu actions apply to this window
let pendingFile = null;          // file passed before the first window existed
let quitting = false;            // set by before-quit; no more dialogs after that

// The window menu actions and app-level events (Finder, CLI) act on.
const current = () => {
  const f = BrowserWindow.getFocusedWindow();
  const w = f && byContents.get(f.webContents.id);
  return w || (lastFocused && windows.has(lastFocused) ? lastFocused : [...windows].at(-1)) || null;
};
const fromSender = (e) => byContents.get(e.sender.id) || null;

// ---------------------------------------------------------------- window

function newWindowState() {
  return {
    win: null,
    deckView: null,
    thumbs: createThumbs(),
    currentFile: null,
    pendingFile: null,           // file to open once index.html has loaded
    mode: 'normal',
    isRadioDeck: false,
    frameCssKey: null,
    state: EMPTY_STATE(),
    restoreIndex: null,          // slide to return to after a reload
    stageRect: null,             // where index.html wants the deck (normal mode)
    watcher: null,
    reloadTimer: null,
    settleTimer: null,
    drawerOpen: false,
    thumbsStale: true,
    undoStack: [],
    agent: null,
    restartAgent: null,          // {cols, rows} when a restart is pending
    eventsWatcher: null,
    eventsOffset: 0,
    cwdWatcher: null,
    cwdTimers: new Map(),
  };
}

function createWindow(file = null) {
  const w = newWindowState();
  w.pendingFile = file;

  // New windows cascade from the one in front instead of stacking exactly on top of it.
  const from = current()?.win;
  const offset = from && !from.isFullScreen() ? (() => { const [x, y] = from.getPosition(); return { x: x + 24, y: y + 24 }; })() : {};

  const win = w.win = new BrowserWindow({
    width: 1440,
    height: 900,
    ...offset,
    minWidth: 760,
    minHeight: 480,
    backgroundColor: '#1e1f22',
    title: 'PPTD',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  const deckView = w.deckView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'deck-preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  deckView.setBackgroundColor(EDIT_BG);
  deckView.setVisible(false);
  win.contentView.addChildView(deckView);

  const wc = deckView.webContents;
  const ids = [win.webContents.id, wc.id];
  for (const id of ids) byContents.set(id, w);
  windows.add(w);
  lastFocused = w;

  // Decks are local files: never open new windows, send web links to the browser.
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (event, url) => {
    // Block everything, including a file dropped outside the preload's reach.
    event.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });

  wc.on('dom-ready', async () => {
    // A PPTD deck has a <meta name="pptd"> marker and/or slide radios.
    w.isRadioDeck = await wc.executeJavaScript(
      `!!document.querySelector('meta[name=pptd], input.slide-radio, input[type=radio][name=slide]')`);
    if (w.isRadioDeck) {
      await wc.insertCSS(HIDE_CONTROLS_CSS);
      w.frameCssKey = await wc.insertCSS(frameCss(w.mode === 'normal' ? EDIT_BG : '#000'));
    } else {
      w.frameCssKey = null;
    }
    wc.send('mode', w.mode);
    if (w.restoreIndex != null && w.isRadioDeck) {
      const i = w.restoreIndex; w.restoreIndex = null;
      await navigate(w, i, { focus: false });
    } else {
      w.restoreIndex = null;
      await refreshState(w);
    }
    w.thumbsStale = true;
    if (w.drawerOpen) updateThumbs(w);
  });

  win.on('focus', () => { lastFocused = w; buildMenu(); });
  win.on('resize', () => layout(w));
  win.on('enter-full-screen', () => layout(w));
  win.on('leave-full-screen', () => {
    // User left full screen another way (green button, Ctrl+Cmd+F): end the show.
    if (w.mode === 'fullscreen') setMode(w, 'normal');
    layout(w);
    settleLayout(w);
  });
  // Closing the window yourself asks first. A quit already under way (⌘Q after
  // confirming, logout, `kill`) never waits on a dialog.
  win.on('close', (e) => {
    if (quitting || !w.agent?.alive) return;
    if (!confirmEndSession(w, 'Close')) e.preventDefault();
  });
  win.on('closed', () => {
    disposeWindow(w);
    for (const id of ids) byContents.delete(id);
    windows.delete(w);
    if (lastFocused === w) lastFocused = null;
    buildMenu();
  });

  win.webContents.once('did-finish-load', () => {
    sendState(w);
    if (w.pendingFile) { const f = w.pendingFile; w.pendingFile = null; openFile(w, f); }
  });

  layout(w);
  buildMenu();
  return w;
}

function disposeWindow(w) {
  w.win = null;
  w.deckView = null;
  w.thumbs.dispose();
  unwatch(w);
  clearTimeout(w.settleTimer);
  w.eventsWatcher?.close();
  w.cwdWatcher?.close();
  for (const t of w.cwdTimers.values()) clearTimeout(t);
  w.login?.cancel();
  if (w.agent) {
    w.agent.stop();
    removeAgentFiles(w.agent);
  }
}

function layout(w) {
  const { win, deckView } = w;
  if (!win || !deckView) return;
  const [width, height] = win.getContentSize();
  if (w.mode !== 'normal') { deckView.setBounds({ x: 0, y: 0, width, height }); return; }
  const r = w.stageRect || { x: 0, y: TOOLBAR_HEIGHT, width, height: height - TOOLBAR_HEIGHT };
  deckView.setBounds({
    x: Math.round(r.x), y: Math.round(r.y),
    width: Math.max(0, Math.round(r.width)), height: Math.max(0, Math.round(r.height)),
  });
}

// Bounds set while macOS animates out of full screen can leave the page at its old
// size. Re-apply them once the window has settled, with a 1px nudge so the page resizes.
function settleLayout(w) {
  clearTimeout(w.settleTimer);
  w.settleTimer = setTimeout(() => {
    if (!w.deckView) return;
    layout(w);
    const b = w.deckView.getBounds();
    w.deckView.setBounds({ ...b, width: Math.max(0, b.width - 1) });
    w.deckView.setBounds(b);
  }, 120);
}

const send = (w, channel, payload) => { if (w?.win && !w.win.isDestroyed()) w.win.webContents.send(channel, payload); };
const toast = (w, text, kind = 'info') => send(w, 'toast', { text, kind });

// ---------------------------------------------------------------- files

// "Q3 review.pptd.html" -> "Q3 review"
const displayName = (file) => path.basename(file).replace(/(\.pptd)?\.html?$/i, '');

const windowShowing = (file) => [...windows].find((w) => w.currentFile === file) || null;

function focusWindow(w) {
  if (!w?.win) return;
  if (w.win.isMinimized()) w.win.restore();
  w.win.show();
  w.win.focus();
}

// A file from Finder, the command line or the agent: if it's already open somewhere,
// bring that window forward instead of showing the same deck twice.
function openAnywhere(file, preferred = current()) {
  file = path.resolve(file);
  const showing = windowShowing(file);
  if (showing) return focusWindow(showing);
  if (preferred) return openFile(preferred, file);
  createWindow(file);
}

// focus: give the deck keyboard focus once loaded. Decks the agent opens pass false, so
// typing to the agent isn't taken over by the slide (where arrow keys change slides).
async function openFile(w, file, { focus = true } = {}) {
  if (!w.win) { w.pendingFile = file; return; }
  file = path.resolve(file);
  if (!fs.existsSync(file)) {
    dialog.showErrorBox('File not found', file);
    return;
  }
  const showing = windowShowing(file);
  if (showing && showing !== w) return focusWindow(showing);
  w.currentFile = file;
  w.state = EMPTY_STATE();
  w.restoreIndex = null;
  w.undoStack = [];
  app.addRecentDocument(file);
  w.win.setTitle(displayName(file));
  w.win.setRepresentedFilename?.(file);
  w.deckView.setVisible(true);
  watch(w, file);
  await w.deckView.webContents.loadFile(file);
  if (focus) w.deckView?.webContents.focus();
}

async function showOpenDialog(w) {
  if (!w?.win) return;
  const { canceled, filePaths } = await dialog.showOpenDialog(w.win, {
    title: 'Open presentation',
    properties: ['openFile'],
    filters: [{ name: 'PPTD presentation (.pptd.html)', extensions: ['html', 'htm'] }],
  });
  if (!canceled && filePaths[0]) openFile(w, filePaths[0]);
}

function closeFile(w) {
  if (!w?.deckView) return;
  if (w.mode !== 'normal') setMode(w, 'normal');
  unwatch(w);
  w.thumbs.dispose();
  w.currentFile = null;
  w.state = EMPTY_STATE();
  w.undoStack = [];
  w.deckView.webContents.loadURL('about:blank');
  w.deckView.setVisible(false);
  w.win.setTitle('PPTD');
  w.win.setRepresentedFilename?.('');
  sendState(w);
}

// Reload when the file changes on disk (agent edits, dropped media, your editor).
// Watch the folder, not the file: editors and agents often replace the file atomically.
function watch(w, file) {
  unwatch(w);
  const dir = path.dirname(file), base = path.basename(file);
  try {
    w.watcher = fs.watch(dir, (_event, name) => {
      if (name && name !== base) return;
      clearTimeout(w.reloadTimer);
      w.reloadTimer = setTimeout(() => reloadFromDisk(w), 200);
    });
  } catch { w.watcher = null; }
}
function unwatch(w) { clearTimeout(w.reloadTimer); w.watcher?.close(); w.watcher = null; }

function reloadFromDisk(w) {
  if (!w?.currentFile || !w.deckView || !fs.existsSync(w.currentFile)) return;
  if (w.restoreIndex == null) w.restoreIndex = w.state.index;
  w.deckView.webContents.reloadIgnoringCache();
}

function writeAtomic(file, text) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  const mode = fs.statSync(file).mode;
  fs.writeFileSync(tmp, text, { mode });
  fs.renameSync(tmp, file);
}

// ---------------------------------------------------------------- media drop

async function handleDrop(w, paths, slideIndex) {
  if (!paths?.length) return;
  const decks = paths.filter((p) => /\.html?$/i.test(p));
  const items = paths.filter((p) => media.kindOf(p));
  const other = paths.filter((p) => !decks.includes(p) && !items.includes(p));
  if (decks.length && !items.length) return openFile(w, decks[0]);
  if (other.length) toast(w, `Can't add ${other.map((p) => path.basename(p)).join(', ')}: use an image (PNG, JPEG, GIF, WebP, SVG, HEIC) or a video (MP4, MOV, WebM).`, 'error');
  if (!items.length) return;
  if (!w.currentFile) return toast(w, 'Open a presentation first, then drop images or video onto a slide.', 'error');
  if (!w.isRadioDeck || !w.state.total) return toast(w, 'Media can only be added to PPTD slide decks.', 'error');

  const file = w.currentFile;
  const target = Number.isInteger(slideIndex) ? slideIndex : w.state.index;
  const n = target + 1;
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch (e) { return toast(w, `Can't read the deck: ${e.message}`, 'error'); }
  const before = html;
  const notes = [];
  let added = 0;

  for (const p of items) {
    const kind = media.kindOf(p);
    const alt = path.basename(p).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    try {
      let fig;
      if (kind === 'image') {
        const { mime, data, note } = media.encodeImage(p);
        if (note) notes.push(note);
        fig = media.figureHtml('image', mime, data, alt);
      } else {
        const size = fs.statSync(p).size;
        if (size > media.VIDEO_WARN_BYTES) {
          const mb = (size / 1048576).toFixed(0);
          const choice = dialog.showMessageBoxSync(w.win, {
            type: 'warning', buttons: ['Embed Anyway', 'Cancel'], defaultId: 1, cancelId: 1,
            message: `${path.basename(p)} is ${mb} MB.`,
            detail: `Embedding it makes the deck about ${(size * 1.34 / 1048576).toFixed(0)} MB larger, because PPTD decks are single files. Large decks are slow to open and to share. A shorter or compressed clip is usually better.`,
          });
          if (choice !== 0) continue;
        }
        const ext = path.extname(p).toLowerCase();
        fig = media.figureHtml('video', media.VIDEO[ext], await fs.promises.readFile(p), alt);
      }
      html = media.insertFigure(html, n, fig);
      added++;
    } catch (e) {
      toast(w, `${path.basename(p)}: ${e.message}`, 'error');
    }
  }
  if (!added) return;

  try { writeAtomic(file, html); } catch (e) { return toast(w, `Couldn't save the deck: ${e.message}`, 'error'); }
  const what = items.length === 1 ? (media.kindOf(items[0]) === 'image' ? 'image' : 'video') : `${added} items`;
  pushUndo(w, {
    file, before, after: html, index: target, what: 'Add Media', since: 'the media was added',
    undone: `Removed media from slide ${n}.`,
    note: `The user removed the ${what} they had just added to slide ${n} (<section id="s${n}">) of ${displayName(file)}; the file changed on disk.`,
  });
  w.restoreIndex = target;
  toast(w, `Added ${what} to slide ${n}${notes.length ? ` (${notes.join(', ')})` : ''}. ⌘Z to undo.`);
  w.agent?.noteChange(`The user added ${what === 'image' ? 'an image' : what === 'video' ? 'a video' : what} to slide ${n} (<section id="s${n}">) of ${displayName(file)} in PPTD; the file changed on disk. Re-read that slide before editing it.`);
}

// ---------------------------------------------------------------- reorder (drag in the drawer)

// from, to: 0-based positions. The slide's content moves; each position keeps its id,
// controls and progress bar (tools/pptd-deck.mjs), so the deck stays valid without renumbering.
async function moveSlideInDeck(w, from, to) {
  const total = w.state.total;
  if (!w.currentFile || !w.isRadioDeck || !Number.isInteger(from) || !Number.isInteger(to)) return;
  if (from === to || from < 0 || to < 0 || from >= total || to >= total) return;
  const file = w.currentFile;
  let html, res;
  try { html = fs.readFileSync(file, 'utf8'); } catch (e) { return toast(w, `Can't read the deck: ${e.message}`, 'error'); }
  try {
    const ops = await deckOps();
    res = ops.moveSlide(html, from + 1, to + 1);
    ops.verify(html, res.html, file);
  } catch (e) { return toast(w, e.message, 'error'); }
  try { writeAtomic(file, res.html); } catch (e) { return toast(w, `Couldn't save the deck: ${e.message}`, 'error'); }
  const name = res.title ? `“${res.title}”` : '';
  pushUndo(w, {
    file, before: html, after: res.html, index: from, what: 'Move Slide', since: 'the slide was moved',
    undone: `Moved ${name || 'the slide'} back to position ${from + 1}.`,
    note: `The user undid their slide move: ${name || 'the slide'} is back at position ${from + 1} and all slides are in their earlier order. The file changed on disk; re-read it before editing.`,
  });
  w.restoreIndex = to;
  toast(w, `Moved slide ${from + 1}${name ? ` ${name}` : ''} to position ${to + 1}. ⌘Z to undo.`);
  const [lo, hi] = from < to ? [from + 1, to + 1] : [to + 1, from + 1];
  w.agent?.noteChange(`The user moved slide ${from + 1}${name ? ` (${name})` : ''} to position ${to + 1} in ${displayName(file)} using PPTD. Slides ${lo} to ${hi} now have different numbers and section ids (<section id="sN">): the slide content moved, while each position kept its id, controls and progress bar. The file changed on disk: re-read it before editing, and don't rely on slide numbers, ids or file text from earlier in this conversation.`);
}

// ---------------------------------------------------------------- undo (media drops, slide moves)

function pushUndo(w, entry) {
  w.undoStack.push(entry);
  if (w.undoStack.length > 20) w.undoStack.shift();
  buildMenu();
}

function undoInsert(w) {
  const last = w?.undoStack.at(-1);
  if (!last) return;
  let now;
  try { now = fs.readFileSync(last.file, 'utf8'); } catch { now = null; }
  if (now !== last.after) {
    w.undoStack = [];
    buildMenu();
    return toast(w, `Can't undo: the deck has changed since ${last.since || 'then'}.`, 'error');
  }
  w.undoStack.pop();
  writeAtomic(last.file, last.before);
  w.restoreIndex = last.index;
  buildMenu();
  toast(w, last.undone);
  if (last.note) w.agent?.noteChange(last.note);
}

// ---------------------------------------------------------------- navigation

const NAV_JS = (target) => `(() => {
  let r = [...document.querySelectorAll('input.slide-radio')];
  if (!r.length) r = [...document.querySelectorAll('input[type=radio][name=slide]')];
  if (!r.length) return null;
  const cur = Math.max(0, r.findIndex(x => x.checked));
  const t = ${JSON.stringify(target)};
  let i = cur;
  if (typeof t === 'number') i = t;
  else if (t === 'next') i = cur + 1;
  else if (t === 'prev') i = cur - 1;
  else if (t === 'first') i = 0;
  else if (t === 'last') i = r.length - 1;
  i = Math.min(r.length - 1, Math.max(0, i));
  if (i !== cur) r[i].checked = true;
  r[i].focus({ preventScroll: true });
  const sec = document.getElementById('s' + (i + 1)) || document.querySelectorAll('section.slide')[i];
  return { index: i, total: r.length, label: sec ? sec.getAttribute('aria-label') : null };
})()`;

async function navigate(w, target, { focus = false } = {}) {
  if (!w?.currentFile || !w.deckView) return;
  const wc = w.deckView.webContents;
  if (w.isRadioDeck) {
    const res = await wc.executeJavaScript(NAV_JS(target)).catch(() => null);
    if (res) { w.state = res; sendState(w); }
    if (focus) wc.focus();
    return;
  }
  // Generic HTML: forward a key press and let the page handle it.
  const keyCode = { next: 'Right', prev: 'Left', first: 'Home', last: 'End' }[target];
  if (!keyCode) return;
  wc.focus();
  wc.sendInputEvent({ type: 'keyDown', keyCode });
  wc.sendInputEvent({ type: 'keyUp', keyCode });
}

async function refreshState(w) {
  if (!w.isRadioDeck || !w.deckView) { w.state = EMPTY_STATE(); sendState(w); return; }
  const res = await w.deckView.webContents.executeJavaScript(NAV_JS('stay')).catch(() => null);
  w.state = res || EMPTY_STATE();
  sendState(w);
}

let lastMenuKey = '';
function sendState(w) {
  if (!w.win) return;
  if (w === current()) {
    const menuKey = `${!!w.currentFile}|${w.mode}|${w.undoStack.at(-1)?.what || ''}`;
    if (menuKey !== lastMenuKey) buildMenu();
  }
  w.agent?.writeState({ deck: w.currentFile, ...w.state });
  send(w, 'state', {
    file: w.currentFile ? displayName(w.currentFile) : null,
    path: w.currentFile,
    index: w.state.index,
    total: w.state.total,
    label: w.state.label,
    mode: w.mode,
  });
}

function keyAction(w, action) {
  if (!w?.currentFile) return;
  if (action === 'exit') { if (w.mode !== 'normal') setMode(w, 'normal'); }
  else if (['next', 'prev', 'first', 'last'].includes(action)) navigate(w, action);
}

// ---------------------------------------------------------------- slideshow

async function setMode(w, next) {
  if (!w?.win || !w.deckView) return;
  if (next !== 'normal' && !w.currentFile) return;
  const prev = w.mode;
  if (prev === next) return;
  w.mode = next;

  if (next === 'fullscreen') w.win.setFullScreen(true);
  else if (prev === 'fullscreen' && w.win.isFullScreen()) w.win.setFullScreen(false);

  const wc = w.deckView.webContents;
  w.deckView.setBackgroundColor(next === 'normal' ? EDIT_BG : '#000000');
  if (w.isRadioDeck) {
    if (w.frameCssKey) await wc.removeInsertedCSS(w.frameCssKey).catch(() => {});
    w.frameCssKey = await wc.insertCSS(frameCss(next === 'normal' ? EDIT_BG : '#000'));
  }

  layout(w);
  settleLayout(w);
  wc.send('mode', w.mode);
  wc.focus();
  sendState(w);
}

function popupSlideshowMenu(w, x, y) {
  Menu.buildFromTemplate([
    { label: 'Full Screen', accelerator: 'CmdOrCtrl+Enter', click: () => setMode(w, 'fullscreen') },
    { label: 'Fill Window', accelerator: 'CmdOrCtrl+Alt+Enter', click: () => setMode(w, 'window') },
  ]).popup({ window: w.win, x: Math.round(x), y: Math.round(y) });
}

// ---------------------------------------------------------------- thumbnails

async function updateThumbs(w) {
  if (!w.currentFile || !w.isRadioDeck || !w.thumbsStale) return;
  w.thumbsStale = false;
  const file = w.currentFile;
  try {
    await w.thumbs.render(file, (t) => { if (file === w.currentFile) send(w, 'thumb', t); });
  } catch (e) {
    w.thumbsStale = true;
    console.error('thumbnails:', e.message);
  }
}

// ---------------------------------------------------------------- agent

// Where the agent starts when no deck is open; new presentations go here by default.
const workspaceDir = () => process.env.PPTD_WORKSPACE || path.join(app.getPath('documents'), 'PPTD');

// Which agent new sessions run: 'pi' (bundled, the default) or 'claude'. Kept in
// userData/settings.json; chosen in View › Agent.
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) || {}; } catch { return {}; }
}
function agentKind() {
  const k = readSettings().agent;
  return Object.hasOwn(AGENTS, k) ? k : 'pi';
}
function setAgentKind(kind) {
  if (!Object.hasOwn(AGENTS, kind) || kind === agentKind()) return;
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify({ ...readSettings(), agent: kind }, null, 2));
  } catch (e) { console.error('settings:', e.message); }
  buildMenu();
  const running = [...windows].filter((w) => w.agent?.alive && w.agent.kind !== kind).length;
  if (running) toast(current(), `New agent sessions use ${AGENTS[kind]}. Press Restart to switch a running one.`);
}

// The agent's per-prompt note (slide on screen, brand); rewrite it when either may change.
function refreshAgentNote(w) { w.agent?.writeState({ deck: w.currentFile, ...w.state }); }

// The default brand is written by the agent; refresh every note as soon as it appears.
let brandWatcher = null;
function watchDefaultBrand() {
  const dir = path.dirname(brand.userBrandFile());
  try {
    fs.mkdirSync(dir, { recursive: true });
    brandWatcher = fs.watch(dir, (_e, name) => {
      if (!name || name === 'brand.md') for (const w of windows) refreshAgentNote(w);
    });
  } catch {}
}

// The agent's PostToolUse hook appends `"file_path": "…"` for every file it writes or edits.
// A .pptd.html that isn't on screen is a deck the agent just made (or switched to): open it
// in the agent's own window.
function watchAgentEvents(w, file) {
  fs.writeFileSync(file, '');
  w.eventsOffset = 0;
  w.eventsWatcher?.close();
  w.eventsWatcher = fs.watch(file, () => {
    let text = '';
    try {
      const buf = fs.readFileSync(file);
      text = buf.subarray(w.eventsOffset).toString('utf8');
      w.eventsOffset = buf.length;
    } catch { return; }
    for (const line of text.split('\n')) {
      let p;
      try { p = JSON.parse(`{${line}}`).file_path; } catch { continue; }
      if (typeof p !== 'string' || !/\.pptd\.html$/i.test(p) || !path.isAbsolute(p)) continue;
      if (p !== w.currentFile && fs.existsSync(p)) openFile(w, p, { focus: false });
    }
  });
}

// Decks written in the agent's folder by any means (it often uses shell commands, which
// the hook can't see): open the one it touched, if it isn't already on screen.
function watchAgentFolder(w, dir) {
  w.cwdWatcher?.close();
  const since = Date.now() - 1000;
  try {
    w.cwdWatcher = fs.watch(dir, (_e, name) => {
      if (!name || !/\.pptd\.html$/i.test(name) || name.startsWith('.')) return;
      const file = path.join(dir, name);
      clearTimeout(w.cwdTimers.get(file));
      w.cwdTimers.set(file, setTimeout(() => {
        w.cwdTimers.delete(file);
        // Another window showing it already reloads it; don't steal it.
        if (file === w.currentFile || windowShowing(file)) return;
        try { if (fs.statSync(file).mtimeMs >= since) openFile(w, file, { focus: false }); } catch {}
      }, 400));
    });
  } catch { w.cwdWatcher = null; }
}

let agentSeq = 0;
function ensureAgent(w) {
  if (w.agent) return w.agent;
  const dir = path.join(app.getPath('userData'), 'agent');
  fs.mkdirSync(dir, { recursive: true });
  const tag = `${process.pid}-${++agentSeq}`;
  w.agent = new AgentSession({
    stateFile: path.join(dir, `current-slide-${tag}.txt`),
    eventsFile: path.join(dir, `events-${tag}.txt`),
    onData: (d) => send(w, 'pty-data', d),
    onExit: (e) => {
      send(w, 'pty-exit', e);
      if (w.restartAgent && w.win) { const s = w.restartAgent; w.restartAgent = null; startAgent(w, s); }
    },
  });
  watchAgentEvents(w, w.agent.eventsFile);
  if (!brandWatcher) watchDefaultBrand();
  return w.agent;
}

function removeAgentFiles(a) {
  for (const f of [a.stateFile, a.stateFile && `${a.stateFile}.json`, a.stateFile && a.changesFile, a.eventsFile]) { if (f) try { fs.rmSync(f, { force: true }); } catch {} }
}

// With a deck open, the agent starts in its folder; otherwise in ~/Documents/PPTD,
// ready to create one. It isn't tied to that deck: each prompt says what's on screen.
async function startAgent(w, { cols, rows } = {}) {
  const a = ensureAgent(w);
  if (a.alive || w.checkingLogin) return;
  const kind = agentKind();
  // pi with no model to use: show the sign-in panel instead, and start once signed in.
  if (kind === 'pi') {
    w.checkingLogin = true;
    const st = await piLogin.piStatus();
    w.checkingLogin = false;
    if (!w.win || a.alive) return;
    if (st && !st.ready) { showLogin(w, st, { cols, rows }); return; }
  }
  w.pendingAgent = null;
  const cwd = w.currentFile ? path.dirname(w.currentFile) : workspaceDir();
  try { fs.mkdirSync(cwd, { recursive: true }); } catch {}
  a.lastState = { deck: w.currentFile, ...w.state };
  send(w, 'pty-start', { deck: w.currentFile ? displayName(w.currentFile) : null, agent: AGENTS[kind] });
  watchAgentFolder(w, cwd);
  await a.start(cwd, cols, rows, kind);
}

// ---------------------------------------------------------------- model sign-in (pi)

// The sign-in panel in the agent pane. pending: the terminal size to start pi with once
// signed in; null when opened from the menu (sign in only).
function showLogin(w, status, pending = null) {
  w.pendingAgent = pending;
  send(w, 'login-show', { providers: status?.providers || {}, starting: !!pending });
}

async function openLoginFromMenu(w) {
  if (!w) return;
  const st = await piLogin.piStatus();
  if (w.win) showLogin(w, st, w.agent?.alive ? null : w.pendingAgent);
}

function beginLogin(w, { provider, method, key } = {}) {
  const p = piLogin.PROVIDERS[provider];
  if (!p || !p.methods.includes(method) || (method === 'api_key' && (typeof key !== 'string' || !key.trim()))) return;
  w.login?.cancel();
  const session = piLogin.startLogin({ provider, method, key: key?.trim() }, (e) => {
    if (w.login !== session) return;
    if (e.type === 'auth_url' && /^https:\/\//i.test(e.url || '')) { w.loginUrl = e.url; shell.openExternal(e.url); }
    if (e.type === 'device_code' && /^https:\/\//i.test(e.verificationUri || '')) shell.openExternal(e.verificationUri);
    if (e.type === 'done' || e.type === 'error') { w.login = null; w.loginUrl = null; }
    send(w, 'login-event', e);
    if (e.type !== 'done') return;
    send(w, 'login-hide', { signedIn: p.name });
    if (w.pendingAgent) { const size = w.pendingAgent; w.pendingAgent = null; startAgent(w, size); }
    else if (w.agent?.alive) toast(w, `Signed in to ${p.name}. Restart the agent to use it.`);
    else toast(w, `Signed in to ${p.name}.`);
  });
  w.login = session;
}

// ---------------------------------------------------------------- menu

function confirmEndSession(w, verb, count = 1) {
  const choice = dialog.showMessageBoxSync(w.win, {
    type: 'question', buttons: [`End ${count > 1 ? 'Sessions' : 'Session'} and ${verb}`, 'Cancel'], defaultId: 1, cancelId: 1,
    message: count > 1 ? `${count} agent sessions are still running.` : 'An agent session is still running.',
    detail: `${verb === 'Quit' ? 'Quitting' : 'Closing the window'} ends ${count > 1 ? 'them' : 'it'}. Edits already saved stay in the file.`,
  });
  return choice === 0;
}

function confirmQuit() {
  const busy = [...windows].filter((w) => w.agent?.alive && w.win);
  if (busy.length) {
    const w = busy.includes(current()) ? current() : busy[0];
    focusWindow(w);
    if (!confirmEndSession(w, 'Quit', busy.length)) return;
  }
  app.quit();
}

function buildMenu() {
  const w = current();
  const hasFile = !!w?.currentFile;
  const inShow = !!w && w.mode !== 'normal';
  const isMac = process.platform === 'darwin';
  lastMenuKey = w ? `${hasFile}|${w.mode}|${w.undoStack.at(-1)?.what || ''}` : '';
  // Menu clicks act on the window in front at the time of the click.
  const on = (fn) => () => fn(current());

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' }, { type: 'separator' }, { role: 'services' }, { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' },
        { label: `Quit ${app.name}`, accelerator: 'Cmd+Q', click: confirmQuit },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Window', accelerator: 'CmdOrCtrl+N', click: () => createWindow() },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => { const c = current() || createWindow(); showOpenDialog(c); } },
        ...(isMac ? [{ role: 'recentDocuments', submenu: [{ role: 'clearRecentDocuments' }] }] : []),
        { label: 'Close Presentation', accelerator: 'CmdOrCtrl+W', enabled: hasFile, click: on(closeFile) },
        { type: 'separator' },
        { label: 'Reveal in Finder', enabled: hasFile, click: on((c) => c?.currentFile && shell.showItemInFolder(c.currentFile)) },
        { type: 'separator' },
        isMac ? { role: 'close', accelerator: 'CmdOrCtrl+Shift+W' } : { label: 'Quit', click: confirmQuit },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: `Undo ${w?.undoStack.at(-1)?.what || ''}`.trim(), accelerator: 'CmdOrCtrl+Z', enabled: !!w?.undoStack.length, click: on(undoInsert) },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'Slideshow',
      submenu: [
        { label: 'Play Full Screen', accelerator: 'CmdOrCtrl+Enter', enabled: hasFile && !inShow, click: on((c) => setMode(c, 'fullscreen')) },
        // The old shortcut, kept working but not shown.
        { label: 'Play Full Screen', accelerator: 'CmdOrCtrl+Shift+Enter', visible: false, acceleratorWorksWhenHidden: true, enabled: hasFile && !inShow, click: on((c) => setMode(c, 'fullscreen')) },
        { label: 'Play in Window', accelerator: 'CmdOrCtrl+Alt+Enter', enabled: hasFile && !inShow, click: on((c) => setMode(c, 'window')) },
        { label: 'End Slideshow', enabled: inShow, click: on((c) => setMode(c, 'normal')) },
        { type: 'separator' },
        { label: 'Next Slide', enabled: hasFile, click: on((c) => navigate(c, 'next')) },
        { label: 'Previous Slide', enabled: hasFile, click: on((c) => navigate(c, 'prev')) },
        { label: 'First Slide', enabled: hasFile, click: on((c) => navigate(c, 'first')) },
        { label: 'Last Slide', enabled: hasFile, click: on((c) => navigate(c, 'last')) },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Slides Drawer', accelerator: 'CmdOrCtrl+Alt+S', click: on((c) => send(c, 'toggle', 'drawer')) },
        { label: 'Agent Terminal', accelerator: 'CmdOrCtrl+J', click: on((c) => send(c, 'toggle', 'agent')) },
        {
          label: 'Agent',
          submenu: [
            { label: 'Pi (built in)', type: 'radio', checked: agentKind() === 'pi', click: () => setAgentKind('pi') },
            { label: 'Claude Code', type: 'radio', checked: agentKind() === 'claude', click: () => setAgentKind('claude') },
            { type: 'separator' },
            { label: 'Sign In to a Model for Pi…', click: on(openLoginFromMenu) },
          ],
        },
        { type: 'separator' },
        { label: 'Reload Presentation', accelerator: 'CmdOrCtrl+R', enabled: hasFile, click: on(reloadFromDisk) },
        { label: 'Developer Tools (Presentation)', accelerator: 'Alt+CmdOrCtrl+I', enabled: hasFile, click: on((c) => c?.deckView?.webContents.toggleDevTools()) },
        { label: 'Developer Tools (App)', click: on((c) => c?.win?.webContents.toggleDevTools()) },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------- IPC

const isNavTarget = (t) => ['next', 'prev', 'first', 'last'].includes(t) || Number.isInteger(t);

// Every message is handled by the window it came from (its app UI or its deck view).
const handle = (channel, fn) => ipcMain.on(channel, (e, ...args) => {
  const w = fromSender(e);
  if (w?.win) fn(w, ...args);
});

handle('open-dialog', (w) => showOpenDialog(w));
handle('open-path', (w, p) => { if (typeof p === 'string' && /\.html?$/i.test(p)) openFile(w, p); });
handle('nav', (w, t, opts) => {
  if (t === 'exit') return keyAction(w, 'exit');
  if (isNavTarget(t)) navigate(w, t, { focus: !!opts?.focus });
});
handle('deck-key', (w, action) => keyAction(w, action));
handle('slideshow', (w, m) => { if (m === 'fullscreen' || m === 'window') setMode(w, m); });
handle('slideshow-menu', (w, { x, y } = {}) => popupSlideshowMenu(w, x, y));
handle('stage-rect', (w, r) => {
  if (r && [r.x, r.y, r.width, r.height].every(Number.isFinite)) { w.stageRect = r; layout(w); }
});
handle('drawer', (w, open) => { w.drawerOpen = !!open; if (w.drawerOpen) updateThumbs(w); });
handle('drop-paths', (w, { paths, slide } = {}) => {
  if (Array.isArray(paths)) handleDrop(w, paths.filter((p) => typeof p === 'string' && p), Number.isInteger(slide) ? slide : undefined);
});
handle('deck-drop', (w, paths) => {
  if (Array.isArray(paths)) handleDrop(w, paths.filter((p) => typeof p === 'string' && p));
});
handle('agent-start', (w, size) => startAgent(w, size || {}));
handle('agent-stop', (w) => w.agent?.stop());
handle('agent-restart', (w, size) => {
  if (w.agent?.alive) { w.restartAgent = size || {}; w.agent.stop(); } else startAgent(w, size || {});
});
handle('login-start', (w, req) => beginLogin(w, req || {}));
handle('login-answer', (w, { id, value } = {}) => { if (typeof id === 'string' && typeof value === 'string') w.login?.answer(id, value); });
handle('login-cancel', (w) => { w.login?.cancel(); w.login = null; w.loginUrl = null; });
handle('login-open-url', (w) => { if (w.login && w.loginUrl) shell.openExternal(w.loginUrl); });
handle('login-use-claude', (w) => {
  w.login?.cancel(); w.login = null;
  setAgentKind('claude');
  send(w, 'login-hide', {});
  const size = w.pendingAgent; w.pendingAgent = null;
  if (size) startAgent(w, size);
});
handle('open-link', (_w, url) => {
  // Only the pages the sign-in panel links to.
  if (url === 'https://console.anthropic.com/settings/keys') shell.openExternal(url);
});
handle('move-slide', (w, { from, to } = {}) => moveSlideInDeck(w, from, to));
handle('pty-input', (w, data) => { if (typeof data === 'string') w.agent?.write(data); });
handle('pty-resize', (w, { cols, rows } = {}) => w.agent?.resize(cols, rows));
handle('focus-deck', (w) => w.deckView?.webContents.focus());
// The app chrome (terminal, sign-in panel) takes keyboard focus back from the deck view.
handle('focus-ui', (w) => w.win.webContents.focus());

// ---------------------------------------------------------------- app lifecycle

// Files opened from Finder / "Open With" / dock drop (macOS).
app.on('open-file', (event, file) => {
  event.preventDefault();
  if (app.isReady() && windows.size) openAnywhere(file);
  else if (app.isReady()) createWindow(path.resolve(file));
  else pendingFile = file;
});

// File given on the command line: `bin/pptd deck.pptd.html` or
// `npm start -- deck.pptd.html`. Relative paths are resolved against the folder the
// command was typed in (npm runs scripts from the repo, so use INIT_CWD).
function fileFromArgs(argv, cwd) {
  for (const a of argv.slice(1)) {
    if (a.startsWith('-') || !/\.html?$/i.test(a)) continue;
    const p = path.resolve(cwd, a);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
const argFile = fileFromArgs(process.argv, process.env.INIT_CWD || process.cwd());
if (argFile) pendingFile = argFile;

// `npm start` keeps its own settings and single-instance lock, so it can run next to
// an installed PPTD.app. (The brand file is shared: see lib/brand.js.)
if (!app.isPackaged) app.setPath('userData', path.join(app.getPath('appData'), 'PPTD Dev'));

// One app at a time: running the command again opens the file in the existing app.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on('second-instance', (_e, argv, cwd) => {
  const f = fileFromArgs(argv, cwd);
  if (!windows.size) return createWindow(f);
  if (f) return openAnywhere(f);
  focusWindow(current());
});

app.whenReady().then(() => {
  if (!gotLock) return;
  // Packaged builds get the icon from build/icon.icns; `npm start` would show Electron's.
  if (!app.isPackaged && process.platform === 'darwin') {
    try { app.dock.setIcon(path.join(__dirname, 'build', 'icon.png')); } catch {}
  }
  buildMenu();
  createWindow(pendingFile ? path.resolve(pendingFile) : null);
  pendingFile = null;
  app.on('activate', () => { if (!windows.size) createWindow(); });
});

app.on('before-quit', () => { quitting = true; });

app.on('will-quit', () => {
  for (const w of windows) if (w.agent) { w.agent.stop(); removeAgentFiles(w.agent); }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
