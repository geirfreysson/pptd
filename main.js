// PPTD ("PowerPoint is dead") — main process.
//
// Window layout:
//   BrowserWindow    index.html: toolbar, slide drawer (left), agent terminal (bottom)
//   WebContentsView  the deck, placed over the "#stage" rectangle reported by index.html
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
const { renderThumbs, disposeThumbs } = require('./lib/thumbs');
const { AgentSession } = require('./lib/agent');
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

let win = null;
let deckView = null;
let currentFile = null;
let pendingFile = null;          // file passed before the window existed
let mode = 'normal';
let isRadioDeck = false;
let frameCssKey = null;
let state = { index: 0, total: 0, label: null };
let restoreIndex = null;         // slide to return to after a reload
let stageRect = null;            // where index.html wants the deck (normal mode)
let watcher = null;
let reloadTimer = null;
let drawerOpen = false;
let thumbsStale = true;
let undoStack = [];
let agent = null;
let restartAgent = null;         // {cols, rows} when a restart is pending
let quitting = false;            // set by before-quit; no more dialogs after that

// ---------------------------------------------------------------- window

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
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

  deckView = new WebContentsView({
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
    isRadioDeck = await wc.executeJavaScript(
      `!!document.querySelector('meta[name=pptd], input.slide-radio, input[type=radio][name=slide]')`);
    if (isRadioDeck) {
      await wc.insertCSS(HIDE_CONTROLS_CSS);
      frameCssKey = await wc.insertCSS(frameCss(mode === 'normal' ? EDIT_BG : '#000'));
    } else {
      frameCssKey = null;
    }
    wc.send('mode', mode);
    if (restoreIndex != null && isRadioDeck) {
      const i = restoreIndex; restoreIndex = null;
      await navigate(i, { focus: false });
    } else {
      restoreIndex = null;
      await refreshState();
    }
    thumbsStale = true;
    if (drawerOpen) updateThumbs();
  });

  win.on('resize', layout);
  win.on('enter-full-screen', layout);
  win.on('leave-full-screen', () => {
    // User left full screen another way (green button, Ctrl+Cmd+F): end the show.
    if (mode === 'fullscreen') setMode('normal');
    layout();
    settleLayout();
  });
  // Closing the window yourself asks first. A quit already under way (⌘Q after
  // confirming, logout, `kill`) never waits on a dialog.
  win.on('close', (e) => {
    if (quitting || !agent?.alive) return;
    if (!confirmEndSession('Close')) e.preventDefault(); else agent.stop();
  });
  win.on('closed', () => { win = null; deckView = null; disposeThumbs(); unwatch(); });

  win.webContents.once('did-finish-load', () => {
    sendState();
    if (pendingFile) { openFile(pendingFile); pendingFile = null; }
  });

  layout();
}

function layout() {
  if (!win || !deckView) return;
  const [w, h] = win.getContentSize();
  if (mode !== 'normal') { deckView.setBounds({ x: 0, y: 0, width: w, height: h }); return; }
  const r = stageRect || { x: 0, y: TOOLBAR_HEIGHT, width: w, height: h - TOOLBAR_HEIGHT };
  deckView.setBounds({
    x: Math.round(r.x), y: Math.round(r.y),
    width: Math.max(0, Math.round(r.width)), height: Math.max(0, Math.round(r.height)),
  });
}

// Bounds set while macOS animates out of full screen can leave the page at its old
// size. Re-apply them once the window has settled, with a 1px nudge so the page resizes.
let settleTimer = null;
function settleLayout() {
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    if (!deckView) return;
    layout();
    const b = deckView.getBounds();
    deckView.setBounds({ ...b, width: Math.max(0, b.width - 1) });
    deckView.setBounds(b);
  }, 120);
}

const send = (channel, payload) => { if (win && !win.isDestroyed()) win.webContents.send(channel, payload); };
const toast = (text, kind = 'info') => send('toast', { text, kind });

// ---------------------------------------------------------------- files

// "Q3 review.pptd.html" -> "Q3 review"
const displayName = (file) => path.basename(file).replace(/(\.pptd)?\.html?$/i, '');

