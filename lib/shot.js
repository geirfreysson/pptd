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

module.exports = { captureSlides, keyTest };
