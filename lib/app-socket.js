// A local socket the agent's tools use to ask the running app for work it does better than
// a script: slide screenshots and the keyboard-navigation test, rendered by PPTD itself
// (lib/shot.js) rather than by an outside browser. The skill's pptd-app.mjs is the client.
//
// Protocol: one JSON request line in, one JSON reply line out, then the connection closes.
//   {"cmd":"shot","deck":"/abs/deck.pptd.html","slides":[3,5]|null,"width":1280,"height":720,"out":"/abs/dir"|null}
//     -> {"ok":true,"files":["/abs/dir/deck-s03-1280x720.png", …],"total":N}
//   {"cmd":"keys","deck":"/abs/deck.pptd.html"} -> {"ok":true|false,"lines":[…]}
//   {"cmd":"render","file":"/abs/design.html","width":1280,"height":720,"out":"/abs/dir"|null}
//     -> {"ok":true,"files":[…]}  any HTML page (a downloaded design), scripts and network off
//   errors -> {"ok":false,"error":"…"}
// The socket file is only accessible to the user (0600 in a 0700 folder on macOS/Linux).
// Agents find it through the PPTD_SOCKET environment variable.

const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { captureSlides, keyTest, renderPage } = require('./shot');

const MAX_SIDE = 4096;

function socketPath(userData) {
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\pptd-${crypto.createHash('sha1').update(userData).digest('hex').slice(0, 12)}`;
  }
  const p = path.join(userData, 'pptd.sock');
  // Unix socket paths are limited to ~104 bytes on macOS.
  return Buffer.byteLength(p) < 100 ? p : path.join(os.tmpdir(), `pptd-${process.getuid()}.sock`);
}

const defaultOutDir = (deck) =>
  path.join(os.tmpdir(), 'pptd-shots', path.basename(deck).replace(/\.pptd\.html?$|\.html?$/i, ''));

async function run(req) {
  if (req.cmd === 'render') {
    const file = typeof req.file === 'string' ? path.resolve(req.file) : '';
    if (!file || !/\.html?$/i.test(file) || !fs.existsSync(file)) throw new Error(`No such HTML file: ${req.file}`);
    const width = Number.isInteger(req.width) ? req.width : 1280;
    const height = Number.isInteger(req.height) ? req.height : 720;
    if (width < 200 || height < 200 || width > MAX_SIDE || height > MAX_SIDE) throw new Error(`Size ${width}x${height} is out of range (200–${MAX_SIDE}).`);
    const base = path.basename(file).replace(/(\.dc)?\.html?$/i, '').replace(/[^\w.-]+/g, '-');
    const out = typeof req.out === 'string' && req.out ? path.resolve(req.out) : path.join(os.tmpdir(), 'pptd-render', base);
    fs.mkdirSync(out, { recursive: true });
    const pages = await renderPage(file, { width, height });
    const files = pages.map(({ name, image }) => {
      const f = path.join(out, `${base}-${name}.png`);
      fs.writeFileSync(f, image.toPNG());
      return f;
    });
    return { ok: true, files };
  }
  const deck = typeof req.deck === 'string' ? path.resolve(req.deck) : '';
  if (!deck || !/\.html?$/i.test(deck) || !fs.existsSync(deck)) throw new Error(`No such deck: ${req.deck}`);

  if (req.cmd === 'keys') return keyTest(deck);

  if (req.cmd === 'shot') {
    const width = Number.isInteger(req.width) ? req.width : 1280;
    const height = Number.isInteger(req.height) ? req.height : 720;
    if (width < 200 || height < 200 || width > MAX_SIDE || height > MAX_SIDE) throw new Error(`Size ${width}x${height} is out of range (200–${MAX_SIDE}).`);
    const slides = Array.isArray(req.slides) ? req.slides.map((n) => n - 1) : null;
    const out = typeof req.out === 'string' && req.out ? path.resolve(req.out) : defaultOutDir(deck);
    fs.mkdirSync(out, { recursive: true });
    const shots = await captureSlides(deck, { slides, width, height, controls: true });
    const base = path.basename(deck).replace(/\.pptd\.html?$|\.html?$/i, '');
    const pad = String(shots[0]?.total || 1).length;
    const files = shots.map(({ index, image }) => {
      const f = path.join(out, `${base}-s${String(index + 1).padStart(Math.max(2, pad), '0')}-${width}x${height}.png`);
      fs.writeFileSync(f, image.toPNG());
      return f;
    });
    return { ok: true, files, total: shots[0]?.total ?? 0 };
  }
  throw new Error(`Unknown command: ${req.cmd}`);
}

// Requests run one at a time: each opens its own offscreen window.
function startAppSocket(userData) {
  const file = socketPath(userData);
  if (process.platform !== 'win32') { try { fs.rmSync(file, { force: true }); } catch {} }
  let queue = Promise.resolve();
  const server = net.createServer((conn) => {
    let buf = '';
    conn.setEncoding('utf8');
    conn.on('error', () => {});
    conn.on('data', (d) => {
      buf += d;
      if (buf.length > 1 << 20) return conn.destroy();
      const nl = buf.indexOf('\n');
      if (nl < 0) return;
      let req;
      try { req = JSON.parse(buf.slice(0, nl)); } catch { return conn.end(JSON.stringify({ ok: false, error: 'Bad request' }) + '\n'); }
      queue = queue.then(() => run(req)).then(
        (res) => conn.end(JSON.stringify(res) + '\n'),
        (e) => conn.end(JSON.stringify({ ok: false, error: e.message || String(e) }) + '\n'));
    });
  });
  server.on('error', (e) => console.error('PPTD socket:', e.message));
  server.listen(file, () => { if (process.platform !== 'win32') { try { fs.chmodSync(file, 0o600); } catch {} } });
  return { file, close: () => { server.close(); if (process.platform !== 'win32') { try { fs.rmSync(file, { force: true }); } catch {} } } };
}

module.exports = { startAppSocket, socketPath };
