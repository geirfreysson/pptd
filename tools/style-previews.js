// Contact sheets of the bundled styles, for agents (styles/<name>/preview.jpg: what the style
// is meant to look like) and for the website (site/static/img/styles/<name>.jpg).
// Each sheet shows nine slides of the style's template in the palette it was designed with
// (read from its STYLE.md), or the neutral brand when it lists none.
//
//   npm run style-previews        (runs: electron tools/style-previews.js)
// Run it after changing a style or the example slides, then commit the images.

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

app.on('window-all-closed', () => {});
const root = path.join(__dirname, '..');
const stylesDir = path.join(root, 'agent', 'plugin', 'skills', 'pptd-slides', 'styles');
const siteDir = path.join(root, 'site', 'static', 'img', 'styles');
const SLIDES = [1, 4, 5, 7, 9, 12, 14, 16, 21];   // title, statement, cards, stats, chart, layers, photo, people, closing

// "--ink #12171d · --paper #f5f6f7 · …", font `…` → a :root block.
function designPalette(md) {
  const para = md.split(/\n\s*\n/).find((p) => /palette it was designed with/i.test(p));
  if (!para) return null;
  const flat = para.replace(/\s+/g, ' ');
  const tokens = [...flat.matchAll(/(--[a-z-]+)\s+((?:linear-gradient\([^)]*\)\)?|#[0-9a-f]{3,8}))/gi)].map((m) => `${m[1]}: ${m[2]};`);
  const font = flat.match(/font\s+`([^`]+)`/i)?.[1];
  if (tokens.length < 8) return null;
  return `:root { ${tokens.join(' ')}${font ? ` --font: ${font};` : ''} }`;
}

async function shoot(file, n) {
  const win = new BrowserWindow({ show: false, width: 1280, height: 720, useContentSize: true, webPreferences: { offscreen: true } });
  await win.loadFile(file);
  await win.webContents.insertCSS('.controls { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }');
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
  const out = [];
  for (const i of n) {
    await win.webContents.executeJavaScript(`document.querySelectorAll('input.slide-radio')[${i - 1}].checked = true`);
    await new Promise((r) => setTimeout(r, 120));
    out.push((await win.webContents.capturePage()).toDataURL());
  }
  win.destroy();
  return out;
}

async function sheet(images, file) {
  const html = `<!doctype html><style>body{margin:0;background:#d9dce1;width:1452px}div{display:grid;grid-template-columns:repeat(3,480px);gap:6px;padding:0}img{width:480px;height:270px;display:block}</style><div>${images.map((s) => `<img src="${s}">`).join('')}</div>`;
  const tmp = path.join(os.tmpdir(), `pptd-sheet-${process.pid}.html`);
  fs.writeFileSync(tmp, html);
  const win = new BrowserWindow({ show: false, width: 1452, height: 822, useContentSize: true, webPreferences: { offscreen: true } });
  await win.loadFile(tmp);
  await new Promise((r) => setTimeout(r, 300));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 1452, height: 822 });
  fs.writeFileSync(file, img.toJPEG(82));
  win.destroy();
  fs.rmSync(tmp, { force: true });
}

app.whenReady().then(async () => {
  fs.mkdirSync(siteDir, { recursive: true });
  for (const name of fs.readdirSync(stylesDir).filter((n) => fs.existsSync(path.join(stylesDir, n, 'template.html'))).sort()) {
    const dir = path.join(stylesDir, name);
    let deck = fs.readFileSync(path.join(dir, 'template.html'), 'utf8');
    const palette = designPalette(fs.readFileSync(path.join(dir, 'STYLE.md'), 'utf8'));
    if (palette) deck = deck.replace(/(<style id="pptd-brand">)[\s\S]*?(<\/style>)/, `$1\n    ${palette}\n  $2`);
    const tmp = path.join(os.tmpdir(), `pptd-preview-${name}.pptd.html`);
    fs.writeFileSync(tmp, deck);
    const images = await shoot(tmp, SLIDES);
    fs.rmSync(tmp, { force: true });
    await sheet(images, path.join(dir, 'preview.jpg'));
    fs.copyFileSync(path.join(dir, 'preview.jpg'), path.join(siteDir, `${name}.jpg`));
    console.log(`${name}: preview.jpg${palette ? '' : ' (neutral brand: no palette in STYLE.md)'}`);
  }
  app.exit(0);
});
