#!/usr/bin/env node
// Ask the running PPTD app to screenshot slides or test keyboard navigation. PPTD renders the
// deck itself, exactly as it shows it; no browser is needed. Works from an agent started by
// PPTD (it sets PPTD_SOCKET).
//
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

import net from 'node:net';
import path from 'node:path';

const usage = () => {
  console.error('usage: node pptd-app.mjs shot <deck> [3|2,5|1-4|all] [--size 1280x720] [--out DIR]\n       node pptd-app.mjs keys <deck>\n       node pptd-app.mjs render <page.html> [--size 1280x720] [--out DIR]');
  process.exit(2);
};

const [cmd, deckArg, ...rest] = process.argv.slice(2);
if (!['shot', 'keys', 'render'].includes(cmd) || !deckArg) usage();
const deck = path.resolve(deckArg);

const req = cmd === 'render' ? { cmd, file: deck } : { cmd, deck };
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
}

const sock = process.env.PPTD_SOCKET;
if (!sock) {
  console.error('PPTD_SOCKET is not set: run this from an agent started by the PPTD app (View › Agent Terminal).');
  process.exit(3);
}

const conn = net.createConnection(sock);
let buf = '';
conn.setEncoding('utf8');
conn.on('connect', () => conn.write(JSON.stringify(req) + '\n'));
conn.on('data', (d) => { buf += d; });
conn.on('error', (e) => {
  console.error(`Can't reach PPTD (${e.code || e.message}). Is the app still running?`);
  process.exit(3);
});
conn.on('end', () => {
  let res;
  try { res = JSON.parse(buf); } catch { console.error('PPTD sent no reply.'); process.exit(3); }
  if (res.error) { console.error(res.error); process.exit(1); }
  if (cmd === 'shot' || cmd === 'render') {
    for (const f of res.files) console.log(f);
  } else {
    for (const l of res.lines) console.log(l);
    process.exit(res.ok ? 0 : 1);
  }
});
