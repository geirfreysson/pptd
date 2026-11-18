// Verify script-free navigation with real key presses in headless Chrome.
// Usage: node keytest.mjs /absolute/path/deck.html
// Needs Node 22+ (global WebSocket) and Google Chrome.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const deck = process.argv[2];
if (!deck) { console.error('usage: node keytest.mjs /abs/path/deck.html'); process.exit(2); }
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'deckkeys-'))}`, '--window-size=1280,720', `file://${deck}`,
], { stdio: 'ignore' });

let list;
for (let i = 0; i < 40 && !list; i++) {
  await new Promise(r => setTimeout(r, 250));
  try { list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch {}
}
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
let id = 0; const pending = {};
ws.onmessage = e => { const m = JSON.parse(e.data); pending[m.id]?.(m); delete pending[m.id]; };
await new Promise(r => (ws.onopen = r));
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async x => (await send('Runtime.evaluate', { expression: x })).result.result.value;
const key = async (k, vk) => { for (const type of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code: k, windowsVirtualKeyCode: vk }); };
const visible = `[...document.querySelectorAll('.slide')].filter(s => getComputedStyle(s).display !== 'none').map(s => s.id).join()`;

let ok = true;
const check = async (label, want) => { const got = await ev(visible); const pass = got === want; ok &&= pass; console.log(`${pass ? 'PASS' : 'FAIL'} ${label}: visible=${got} (want ${want})`); };
await new Promise(r => setTimeout(r, 500));
await check('start', 's1');
await key('ArrowRight', 39); await check('ArrowRight', 's2');
await key('ArrowRight', 39); await check('ArrowRight', 's3');
await key('ArrowLeft', 37);  await check('ArrowLeft', 's2');
await ev(`document.querySelector('#s2 .controls label[for=r3]').click()`); await check('click ›', 's3');
await key('ArrowRight', 39); await check('ArrowRight after click', 's4');
console.log('script tags:', await ev(`document.scripts.length`), '(must be 0)');
ok &&= (await ev(`document.scripts.length`)) === 0;
ws.close(); chrome.kill(); process.exit(ok ? 0 : 1);
