// Slide screenshots and the keyboard-navigation test, rendered by PPTD itself in a hidden,
// offscreen window (no Chrome). Used by the menu (copy / export slide images) and by the
// agent through lib/app-socket.js (the skill's pptd-app.mjs).

const { BrowserWindow } = require('electron');

// Screenshots show the finished state, not the 0.22s entry animation.
const NO_MOTION_CSS = '*, *::before, *::after { animation: none !important; transition: none !important; }';
const HIDE_CONTROLS_CSS = '.controls { display: none !important; }';

const RADIOS = `(() => {
  let r = document.querySelectorAll('input.slide-radio');
  if (!r.length) r = document.querySelectorAll('input[type=radio][name=slide]');
  return r; })()`;

const frame = (wc) => wc.executeJavaScript(
  'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))');

async function openDeck(file, width, height) {
  const win = new BrowserWindow({
    show: false, width, height, useContentSize: true, frame: false,
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  const wc = win.webContents;
  wc.setFrameRate(60);
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (e) => e.preventDefault());
  wc.setAudioMuted(true);
  await wc.loadFile(file);
  await wc.executeJavaScript('document.fonts.ready.then(() => true)');
  return win;
}

/**
 * Capture slides of a deck.
 * @param {string} file  deck path
 * @param {object} o
 * @param {number[]|null} [o.slides]  0-based indexes; null = every slide
 * @param {number} [o.width=1280] [o.height=720]  viewport, as in a browser window that size
 * @param {boolean} [o.controls=true]  false hides the ‹ › controls
 * @param {boolean} [o.cropToDeck=false]  true captures only the 16:9 .deck, not the page around it
 * @returns {Promise<{index:number, total:number, image:Electron.NativeImage}[]>}
 */
async function captureSlides(file, { slides = null, width = 1280, height = 720, controls = true, cropToDeck = false } = {}) {
  const win = await openDeck(file, width, height);
  try {
    const wc = win.webContents;
    await wc.insertCSS(NO_MOTION_CSS);
    if (!controls) await wc.insertCSS(HIDE_CONTROLS_CSS);
    const total = await wc.executeJavaScript(`${RADIOS}.length`);
    if (!total) throw new Error('This file has no PPTD slides (no slide radios).');
    const want = slides ?? [...Array(total).keys()];
    const bad = want.filter((i) => !Number.isInteger(i) || i < 0 || i >= total);
    if (bad.length) throw new Error(`No slide ${bad.map((i) => i + 1).join(', ')}: the deck has ${total}.`);
    const out = [];
    for (const i of want) {
      await wc.executeJavaScript(`${RADIOS}[${i}].checked = true`);
      await frame(wc);
      wc.invalidate();
      await frame(wc);
      let rect;
      if (cropToDeck) {
        rect = await wc.executeJavaScript(`(() => { const d = document.querySelector('.deck');
          if (!d) return null; const r = d.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; })()`);
      }
      const image = rect && rect.width > 0 ? await wc.capturePage(rect) : await wc.capturePage();
      out.push({ index: i, total, image });
    }
    return out;
  } finally {
    win.destroy();
  }
}

/**
 * Render a design file someone downloaded (a Claude Design export, any HTML page) to PNGs,
 * so an agent can look at it before turning it into a style. The page is treated as
 * untrusted: its scripts are removed and blocked (Claude Design exports carry a runtime that
 * must not run), it may load only local files (no network), and it can't navigate or open
 * windows. Each top-level <section> becomes one 16:9 image (how slide designs are built);
 * a page without sections is captured a screen at a time.
 * @returns {Promise<{name:string, image:Electron.NativeImage}[]>}
 */
async function renderPage(file, { width = 1280, height = 720, maxPages = 40 } = {}) {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { session } = require('electron');
  const { pathToFileURL } = require('url');
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '').replace(/<script\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1=$2#$2');
  const base = `<base href="${pathToFileURL(path.dirname(file) + path.sep).href}">`;
  const csp = `<meta http-equiv="Content-Security-Policy" content="script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'">`;
  // Placeholders for Claude Design's <image-slot> (and other unknown elements with a brief).
  const extra = `<style>image-slot{display:block;position:relative;min-height:40px;overflow:hidden;background:repeating-linear-gradient(135deg,#b9b9b9 0 10px,#c8c8c8 10px 20px)}
image-slot::after{content:attr(placeholder);position:absolute;left:8px;right:8px;bottom:8px;font:12px/1.3 system-ui;color:#333;background:rgba(255,255,255,.7);padding:4px}</style>`;
  html = /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, (m) => `${m}${csp}${base}${extra}`) : `${csp}${base}${extra}${html}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pptd-render-'));
  const page = path.join(tmp, 'page.html');
  fs.writeFileSync(page, html);

  const ses = session.fromPartition('pptd-render');   // in memory, separate from the app
  ses.webRequest.onBeforeRequest((d, cb) => cb({ cancel: !/^(file|data|blob|about):/i.test(d.url) }));
  const win = new BrowserWindow({
    show: false, width, height, useContentSize: true, frame: false, enableLargerThanScreen: true,
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, nodeIntegration: false, session: ses, backgroundThrottling: false },
  });
  const wc = win.webContents;
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (e) => e.preventDefault());
  wc.setAudioMuted(true);
  try {
    await wc.loadFile(page);
    await wc.executeJavaScript('document.fonts.ready.then(() => true)');
    await wc.insertCSS(NO_MOTION_CSS);
    // Lay top-level sections out as slides, one under the other.
    const count = await wc.executeJavaScript(`(() => {
      const top = [...document.querySelectorAll('section')].filter((s) => !s.parentElement.closest('section'));
      if (top.length < 2) return 0;
      document.documentElement.style.margin = document.body.style.margin = '0';
      for (const s of top) Object.assign(s.style, { width: '${width}px', height: '${height}px', overflow: 'hidden', boxSizing: 'border-box', position: 'relative', flex: 'none' });
      window.__pptdTop = top;
      return top.length; })()`);
    const out = [];
    const n = count || Math.min(maxPages, Math.ceil(await wc.executeJavaScript('document.documentElement.scrollHeight') / height));
    for (let i = 0; i < Math.min(n, maxPages); i++) {
      const y = await wc.executeJavaScript(count
        ? `(() => { const s = window.__pptdTop[${i}]; window.scrollTo(0, 0); const r = s.getBoundingClientRect(); window.scrollTo(0, r.top); return s.getBoundingClientRect().top; })()`
        : `(() => { window.scrollTo(0, ${i * height}); return 0; })()`);
      await frame(wc); wc.invalidate(); await frame(wc);
      const image = await wc.capturePage({ x: 0, y: Math.max(0, Math.round(y)), width, height });
      const label = count ? await wc.executeJavaScript(`window.__pptdTop[${i}].getAttribute('data-label') || ''`) : '';
      out.push({ name: `${String(i + 1).padStart(2, '0')}${label ? '-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) : ''}`, image });
    }
    return out;
  } finally {
    win.destroy();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Navigate the deck with real key presses and label clicks, as a viewer would.
 * Mirrors the old Chrome keytest: start on slide 1, → → ←, click a ›, → again; no scripts.
 * @returns {Promise<{ok:boolean, lines:string[]}>}
 */
async function keyTest(file) {
  const win = await openDeck(file, 1280, 720);
  try {
    const wc = win.webContents;
    const ev = (x) => wc.executeJavaScript(x);
    const visible = `[...document.querySelectorAll('.slide')].filter(s => getComputedStyle(s).display !== 'none').map(s => s.id).join()`;
    const lines = [];
    let ok = true;
    const check = async (label, want) => {
      await frame(wc);
      const got = await ev(visible);
      const pass = got === want;
      ok &&= pass;
      lines.push(`${pass ? 'PASS' : 'FAIL'} ${label}: visible=${got} (want ${want})`);
    };
    const key = async (keyCode) => {
      for (const type of ['keyDown', 'keyUp']) wc.sendInputEvent({ type, keyCode });
      await frame(wc);
    };
    // An offscreen window has no OS focus; give the page focus the way autofocus would.
    wc.focus();
    await ev(`(document.querySelector('input.slide-radio:checked') || document.querySelector('input[type=radio][name=slide]:checked'))?.focus(), true`);

    const n = await ev(`document.querySelectorAll('.slide').length`);
    const at = (i) => `s${((i - 1) % n) + 1}`;
    await check('start', 's1');
    if (n > 1) {
      await key('Right'); await check('ArrowRight', at(2));
      await key('Right'); await check('ArrowRight', at(3));
      await key('Left'); await check('ArrowLeft', at(2));
      const target = n > 2 ? 3 : 1;
      if (await ev(`!!document.querySelector('#s2 .controls label[for=r${target}]')`)) {
        await ev(`document.querySelector('#s2 .controls label[for=r${target}]').click(), true`);
        await check('click label', `s${target}`);
        await key('Right'); await check('ArrowRight after click', at(target + 1));
      } else {
        ok = false;
        lines.push(`FAIL no ‹ › label for r${target} on slide 2`);
      }
    }
    const scripts = await ev('document.scripts.length');
    ok &&= scripts === 0;
    lines.push(`${scripts === 0 ? 'PASS' : 'FAIL'} script tags: ${scripts} (must be 0)`);
    return { ok, lines };
  } finally {
    win.destroy();
  }
}

module.exports = { captureSlides, keyTest, renderPage };
