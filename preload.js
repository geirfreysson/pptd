// Bridge between the app chrome (index.html: toolbar, drawer, terminal) and the main process.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const on = (channel) => (cb) => ipcRenderer.on(channel, (_e, payload) => cb(payload));

contextBridge.exposeInMainWorld('viewer', {
  open: () => ipcRenderer.send('open-dialog'),
  nav: (target, opts) => ipcRenderer.send('nav', target, opts),
  slideshow: (mode) => ipcRenderer.send('slideshow', mode),
  slideshowMenu: (x, y) => ipcRenderer.send('slideshow-menu', { x, y }),
  stageRect: (r) => ipcRenderer.send('stage-rect', r),
  drawer: (open) => ipcRenderer.send('drawer', open),
  focusDeck: () => ipcRenderer.send('focus-deck'),
  focusUi: () => ipcRenderer.send('focus-ui'),
  // Dropped files. A FileList doesn't survive the context bridge, so the page passes
  // File objects one at a time to pathForFile and sends plain paths.
  pathForFile: (file) => { try { return webUtils.getPathForFile(file) || ''; } catch { return ''; } },
  // slide is a 0-based index, or undefined for the current slide.
  dropPaths: (paths, slide) => ipcRenderer.send('drop-paths', { paths, slide }),
  // Reorder: 0-based positions.
  moveSlide: (from, to) => ipcRenderer.send('move-slide', { from, to }),
  // Prompt history: put the deck back as it was after prompt `id` ('start': before the first).
  revertPrompt: (id) => ipcRenderer.send('revert-prompt', id),

  agentStart: (size) => ipcRenderer.send('agent-start', size),
  agentStop: () => ipcRenderer.send('agent-stop'),
  agentRestart: (size) => ipcRenderer.send('agent-restart', size),
  ptyInput: (data) => ipcRenderer.send('pty-input', data),
  ptyResize: (cols, rows) => ipcRenderer.send('pty-resize', { cols, rows }),
  // Model sign-in for pi (the panel in the agent pane).
  loginStart: (req) => ipcRenderer.send('login-start', req),
  loginAnswer: (id, value) => ipcRenderer.send('login-answer', { id, value }),
  loginCancel: () => ipcRenderer.send('login-cancel'),
  loginUseClaude: () => ipcRenderer.send('login-use-claude'),
  loginOpenUrl: () => ipcRenderer.send('login-open-url'),
  openLink: (url) => ipcRenderer.send('open-link', url),
  // The new-version banner: 'download', 'notes', 'later' or 'skip'.
  updateAction: (action) => ipcRenderer.send('update-action', action),

  onState: on('state'),
  onThumb: on('thumb'),
  onPrompts: on('prompts'),
  onUpdate: on('update'),
  onToggle: on('toggle'),
  onPtyData: on('pty-data'),
  onPtyExit: on('pty-exit'),
  onPtyStart: on('pty-start'),
  onAgentBusy: on('agent-busy'),
  onLoginShow: on('login-show'),
  onLoginEvent: on('login-event'),
  onLoginHide: on('login-hide'),
});
