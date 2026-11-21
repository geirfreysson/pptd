#!/usr/bin/env node
// Builds each bundled style's starting deck in the skill:
//   tools/style-deck.html (frame, base layouts and example slides, shared by every style)
//   + agent/plugin/skills/pptd-slides/styles/<name>/style.css
//   → agent/plugin/skills/pptd-slides/styles/<name>/template.html
//
// It checks each style with tools/pptd-style.mjs in strict mode (every layout class, no colour
// literals, cqw sizes, a STYLE.md with "Use for"), and each template with the deck checker.
//
//   node tools/build-styles.mjs           write the templates
//   node tools/build-styles.mjs --check   fail if a template is out of date (writes nothing)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BUNDLED_DIR, checkStyle, stylesIn, templateFor } from './pptd-style.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const problems = [];
const names = stylesIn(BUNDLED_DIR);
if (!names.length) problems.push(`no styles in ${BUNDLED_DIR}`);

for (const name of names) {
  const dir = path.join(BUNDLED_DIR, name);
  const res = checkStyle(dir, { strict: true });
  problems.push(...res.errors.map((e) => `styles/${e}`));

  const out = templateFor(dir);
  const target = path.join(dir, 'template.html');
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  if (checkOnly) {
    if (current !== out) problems.push(`styles/${name}/template.html is out of date: run npm run sync-skill`);
  } else if (current !== out) {
    fs.writeFileSync(target, out);
  }
  // The checker wants a *.pptd.html name.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pptd-style-'));
  const copy = path.join(tmp, `${name}.pptd.html`);
  fs.writeFileSync(copy, out);
  const r = spawnSync(process.execPath, [path.join(root, 'tools', 'pptd-check.mjs'), copy], { encoding: 'utf8' });
  fs.rmSync(tmp, { recursive: true, force: true });
  if (r.status !== 0) problems.push(`styles/${name}/template.html fails the checker:\n${r.stdout}${r.stderr}`);
}

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`${checkOnly ? 'checked' : 'built'} style templates: ${names.join(', ')}`);
