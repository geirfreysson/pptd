#!/usr/bin/env node
// Ask the running PPTD app to make, open, screenshot or test a deck. PPTD renders the deck
// itself, exactly as it shows it; no browser is needed. Works from an agent started by PPTD
// (it sets PPTD_SOCKET, and PPTD_SESSION so the app knows which window's agent is asking).
//
//   node pptd-app.mjs new deck.pptd.html --style NAME [--slides N] [--brand default|style|FILE] [--title TEXT]
//       Makes a new deck from the style's template and opens it in this agent's PPTD window:
//       the frame, the style block, the brand block (default: the user's default brand, else
//       the style's own colours; `style`: the style's own colours; or a brand.md / .css file),
//       N slides (at least 3, default 3): the template's title slide, N-2 empty slides, and
//       the template's closing slide. Refuses to overwrite a file. Prints the slides to fill.
//   node pptd-app.mjs open deck.pptd.html
//       Shows that deck in this agent's PPTD window.
//   node pptd-app.mjs shot deck.pptd.html [SLIDES] [--size WxH] [--out DIR]
//       SLIDES: 3 | 2,5 | 1-4 | all (default all). Size default 1280x720.
//       Prints one PNG path per slide. Default folder: <tmp>/pptd-shots/<deck name>/.
//   node pptd-app.mjs keys deck.pptd.html
//       Presses → → ←, clicks ›, presses → again, and checks there are no <script> tags.
//       Prints PASS/FAIL lines; exits 1 on any FAIL.
//   node pptd-app.mjs render design.html [--size WxH] [--out DIR]
//       Renders any HTML page (a downloaded design, e.g. a Claude Design export) with its
//       scripts removed and the network off: one PNG per top-level <section>, or per screen.
//       Prints one PNG path per page.
//   node pptd-app.mjs end-check
//       Used by PPTD's Claude Code Stop hook, not by agents: prints a hook decision when a
//       run that wrote files ends with no deck on screen.

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const USAGE = `usage: node pptd-app.mjs new <deck.pptd.html> --style <name> [--slides N] [--brand default|style|<brand.md>] [--title <text>]
       node pptd-app.mjs open <deck>
       node pptd-app.mjs shot <deck> [3|2,5|1-4|all] [--size 1280x720] [--out DIR]
       node pptd-app.mjs keys <deck>
       node pptd-app.mjs render <page.html> [--size 1280x720] [--out DIR]`;
const usage = () => { console.error(USAGE); process.exit(2); };
const fail = (msg, code = 1) => { console.error(msg); process.exit(code); };

const session = process.env.PPTD_SESSION || null;

function ask(req) {
  const sock = process.env.PPTD_SOCKET;
  if (!sock) return Promise.reject(Object.assign(new Error('PPTD_SOCKET is not set: run this from an agent started by the PPTD app (View › Agent Terminal).'), { code: 3 }));
  return new Promise((resolve, reject) => {
    const conn = net.createConnection(sock);
    let buf = '';
    conn.setEncoding('utf8');
    conn.on('connect', () => conn.write(JSON.stringify({ ...req, session }) + '\n'));
    conn.on('data', (d) => { buf += d; });
    conn.on('error', (e) => reject(Object.assign(new Error(`Can't reach PPTD (${e.code || e.message}). Is the app still running?`), { code: 3 })));
    conn.on('end', () => {
      try { resolve(JSON.parse(buf)); } catch { reject(Object.assign(new Error('PPTD sent no reply.'), { code: 3 })); }
    });
  });
}

const [cmd, target, ...rest] = process.argv.slice(2);

// ---------------------------------------------------------------- end-check (Stop hook)

if (cmd === 'end-check') {
  // Never fails the hook: no reply, no decision.
  try {
    const res = await ask({ cmd: 'end-check' });
    if (res.ok && res.remind) console.log(JSON.stringify({ decision: 'block', reason: res.remind }));
  } catch {}
  process.exit(0);
}

if (!['new', 'open', 'shot', 'keys', 'render'].includes(cmd) || !target) usage();
const file = path.resolve(target);

// ---------------------------------------------------------------- new

