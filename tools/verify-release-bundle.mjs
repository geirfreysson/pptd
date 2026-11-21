#!/usr/bin/env node
// Checks that a packaged app carries what it needs at run time, on the OS that built it:
//   node tools/verify-release-bundle.mjs <resources dir>
//     macOS:   dist/mac-arm64/PPTD.app/Contents/Resources
//     Linux:   dist/linux-unpacked/resources
//     Windows: dist/win-unpacked/resources
//
// - the bundled pi (its CLI and its MIT licence) and this OS's ripgrep and fd, with their licences;
// - the agent skill and pi extension, unpacked from the asar;
// - node-pty's native module for this OS, unpacked, and the spec tools main imports;
// - ripgrep and fd actually run.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const res = process.argv[2];
if (!res || !fs.existsSync(res)) { console.error('usage: node tools/verify-release-bundle.mjs <resources dir>'); process.exit(2); }
const exe = process.platform === 'win32' ? '.exe' : '';
const errors = [];
const need = (rel) => { if (!fs.existsSync(path.join(res, rel))) errors.push(`missing ${rel}`); };

need('app.asar');
need('pi/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js');
need(`pi/bin/rg${exe}`);
need(`pi/bin/fd${exe}`);
need('pi/bin/licenses');
need('pi/LICENSE');
need('app.asar.unpacked/agent/pi/pptd-extension.js');
need('app.asar.unpacked/agent/plugin/skills/pptd-slides/SKILL.md');
need('app.asar.unpacked/agent/plugin/skills/pptd-slides/DESIGN.md');
for (const style of ['classic', 'grid', 'bold', 'folio', 'signal', 'atelier']) {
  need(`app.asar.unpacked/agent/plugin/skills/pptd-slides/styles/${style}/template.html`);
  need(`app.asar.unpacked/agent/plugin/skills/pptd-slides/styles/${style}/STYLE.md`);
}
need('app.asar.unpacked/tools/pptd-deck.mjs');
need('app.asar.unpacked/tools/pptd-check.mjs');

// node-pty's native module for this OS (built by electron-builder, or its prebuild).
const ptyDir = path.join(res, 'app.asar.unpacked/node_modules/node-pty');
const nodes = [];
const walk = (d) => { for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (e.name.endsWith('.node')) nodes.push(path.relative(ptyDir, p));
} };
walk(ptyDir);
// node-pty loads build/Release first, then prebuilds/<platform>-<arch>.
const own = nodes.filter((n) => n.replace(/\\/g, '/') === 'build/Release/pty.node' || n.replace(/\\/g, '/') === `prebuilds/${process.platform}-${process.arch}/pty.node`);
if (!own.length) errors.push(`node-pty has no native module for ${process.platform}-${process.arch} (found: ${nodes.join(', ') || 'none'})`);

// pi-tui's native addons: only this OS's may ship.
const others = { darwin: ['linux', 'win32'], linux: ['darwin', 'win32'], win32: ['darwin', 'linux'] }[process.platform] || [];
for (const os of others) {
  if (fs.existsSync(path.join(res, `pi/node_modules/@earendil-works/pi-tui/native/${os}`))) errors.push(`pi-tui native addon for ${os} is bundled`);
}

for (const tool of ['rg', 'fd']) {
  const p = path.join(res, 'pi/bin', tool + exe);
  if (!fs.existsSync(p)) continue;
  const r = spawnSync(p, ['--version'], { encoding: 'utf8' });
  if (r.status !== 0) errors.push(`${tool} --version failed: ${r.error?.message || r.stderr}`);
  else console.log(`${tool}: ${r.stdout.split('\n')[0]}`);
}

if (errors.length) {
  for (const e of errors) console.error(`bundle: ${e}`);
  process.exit(1);
}
console.log(`bundle: OK (${res}; node-pty: ${own.join(', ')})`);
