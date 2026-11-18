#!/usr/bin/env node
// Checks a release before anything is built:
//   node tools/validate-release.mjs v0.4.0   (a tag build: the tag must match)
//   node tools/validate-release.mjs          (a manual build: only the version is checked)
//
// - package.json and package-lock.json carry the same x.y.z version;
// - the tag, when given, is exactly v<version>;
// - release-draft.md, when a tag is given, starts with exactly "# PPTD v<version>" and has
//   notes under it (the release workflow publishes it as the release notes).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const errors = [];

const version = JSON.parse(read('package.json')).version;
if (!/^\d+\.\d+\.\d+$/.test(version || '')) errors.push(`package.json version "${version}" is not x.y.z`);

const lock = JSON.parse(read('package-lock.json'));
if (lock.version !== version) errors.push(`package-lock.json version ${lock.version} != package.json ${version}`);
if (lock.packages?.['']?.version !== version) errors.push(`package-lock.json packages[""].version ${lock.packages?.['']?.version} != ${version}`);

const tag = (process.argv[2] || '').trim();
if (tag) {
  if (tag !== `v${version}`) errors.push(`tag ${tag} does not match package.json version ${version} (expected v${version})`);
  let draft = '';
  try { draft = read('release-draft.md'); } catch { errors.push('release-draft.md is missing'); }
  if (draft) {
    const [first, ...rest] = draft.split(/\r?\n/);
    if (first !== `# PPTD v${version}`) errors.push(`release-draft.md must start with "# PPTD v${version}" (found "${first}")`);
    if (!rest.join('\n').trim()) errors.push('release-draft.md has no release notes under its heading');
  }
}

if (errors.length) {
  for (const e of errors) console.error(`release: ${e}`);
  process.exit(1);
}
console.log(`release: version ${version}${tag ? `, tag ${tag} and release-draft.md` : ''} OK`);
