// Renders a small picture of every slide in a hidden, offscreen window.
// Thumbnails are sent one by one as they are captured.

const { BrowserWindow } = require('electron');

const THUMB_CSS = `
  .controls { display: none !important; }
  *, *::before, *::after { animation: none !important; transition: none !important; }
  html, body { background: #000 !important; }
  body { place-items: center !important; }
  .deck { box-shadow: none !important; }
`;

const frame = (wc) => wc.executeJavaScript(
  'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))');

// One renderer per app window, so two windows don't cancel each other's thumbnails.
function createThumbs() {
  let generation = 0;
  let win = null;

  /**
   * @param {string} file  deck path
   * @param {(t: {gen:number, index:number, total:number, dataUrl:string}) => void} onThumb
   * @returns {Promise<number>} the generation id (newer calls cancel older ones)
   */
  async function renderThumbs(file, onThumb) {
    const gen = ++generation;
    if (!win || win.isDestroyed()) {
      win = new BrowserWindow({
        show: false, width: 1280, height: 720, useContentSize: true, frame: false,
        webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
      });
      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      win.webContents.on('will-navigate', (e) => e.preventDefault());
      win.webContents.setAudioMuted(true);
    }
    const wc = win.webContents;
    await wc.loadFile(file, { query: { 'pptd-thumbnails': '1' } });   // distinct URL for debugging
    if (gen !== generation) return gen;
    await wc.insertCSS(THUMB_CSS);
    const total = await wc.executeJavaScript(`(() => {
      let r = document.querySelectorAll('input.slide-radio');
      if (!r.length) r = document.querySelectorAll('input[type=radio][name=slide]');
      return r.length; })()`);

    for (let i = 0; i < total; i++) {
      if (gen !== generation) return gen;
      await wc.executeJavaScript(`(() => {
        let r = document.querySelectorAll('input.slide-radio');
        if (!r.length) r = document.querySelectorAll('input[type=radio][name=slide]');
        r[${i}].checked = true; })()`);
      await frame(wc);
      wc.invalidate();
      await frame(wc);
      const img = await wc.capturePage();
      if (gen !== generation) return gen;
      const small = img.resize({ width: 400, quality: 'good' });
      onThumb({ gen, index: i, total, dataUrl: 'data:image/jpeg;base64,' + small.toJPEG(82).toString('base64') });
    }
    return gen;
  }

  function disposeThumbs() {
    generation++;
    if (win && !win.isDestroyed()) win.destroy();
    win = null;
  }

  return { render: renderThumbs, dispose: disposeThumbs };
}

module.exports = { createThumbs };
