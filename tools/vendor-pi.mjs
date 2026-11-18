#!/usr/bin/env node
// Vendors the bundled pi agent and the search tools it uses.
//
// 1. vendor/pi/node_modules: pi from vendor/pi/package-lock.json (`npm ci`, no install
//    scripts: pi and its dependencies ship prebuilt files).
// 2. vendor/tools/<os>-<arch>/: pinned ripgrep (`rg`, pi's grep tool) and fd (`fd`, pi's @-file
//    completion), checked against their SHA-256. Without them pi downloads the latest
//    release from GitHub into ~/.pi/agent/bin on first launch.
//
// <os>-<arch> uses electron-builder's names (mac, linux, win; x64, arm64), so the build
// config can pick the folder with `vendor/tools/mac-${arch}`. By default only this
// machine's target is fetched; set PPTD_TOOL_TARGETS=all (or e.g. "linux-x64,win-x64")
// to fetch others, for building on one OS for another.
//
// Runs after `npm install` and before every build. Skips work that is already done.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PI_DIR = path.join(ROOT, 'vendor', 'pi');
const TOOLS_DIR = path.join(ROOT, 'vendor', 'tools');

// To update: pick the release, then copy each asset's digest from
// `gh api repos/<repo>/releases/tags/<tag> --jq '.assets[] | "\(.name) \(.digest)"'`.
const TOOLS = {
  rg: {
    repo: 'BurntSushi/ripgrep', tag: '15.2.0',
    asset: (triple) => `ripgrep-15.2.0-${triple}`,
    sha256: {
      'mac-arm64': '3750b2e93f37e0c692657da574d7019a101c0084da05a790c83fd335bad973e4',
      'mac-x64': 'af7825fcc69a2afc7a7aea55fc9af90e26421d8f20fe59df32e233c0b8a231c1',
      'linux-arm64': '800b1e7206afe799dfb5a6901f23147cfaabe0e52210538100f61e86e1740915',
      'linux-x64': '33e15bcf1624b25cdd2a55813a47a2f95dbe126268203e76aa6a585d1e7b149c',
      'win-arm64': 'e4abca10c3a64ebea742667dd7009449d49403db5460dd6873e389fa2945360f',
      'win-x64': '71b2fef860abe467217a538ff31de02f5258807c0129f771846f87bd029aafc5',
    },
  },
  fd: {
    repo: 'sharkdp/fd', tag: 'v10.5.2',
    asset: (triple) => `fd-v10.5.2-${triple}`,
    sha256: {
      'mac-arm64': '81bf98a16d3d7230e4a9123fcede243d71ea31a577113476ed43f1cdf4773162',
      'mac-x64': '0f02e6000a8c896cd254cf4dccc7da1e604e77a32c6783609eed5e4cb07785e3',
      'linux-arm64': '63ea52cb31586e6d98efa2f06d73d542f16c7d0c4af0f07b579aaf9714cf907a',
      'linux-x64': '7e2d07fa2b8807642aaec67b7e2972a9fbe4db26fcb340a7372392db42b26694',
      'win-arm64': '0ee570ad513e6e1909642dbd79bf7177cf3457652e912c27726582c0f49df86e',
      'win-x64': '7edac75ef96b7e9a01ebb251a21ee86ea365a09adcfb865f1ec3346a906153b6',
    },
  },
};

// Release targets (Linux: the static musl builds, so they run on any distribution).
const TRIPLES = {
  'mac-arm64': 'aarch64-apple-darwin.tar.gz',
  'mac-x64': 'x86_64-apple-darwin.tar.gz',
  'linux-arm64': 'aarch64-unknown-linux-musl.tar.gz',
  'linux-x64': 'x86_64-unknown-linux-musl.tar.gz',
  'win-arm64': 'aarch64-pc-windows-msvc.zip',
  'win-x64': 'x86_64-pc-windows-msvc.zip',
};

const OS = { darwin: 'mac', linux: 'linux', win32: 'win' };
const hostTarget = `${OS[process.platform]}-${process.arch}`;