async function newDeck() {
  const opt = { slides: 3 };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i], v = rest[i + 1];
    if (a === '--style' && v) { opt.style = v; i++; }
    else if (a === '--brand' && v) { opt.brand = v; i++; }
    else if (a === '--title' && v) { opt.title = v; i++; }
    else if (a === '--slides' && /^\d+$/.test(v || '')) { opt.slides = +v; i++; }
    else usage();
  }
  if (!opt.style) fail('new: name a style with --style (node pptd-style.mjs list shows them).', 2);
  if (!(opt.slides >= 3 && opt.slides <= 50)) fail('new: --slides must be 3–50 (for a shorter deck, delete slides afterwards with pptd-deck.mjs).', 2);
  if (!/\.html?$/i.test(file)) fail(`new: ${file} must end in .pptd.html.`, 2);
  if (fs.existsSync(file)) fail(`new: ${file} already exists; choose another name, or edit that deck.`);

  const { BUNDLED_DIR, templateFor, brandCss, brandName, designPalette } = await import('./pptd-style.mjs');
  const { deleteSlide, addSlides, listSlides } = await import('./pptd-deck.mjs');
  const { checkHtml } = await import('./pptd-check.mjs');

  // The style: bundled first (those names can't be taken), then the user's own.
  const candidates = [path.join(BUNDLED_DIR, opt.style), process.env.PPTD_USER_STYLES && path.join(process.env.PPTD_USER_STYLES, opt.style)].filter(Boolean);
  const dir = /^[a-z][a-z0-9-]{1,30}$/.test(opt.style) && candidates.find((d) => fs.existsSync(path.join(d, 'style.css')));
  if (!dir) fail(`new: no style called "${opt.style}" (node pptd-style.mjs list shows them).`);
  let html = fs.existsSync(path.join(dir, 'template.html')) ? fs.readFileSync(path.join(dir, 'template.html'), 'utf8') : templateFor(dir);

  // The brand: the user's default, the style's own colours, or a file.
  const palette = () => { try { return designPalette(fs.readFileSync(path.join(dir, 'STYLE.md'), 'utf8')); } catch { return null; } };
  let brand;
  const def = process.env.PPTD_BRAND_FILE;
  const want = opt.brand || 'default';
  if (want === 'default' && def && fs.existsSync(def)) brand = { name: brandName(def), css: brandCss(def), note: `the user's default brand "${brandName(def)}"` };
  else if (want === 'default' || want === 'style') {
    const css = palette();
    brand = css
      ? { name: `${opt.style} (its own colours)`, css, own: true, note: `the ${opt.style} style's own colours${want === 'default' ? ' (no default brand is set up)' : ''}` }
      : { name: null, css: null, note: `the template's neutral brand (the ${opt.style} style lists no palette of its own)` };
  } else {
    const f = path.resolve(want);
    try { brand = { name: brandName(f), css: brandCss(f), note: `the brand in ${f}` }; } catch (e) { fail(`new: ${e.message}`); }
  }
  const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  if (brand.css) {
    const comment = brand.name.replace(/\*\//g, '* /');
    html = html.replace(/(<style id="pptd-brand">)[\s\S]*?(<\/style>)/, (_m, a, b) => `${a}\n    /* Brand: ${comment}. */\n    ${brand.css.replace(/\n/g, '\n    ')}\n  ${b}`);
    html = html.replace(/(<meta name="pptd-brand" content=")[^"]*(")/, (_m, a, b) => `${a}${attr(brand.name)}${b}`);
  }
  if (opt.title) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${attr(opt.title)}</title>`);

  // The template's title slide, N-2 empty slides, its closing slide. (The deck tool can't
  // go below 3 slides, so: keep title, slide 2 and closing; add; then drop slide 2.)
  const rows = listSlides(html);
  const closing = (rows.findLast((r) => /closing/i.test(r.title || '')) || rows[rows.length - 1]).n;
  for (let n = rows.length; n >= 3; n--) if (n !== closing) html = deleteSlide(html, n).html;
  const r = addSlides(html, 1, opt.slides - 2);
  html = deleteSlide(r.html, opt.slides).html;
  const added = r.message;
  const fails = checkHtml(html, { name: file }).results.filter((r) => !r.ok && r.level === 'MUST');
  if (fails.length) fail(`new: the new deck would fail the checker (${fails.map((r) => r.msg).join('; ')}); nothing was written.`);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html, { flag: 'wx' });
  console.log(`Created ${file}: the ${opt.style} style with ${brand.note}, ${opt.slides} slide${opt.slides > 1 ? 's' : ''}.`);
  if (brand.css && !brand.own) console.log(`Add the brand's rules, in one line, to the comment in <style id="pptd-brand">.`);
  console.log(`Slide 1 is the template's title slide and slide ${opt.slides} its closing slide: replace their text.`);
  const empty = opt.slides === 3 ? 'Slide 2 is empty.' : `Slides 2–${opt.slides - 1} are empty.`;
  console.log(`${empty} ${added.replace(/^Added[^\n]*\n/, '')}`);
  return file;
}

// ---------------------------------------------------------------- the rest

try {
  if (cmd === 'new') {
    await newDeck();
    const res = await ask({ cmd: 'open', deck: file }).catch((e) => ({ ok: false, error: e.message }));
    console.log(res.ok ? (res.message || 'PPTD is showing it.') : `PPTD didn't open it: ${res.error.replace(/\.$/, '')}. Run: node pptd-app.mjs open ${JSON.stringify(file)}`);
    process.exit(0);
  }

  const req = cmd === 'render' ? { cmd, file } : { cmd, deck: file };
  if (cmd === 'shot' || cmd === 'render') {
    let slides = 'all';
    for (let i = 0; i < rest.length; i++) {
      const a = rest[i];
      if (a === '--size') {
        const m = /^(\d+)x(\d+)$/.exec(rest[++i] || '');
        if (!m) usage();
        req.width = +m[1]; req.height = +m[2];
      } else if (a === '--out') {
        if (!rest[i + 1]) usage();
        req.out = path.resolve(rest[++i]);
      } else slides = a;
    }
    if (slides !== 'all' && cmd === 'render') usage();
    if (slides !== 'all') {
      const list = [];
      for (const part of slides.split(',')) {
        const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
        if (!m) usage();
        const a = +m[1], b = m[2] ? +m[2] : a;
        for (let n = Math.min(a, b); n <= Math.max(a, b); n++) list.push(n);
      }
      req.slides = [...new Set(list)];
    }
  } else if (rest.length) usage();

  const res = await ask(req);
  if (res.error) fail(res.error);
  if (cmd === 'open') console.log(res.message || 'PPTD is showing it.');
  else if (cmd === 'shot' || cmd === 'render') for (const f of res.files) console.log(f);
  else {
    for (const l of res.lines) console.log(l);
    process.exit(res.ok ? 0 : 1);
  }
} catch (e) {
  fail(e.message, e.code || 1);
}
