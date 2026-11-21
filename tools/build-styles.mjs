#!/usr/bin/env node
// Builds each style's starting deck in the bundled skill:
//   tools/style-deck.html (frame + example slides, shared by every style)
//   + agent/plugin/skills/pptd-slides/styles/<name>/style.css
//   → agent/plugin/skills/pptd-slides/styles/<name>/template.html
//
// It also checks what keeps styles and brands independent:
// - a style takes every colour from the brand's tokens (no hex, rgb(), hsl() or named colours);
// - sizes are cqw, with px only for 1px hairlines, 999px pill radii and inside SVG diagram
//   rules (.dg-*);
// - every style draws every layout class, so any deck can switch to any style.
//
//   node tools/build-styles.mjs           write the templates
//   node tools/build-styles.mjs --check   fail if a template is out of date (writes nothing)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const skeletonFile = path.join(root, 'tools', 'style-deck.html');
const stylesDir = path.join(root, 'agent', 'plugin', 'skills', 'pptd-slides', 'styles');
const checkOnly = process.argv.includes('--check');

// The layout vocabulary (SKILL.md §1). Every style must style each of these.
const CLASSES = [
  'eyebrow', 'lead', 'footer', 'content', 'statement', 'key', 'hl',
  'title-slide', 'title-mark', 'section-slide', 'section-num', 'section-text',
  'cards', 'card', 'num', 'steps', 'step', 'stats', 'stat', 'value', 'unit', 'label', 'delta',
  'compare', 'win', 'split', 'bars', 'bar', 'val', 'fill', 'cat', 'est', 'takeaway',
  'quote', 'timeline', 'now', 'goal', 'when', 'asks',
  'grid', 'two', 'three', 'four', 'panel', 'tag', 'ready', 'proven', 'build', 'callout', 'amber',
  'path', 'node', 'arrow', 'matrix', 'status', 'green', 'blue',
  'diagram', 'dg-box', 'dg-label', 'dg-sub', 'dg-arrow', 'dg-arrowhead', 'dg-step', 'dg-step-text',
];

const problems = [];
const skeleton = fs.readFileSync(skeletonFile, 'utf8');
const names = fs.readdirSync(stylesDir).filter((n) => fs.existsSync(path.join(stylesDir, n, 'style.css'))).sort();
if (!names.length) problems.push(`no styles in ${stylesDir}`);

for (const name of names) {
  const dir = path.join(stylesDir, name);
  const css = fs.readFileSync(path.join(dir, 'style.css'), 'utf8').replace(/\s+$/, '');
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const where = `styles/${name}/style.css`;

  if (!new RegExp(`/\\*\\s*Style: ${name}\\.`).test(css)) problems.push(`${where}: must start with a "/* Style: ${name}. …" comment`);
  if (!fs.existsSync(path.join(dir, 'STYLE.md'))) problems.push(`styles/${name}/STYLE.md is missing`);

  for (const m of code.matchAll(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|(?<![\w-])(?:white|black)(?![\w-])/gi)) {
    problems.push(`${where}: colour literal "${m[0]}": use the brand tokens (var(--ink), color-mix(…)) or --white/status tokens`);
  }
  for (const rule of code.split('}')) {
    const [selector = '', body = ''] = rule.split('{');
    if (/\.dg-/.test(selector)) continue;   // SVG user units scale with the viewBox
    for (const m of body.matchAll(/(?<![\w.-])(\d*\.?\d+)px\b/g)) {
      if (m[1] !== '1' && m[1] !== '999') problems.push(`${where}: "${m[0]}" in ${selector.trim()}: sizes are cqw (only 1px hairlines and 999px pill radii stay in px)`);
    }
  }
  for (const c of CLASSES) {
    if (!new RegExp(`\\.${c}(?![\\w-])`).test(code)) problems.push(`${where}: doesn't style .${c}`);
  }

  const out = skeleton.replace('{{STYLE_NAME}}', name).replace('{{STYLE_CSS}}', css);
  const target = path.join(dir, 'template.html');
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  if (checkOnly) {
    if (current !== out) problems.push(`styles/${name}/template.html is out of date: run npm run sync-skill`);
  } else if (current !== out) {
    fs.writeFileSync(target, out);
  }
  if (!checkOnly || current === out) {
    // The checker wants a *.pptd.html name.
    const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pptd-style-')), `${name}.pptd.html`);
    fs.writeFileSync(copy, out);
    const r = spawnSync(process.execPath, [path.join(root, 'tools', 'pptd-check.mjs'), copy], { encoding: 'utf8' });
    fs.rmSync(path.dirname(copy), { recursive: true, force: true });
    if (r.status !== 0) problems.push(`styles/${name}/template.html fails the checker:\n${r.stdout}${r.stderr}`);
  }
}

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`${checkOnly ? 'checked' : 'built'} style templates: ${names.join(', ')}`);