function run(cmd, args, opts = {}) {
  // npm is npm.cmd on Windows, which needs a shell.
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`);
}

// ---------------------------------------------------------------- pi

function vendorPi() {
  const stamp = path.join(PI_DIR, 'node_modules', '.package-lock.json');
  const lock = path.join(PI_DIR, 'package-lock.json');
  const cli = path.join(PI_DIR, 'node_modules', '@earendil-works', 'pi-coding-agent', 'dist', 'bundle', 'cli.js');
  if (fs.existsSync(stamp) && fs.existsSync(cli) && fs.statSync(stamp).mtimeMs > fs.statSync(lock).mtimeMs) return;
  run('npm', [fs.existsSync(lock) ? 'ci' : 'install', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: PI_DIR });
  const v = JSON.parse(fs.readFileSync(path.join(path.dirname(path.dirname(path.dirname(cli))), 'package.json'), 'utf8')).version;
  console.log(`vendored pi ${v} -> vendor/pi`);
}

// ---------------------------------------------------------------- rg, fd

async function download(url, sha256) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = createHash('sha256').update(buf).digest('hex');
  if (got !== sha256) throw new Error(`${url}: SHA-256 is ${got}, expected ${sha256}`);
  return buf;
}

function extract(archive, into) {
  fs.mkdirSync(into, { recursive: true });
  // bsdtar (macOS, Windows 10+) reads both formats; GNU tar on Linux doesn't read zip.
  if (archive.endsWith('.zip') && process.platform === 'linux') run('unzip', ['-q', '-o', archive, '-d', into]);
  else run('tar', ['-xf', archive, '-C', into]);
}

function findFile(dir, name) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const f = findFile(p, name); if (f) return f; } else if (e.name === name) return p;
  }
  return null;
}

async function vendorTools(target) {
  const dir = path.join(TOOLS_DIR, target);
  const stampFile = path.join(dir, '.versions.json');
  const want = JSON.stringify(Object.fromEntries(Object.entries(TOOLS).map(([k, t]) => [k, t.sha256[target]])));
  try { if (fs.readFileSync(stampFile, 'utf8') === want) return; } catch {}

  const exe = target.startsWith('win-') ? '.exe' : '';
  const tmp = path.join(TOOLS_DIR, `.tmp-${target}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'licenses'), { recursive: true });
  try {
    for (const [name, t] of Object.entries(TOOLS)) {
      const asset = t.asset(TRIPLES[target]);
      const url = `https://github.com/${t.repo}/releases/download/${t.tag}/${asset}`;
      const archive = path.join(tmp, asset);
      fs.mkdirSync(tmp, { recursive: true });
      fs.writeFileSync(archive, await download(url, t.sha256[target]));
      const out = path.join(tmp, name);
      extract(archive, out);
      const bin = findFile(out, name + exe);
      if (!bin) throw new Error(`${asset}: no ${name + exe} inside`);
      fs.copyFileSync(bin, path.join(dir, name + exe));
      fs.chmodSync(path.join(dir, name + exe), 0o755);
      // Their licences require the notice to travel with the binary.
      const top = path.dirname(bin);
      for (const f of fs.readdirSync(top)) {
        if (/^(LICENSE|COPYING|UNLICENSE)/i.test(f)) fs.copyFileSync(path.join(top, f), path.join(dir, 'licenses', `${name}-${f}`));
      }
      console.log(`vendored ${name} ${t.tag} -> vendor/tools/${target}`);
    }
    fs.writeFileSync(stampFile, want);
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw e;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- main

const spec = process.env.PPTD_TOOL_TARGETS;
const targets = !spec ? [hostTarget] : spec === 'all' ? Object.keys(TRIPLES) : spec.split(',').map((s) => s.trim()).filter(Boolean);
for (const t of targets) if (!TRIPLES[t]) { console.error(`vendor-pi: unknown target ${t} (known: ${Object.keys(TRIPLES).join(', ')})`); process.exit(1); }

try {
  vendorPi();
  for (const t of targets) await vendorTools(t);
} catch (e) {
  console.error(`vendor-pi: ${e.message}`);
  process.exit(1);
}