async function openFile(file) {
  if (!win) { pendingFile = file; return; }
  file = path.resolve(file);
  if (!fs.existsSync(file)) {
    dialog.showErrorBox('File not found', file);
    return;
  }
  const switching = currentFile && currentFile !== file;
  currentFile = file;
  state = { index: 0, total: 0, label: null };
  restoreIndex = null;
  undoStack = [];
  app.addRecentDocument(file);
  win.setTitle(displayName(file));
  win.setRepresentedFilename?.(file);
  deckView.setVisible(true);
  watch(file);
  if (switching && agent?.alive) toast('The agent session is still set up for the previous deck. Restart it to switch.');
  await deckView.webContents.loadFile(file);
  deckView.webContents.focus();
}

async function showOpenDialog() {
  if (!win) return;
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open presentation',
    properties: ['openFile'],
    filters: [{ name: 'PPTD presentation (.pptd.html)', extensions: ['html', 'htm'] }],
  });
  if (!canceled && filePaths[0]) openFile(filePaths[0]);
}

function closeFile() {
  if (!deckView) return;
  if (mode !== 'normal') setMode('normal');
  unwatch();
  disposeThumbs();
  currentFile = null;
  state = { index: 0, total: 0, label: null };
  undoStack = [];
  deckView.webContents.loadURL('about:blank');
  deckView.setVisible(false);
  win.setTitle('PPTD');
  win.setRepresentedFilename?.('');
  sendState();
}

// Reload when the file changes on disk (agent edits, dropped media, your editor).
// Watch the folder, not the file: editors and agents often replace the file atomically.
function watch(file) {
  unwatch();
  const dir = path.dirname(file), base = path.basename(file);
  try {
    watcher = fs.watch(dir, (_event, name) => {
      if (name === brand.BRAND_NAME) { refreshAgentNote(); return; }
      if (name && name !== base) return;
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(reloadFromDisk, 200);
    });
  } catch { watcher = null; }
}
function unwatch() { clearTimeout(reloadTimer); watcher?.close(); watcher = null; }

function reloadFromDisk() {
  if (!currentFile || !deckView || !fs.existsSync(currentFile)) return;
  if (restoreIndex == null) restoreIndex = state.index;
  deckView.webContents.reloadIgnoringCache();
}

function writeAtomic(file, text) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  const mode = fs.statSync(file).mode;
  fs.writeFileSync(tmp, text, { mode });
  fs.renameSync(tmp, file);
}

// ---------------------------------------------------------------- media drop

async function handleDrop(paths, slideIndex) {
  if (!paths?.length) return;
  const decks = paths.filter((p) => /\.html?$/i.test(p));
  const items = paths.filter((p) => media.kindOf(p));
  const other = paths.filter((p) => !decks.includes(p) && !items.includes(p));
  if (decks.length && !items.length) return openFile(decks[0]);
  if (other.length) toast(`Can't add ${other.map((p) => path.basename(p)).join(', ')}: use an image (PNG, JPEG, GIF, WebP, SVG, HEIC) or a video (MP4, MOV, WebM).`, 'error');
  if (!items.length) return;
  if (!currentFile) return toast('Open a presentation first, then drop images or video onto a slide.', 'error');
  if (!isRadioDeck || !state.total) return toast('Media can only be added to PPTD slide decks.', 'error');

  const target = Number.isInteger(slideIndex) ? slideIndex : state.index;
  const n = target + 1;
  let html;
  try { html = fs.readFileSync(currentFile, 'utf8'); } catch (e) { return toast(`Can't read the deck: ${e.message}`, 'error'); }
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
          const choice = dialog.showMessageBoxSync(win, {
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
      toast(`${path.basename(p)}: ${e.message}`, 'error');
    }
  }
  if (!added) return;

  try { writeAtomic(currentFile, html); } catch (e) { return toast(`Couldn't save the deck: ${e.message}`, 'error'); }
  undoStack.push({ file: currentFile, before, after: html, index: target });
  if (undoStack.length > 20) undoStack.shift();
  restoreIndex = target;
  buildMenu();
  const what = items.length === 1 ? (media.kindOf(items[0]) === 'image' ? 'image' : 'video') : `${added} items`;
  toast(`Added ${what} to slide ${n}${notes.length ? ` (${notes.join(', ')})` : ''}. ⌘Z to undo.`);
}

