#!/usr/bin/env node
// After `npm install`: make node-pty's spawn-helper executable (macOS/Linux; npm drops the
// bit), then vendor pi and its search tools (tools/vendor-pi.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform !== 'win32') {
  const prebuilds = path.join(root, 'node_modules', 'node-pty', 'prebuilds');
  for (const d of fs.existsSync(prebuilds) ? fs.readdirSync(prebuilds) : []) {
    const f = path.join(prebuilds, d, 'spawn-helper');
    if (fs.existsSync(f)) fs.chmodSync(f, 0o755);
  }
}
await import('./vendor-pi.mjs');