function undoInsert() {
  const last = undoStack.at(-1);
  if (!last) return;
  let now;
  try { now = fs.readFileSync(last.file, 'utf8'); } catch { now = null; }
  if (now !== last.after) {
    undoStack = [];
    buildMenu();
    return toast("Can't undo: the deck has changed since the media was added.", 'error');
  }
  undoStack.pop();
  writeAtomic(last.file, last.before);
  restoreIndex = last.index;
  buildMenu();
  toast(`Removed media from slide ${last.index + 1}.`);
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

async function navigate(target, { focus = false } = {}) {
  if (!currentFile || !deckView) return;
  const wc = deckView.webContents;
  if (isRadioDeck) {
    const res = await wc.executeJavaScript(NAV_JS(target)).catch(() => null);
    if (res) { state = res; sendState(); }
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

async function refreshState() {
  if (!isRadioDeck) { state = { index: 0, total: 0, label: null }; sendState(); return; }
  const res = await deckView.webContents.executeJavaScript(NAV_JS('stay')).catch(() => null);
  state = res || { index: 0, total: 0, label: null };
  sendState();
}

let lastMenuKey = '';
function sendState() {
  if (!win) return;
  const menuKey = `${!!currentFile}|${mode}|${undoStack.length > 0}`;
  if (menuKey !== lastMenuKey) { lastMenuKey = menuKey; buildMenu(); }
  agent?.writeState({ deck: currentFile, ...state });
  send('state', {
    file: currentFile ? displayName(currentFile) : null,
    path: currentFile,
    index: state.index,
    total: state.total,
    label: state.label,
    mode,
  });
}

function keyAction(action) {
  if (!currentFile) return;
  if (action === 'exit') { if (mode !== 'normal') setMode('normal'); }
  else if (['next', 'prev', 'first', 'last'].includes(action)) navigate(action);
}

// ---------------------------------------------------------------- slideshow

async function setMode(next) {
  if (!win || !deckView) return;
  if (next !== 'normal' && !currentFile) return;
  const prev = mode;
  if (prev === next) return;
  mode = next;

  if (next === 'fullscreen') win.setFullScreen(true);
  else if (prev === 'fullscreen' && win.isFullScreen()) win.setFullScreen(false);

  const wc = deckView.webContents;
  deckView.setBackgroundColor(next === 'normal' ? EDIT_BG : '#000000');
  if (isRadioDeck) {
    if (frameCssKey) await wc.removeInsertedCSS(frameCssKey).catch(() => {});
    frameCssKey = await wc.insertCSS(frameCss(next === 'normal' ? EDIT_BG : '#000'));
  }

  layout();
  settleLayout();
  wc.send('mode', mode);
  wc.focus();
  sendState();
}

function popupSlideshowMenu(x, y) {
  Menu.buildFromTemplate([
    { label: 'Full Screen', accelerator: 'CmdOrCtrl+Shift+Enter', click: () => setMode('fullscreen') },
    { label: 'Fill Window', accelerator: 'CmdOrCtrl+Alt+Enter', click: () => setMode('window') },
  ]).popup({ window: win, x: Math.round(x), y: Math.round(y) });
}

// ---------------------------------------------------------------- thumbnails

async function updateThumbs() {
  if (!currentFile || !isRadioDeck || !thumbsStale) return;
  thumbsStale = false;
  const file = currentFile;
  try {
    await renderThumbs(file, (t) => { if (file === currentFile) send('thumb', t); });
  } catch (e) {
    thumbsStale = true;
    console.error('thumbnails:', e.message);
  }
}

// ---------------------------------------------------------------- brand

// The agent's per-prompt note names the brand file in effect; rewrite it when that may change.
function refreshAgentNote() { agent?.writeState({ deck: currentFile, ...state }); }

// 'current': the brand in effect for the open deck (else the default).
// 'default': the user's default brand. 'folder': brand.md next to the open deck,
// started from the default brand if there is one.
function editBrand(which) {
  let file;
  try {
    if (which === 'folder') {
      if (!currentFile) return;
      const def = brand.userBrandFile();
      file = brand.ensureBrandFile(brand.folderBrandFile(currentFile), fs.existsSync(def) ? def : brand.TEMPLATE);
    } else if (which === 'current' && brand.findBrand(currentFile)) {
      file = brand.findBrand(currentFile).file;
    } else {
      file = brand.ensureBrandFile(brand.userBrandFile());
    }
  } catch (e) {
    return toast(`Can't create the brand file: ${e.message}`, 'error');
  }
  refreshAgentNote();
  shell.openPath(file).then((err) => { if (err) shell.showItemInFolder(file); });
  const b = brand.findBrand(currentFile);
  toast(b?.file === file || !currentFile ? `Editing ${file.replace(app.getPath('home'), '~')}. The agent picks up changes on its next message.`
    : `Editing the default brand. brand.md in this deck's folder takes precedence here.`);
}

// ---------------------------------------------------------------- agent

function ensureAgent() {
  if (agent) return agent;
  agent = new AgentSession({
    stateFile: path.join(app.getPath('userData'), 'agent', `current-slide-${process.pid}.txt`),
    onData: (d) => send('pty-data', d),
    onExit: (e) => {
      send('pty-exit', e);
      if (restartAgent) { const s = restartAgent; restartAgent = null; startAgent(s); }
    },
  });
  return agent;
}

async function startAgent({ cols, rows } = {}) {
  if (!currentFile) return toast('Open a presentation first.', 'error');
  const a = ensureAgent();
  if (a.alive) return;
  a.writeState({ deck: currentFile, ...state });
  send('pty-start', { deck: displayName(currentFile) });
  await a.start(currentFile, cols, rows);
}

// ---------------------------------------------------------------- menu

function confirmEndSession(verb) {
  const choice = dialog.showMessageBoxSync(win, {
    type: 'question', buttons: [`End Session and ${verb}`, 'Cancel'], defaultId: 1, cancelId: 1,
    message: 'An agent session is still running.',
    detail: `${verb === 'Quit' ? 'Quitting' : 'Closing the window'} ends it. Edits it already saved stay in the file.`,
  });
  return choice === 0;
}

function confirmQuit() {
  if (agent?.alive && win && !confirmEndSession('Quit')) return;
  app.quit();
}

function buildMenu() {
  const hasFile = !!currentFile;
  const inShow = mode !== 'normal';
  const isMac = process.platform === 'darwin';

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
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: showOpenDialog },
        ...(isMac ? [{ role: 'recentDocuments', submenu: [{ role: 'clearRecentDocuments' }] }] : []),
        { label: 'Close Presentation', accelerator: 'CmdOrCtrl+W', enabled: hasFile, click: closeFile },
        { type: 'separator' },
        { label: 'Reveal in Finder', enabled: hasFile, click: () => shell.showItemInFolder(currentFile) },
        { type: 'separator' },
        { label: 'Edit Brand…', click: () => editBrand('current') },
        { label: 'Edit Default Brand…', click: () => editBrand('default') },
        { label: 'New Brand for This Folder', enabled: hasFile, click: () => editBrand('folder') },
        { type: 'separator' },
        isMac ? { role: 'close', accelerator: 'CmdOrCtrl+Shift+W' } : { label: 'Quit', click: confirmQuit },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo Add Media', accelerator: 'CmdOrCtrl+Z', enabled: undoStack.length > 0, click: undoInsert },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'Slideshow',
      submenu: [
        { label: 'Play Full Screen', accelerator: 'CmdOrCtrl+Shift+Enter', enabled: hasFile && !inShow, click: () => setMode('fullscreen') },
        { label: 'Play in Window', accelerator: 'CmdOrCtrl+Alt+Enter', enabled: hasFile && !inShow, click: () => setMode('window') },
        { label: 'End Slideshow', enabled: inShow, click: () => setMode('normal') },
        { type: 'separator' },
        { label: 'Next Slide', enabled: hasFile, click: () => navigate('next') },
        { label: 'Previous Slide', enabled: hasFile, click: () => navigate('prev') },
        { label: 'First Slide', enabled: hasFile, click: () => navigate('first') },
        { label: 'Last Slide', enabled: hasFile, click: () => navigate('last') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Slides Drawer', accelerator: 'CmdOrCtrl+Alt+S', click: () => send('toggle', 'drawer') },
        { label: 'Agent Terminal', accelerator: 'CmdOrCtrl+J', enabled: hasFile, click: () => send('toggle', 'agent') },
        { type: 'separator' },
        { label: 'Reload Presentation', accelerator: 'CmdOrCtrl+R', enabled: hasFile, click: reloadFromDisk },
        { label: 'Developer Tools (Presentation)', accelerator: 'Alt+CmdOrCtrl+I', enabled: hasFile, click: () => deckView.webContents.toggleDevTools() },
        { label: 'Developer Tools (App)', click: () => win?.webContents.toggleDevTools() },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------- IPC

const isNavTarget = (t) => ['next', 'prev', 'first', 'last'].includes(t) || Number.isInteger(t);

ipcMain.on('open-dialog', showOpenDialog);
ipcMain.on('open-path', (_e, p) => { if (typeof p === 'string' && /\.html?$/i.test(p)) openFile(p); });
ipcMain.on('nav', (_e, t, opts) => {
  if (t === 'exit') return keyAction('exit');
  if (isNavTarget(t)) navigate(t, { focus: !!opts?.focus });
});
ipcMain.on('deck-key', (_e, action) => keyAction(action));
ipcMain.on('slideshow', (_e, m) => { if (m === 'fullscreen' || m === 'window') setMode(m); });
ipcMain.on('slideshow-menu', (_e, { x, y }) => popupSlideshowMenu(x, y));
ipcMain.on('stage-rect', (_e, r) => {
  if (r && [r.x, r.y, r.width, r.height].every(Number.isFinite)) { stageRect = r; layout(); }
});
ipcMain.on('drawer', (_e, open) => { drawerOpen = !!open; if (drawerOpen) updateThumbs(); });
ipcMain.on('drop-paths', (_e, { paths, slide }) => {
  if (Array.isArray(paths)) handleDrop(paths.filter((p) => typeof p === 'string' && p), Number.isInteger(slide) ? slide : undefined);
});
ipcMain.on('deck-drop', (_e, paths) => {
  if (Array.isArray(paths)) handleDrop(paths.filter((p) => typeof p === 'string' && p));
});
ipcMain.on('agent-start', (_e, size) => startAgent(size || {}));
ipcMain.on('agent-stop', () => agent?.stop());
ipcMain.on('agent-restart', (_e, size) => {
  if (agent?.alive) { restartAgent = size || {}; agent.stop(); } else startAgent(size || {});
});
ipcMain.on('pty-input', (_e, data) => { if (typeof data === 'string') agent?.write(data); });
ipcMain.on('pty-resize', (_e, { cols, rows }) => agent?.resize(cols, rows));
ipcMain.on('focus-deck', () => deckView?.webContents.focus());

// ---------------------------------------------------------------- app lifecycle

// Files opened from Finder / "Open With" / dock drop (macOS).
app.on('open-file', (event, file) => {
  event.preventDefault();
  if (app.isReady() && win) openFile(file); else pendingFile = file;
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

// One app at a time: running the command again opens the file in the existing window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on('second-instance', (_e, argv, cwd) => {
  if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
  const f = fileFromArgs(argv, cwd);
  if (f) openFile(f);
});

app.whenReady().then(() => {
  if (!gotLock) return;
  // Packaged builds get the icon from build/icon.icns; `npm start` would show Electron's.
  if (!app.isPackaged && process.platform === 'darwin') {
    try { app.dock.setIcon(path.join(__dirname, 'build', 'icon.png')); } catch {}
  }
  buildMenu();
  createWindow();
  app.on('activate', () => { if (!win) createWindow(); });
});

app.on('before-quit', () => { quitting = true; });

app.on('will-quit', () => {
  agent?.stop();
  try { fs.rmSync(path.join(app.getPath('userData'), 'agent', `current-slide-${process.pid}.txt`), { force: true }); } catch {}
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
