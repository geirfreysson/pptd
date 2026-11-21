#!/usr/bin/env node
// PPTD styles: list, check, build and preview a style folder (STYLE.md + style.css).
// Dependency-free; the source copy is tools/pptd-style.mjs, `npm run sync-skill` copies it
// into the bundled skill, where agents run it. tools/build-styles.mjs uses it for the
// bundled styles.
//
//   node pptd-style.mjs list
//       Bundled styles (the skill's styles/) and the user's own (PPTD_USER_STYLES), with
//       what each is for.
//   node pptd-style.mjs check <style folder>
//       Fails on: a colour literal (styles take every colour from the brand tokens), px
//       sizes (only 1px hairlines and 999px pill radii; SVG .dg-* rules excepted), a missing
//       core layout class, a STYLE.md without "# Style: <name>" and "**Use for:**", or a
//       user style named like a bundled one. Older layout classes only warn.
//   node pptd-style.mjs build <style folder>
//       Writes <folder>/template.html: the shared deck skeleton with this style's CSS.
//   node pptd-style.mjs preview <style folder> [--brand brand.md|brand.css] [--slides 1,5,7] [--out DIR]
//       Builds a preview deck with that brand (default: the template's neutral brand) and
//       screenshots it through the running PPTD app. Prints one PNG path per slide.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// In the skill: next to this file. In the repo (tools/): the skill's copy and the source skeleton.
const inSkill = fs.existsSync(path.join(here, 'SKILL.md'));
export const BUNDLED_DIR = inSkill ? path.join(here, 'styles') : path.join(here, '..', 'agent', 'plugin', 'skills', 'pptd-slides', 'styles');
export const SKELETON = inSkill ? path.join(here, 'deck-skeleton.html') : path.join(here, 'style-deck.html');

// The layout vocabulary (SKILL.md §1). Every style must draw the core; bundled styles draw all.
// The newer layouts (photos, people, agenda, tiers, layers, data, columns, refs) are drawn by
// the frame's base layer for every style, so they are not listed.
export const CORE = [
  'eyebrow', 'lead', 'footer', 'content', 'statement', 'key', 'hl',
  'title-slide', 'section-slide', 'section-num', 'section-text',
  'cards', 'card', 'num', 'steps', 'step', 'stats', 'stat', 'value', 'label', 'delta',
  'compare', 'win', 'split', 'bars', 'bar', 'val', 'fill', 'cat', 'est', 'takeaway',
  'quote', 'timeline', 'now', 'goal', 'when', 'asks',
  'matrix', 'status', 'diagram', 'dg-box', 'dg-label', 'dg-sub', 'dg-arrow', 'dg-arrowhead', 'dg-step', 'dg-step-text',
];
export const OLDER = ['title-mark', 'unit', 'grid', 'two', 'three', 'four', 'panel', 'tag', 'ready', 'proven', 'build', 'callout', 'amber', 'path', 'node', 'arrow', 'green', 'blue'];

const NAME = /^[a-z][a-z0-9-]{1,30}$/;
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

export function stylesIn(dir) {
  if (!isDir(dir)) return [];
  return fs.readdirSync(dir).filter((n) => fs.existsSync(path.join(dir, n, 'style.css'))).sort();
}

// "**Use for:** …" from a STYLE.md, one line.
export function useFor(styleDir) {
  try {
    const md = fs.readFileSync(path.join(styleDir, 'STYLE.md'), 'utf8');
    const m = md.match(/\*\*Use for:\*\*\s*([\s\S]*?)(?:\n\s*\n|\n\*\*)/);
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
  } catch { return ''; }
}

/** Check a style folder. → { name, errors: [], warnings: [] } */
export function checkStyle(dir, { strict = false } = {}) {
  dir = path.resolve(dir);
  const name = path.basename(dir);
  const errors = [], warnings = [];
  const where = (f) => `${name}/${f}`;
  if (!NAME.test(name)) errors.push(`the folder name "${name}" is the style's name: lowercase letters, digits and -, 2–31 characters`);
  const bundled = path.resolve(path.dirname(dir)) === path.resolve(BUNDLED_DIR);
  if (!bundled && stylesIn(BUNDLED_DIR).includes(name)) errors.push(`"${name}" is a bundled style's name: choose another`);

  const cssFile = path.join(dir, 'style.css');
  if (!fs.existsSync(cssFile)) { errors.push(`${where('style.css')} is missing`); return { name, errors, warnings }; }
  const css = fs.readFileSync(cssFile, 'utf8');
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  if (!new RegExp(`/\\*\\s*Style: ${name}\\.`).test(css)) errors.push(`${where('style.css')} must start with a "/* Style: ${name}. …" comment describing the look`);
  if (/<\/?style\b/i.test(css)) errors.push(`${where('style.css')} holds CSS only, without <style> tags`);
  if (/@import|url\(\s*['"]?(?!data:)[a-z]+:/i.test(code)) errors.push(`${where('style.css')} loads something external (@import or a remote url()): decks are self-contained`);

  const unquoted = code.replace(/"[^"]*"|'[^']*'/g, '""');   // font names like "Arial Black"
  for (const m of unquoted.matchAll(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|(?<![\w-])(?:white|black)(?![\w-])/gi)) {
    errors.push(`${where('style.css')}: colour literal "${m[0]}": take colours from the brand tokens (var(--ink), color-mix(…)) or the --white/status tokens`);
  }
  for (const rule of code.split('}')) {
    const [selector = '', body = ''] = rule.split('{');
    if (/\.dg-/.test(selector)) continue;   // SVG user units scale with the viewBox
    for (const m of body.matchAll(/(?<![\w.-])(\d*\.?\d+)px\b/g)) {
      if (m[1] !== '1' && m[1] !== '999') errors.push(`${where('style.css')}: "${m[0]}" in ${selector.trim()}: sizes are cqw (1cqw = 12.8px at 1280×720); only 1px hairlines and 999px pill radii stay in px`);
    }
  }
  const has = (c) => new RegExp(`\\.${c}(?![\\w-])`).test(code);
  for (const c of CORE) if (!has(c)) errors.push(`${where('style.css')} doesn't style .${c} (a core layout class)`);
  for (const c of OLDER) if (!has(c)) (strict ? errors : warnings).push(`${where('style.css')} doesn't style .${c}${strict ? '' : ' (an older layout class: decks using it fall back to plain text)'}`);

  const mdFile = path.join(dir, 'STYLE.md');
  if (!fs.existsSync(mdFile)) errors.push(`${where('STYLE.md')} is missing`);
  else {
    const md = fs.readFileSync(mdFile, 'utf8');
    if (!new RegExp(`^# Style: ${name}\\s*$`, 'm').test(md)) errors.push(`${where('STYLE.md')} must start with "# Style: ${name}"`);
    if (!useFor(dir)) errors.push(`${where('STYLE.md')} needs a "**Use for:** …" line (the agent chooses styles by it)`);
  }
  return { name, errors, warnings };
}

/** The style's starting deck: the shared skeleton with its CSS. */
export function templateFor(dir) {
  const name = path.basename(path.resolve(dir));
  const css = fs.readFileSync(path.join(dir, 'style.css'), 'utf8').replace(/\s+$/, '');
  return fs.readFileSync(SKELETON, 'utf8').replace('{{STYLE_NAME}}', name).replace('{{STYLE_CSS}}', css);
}

// The :root tokens of a brand: a .css file, or the ```css block of a brand.md.
function brandCss(file) {
  const text = fs.readFileSync(file, 'utf8');
  const css = /\.md$/i.test(file) ? (text.match(/```css\s*([\s\S]*?)```/) || [])[1] : text;
  if (!css || !/:root\s*\{/.test(css)) throw new Error(`No :root { … } brand tokens in ${file}`);
  return css.trim();
}

function preview(dir, { brand, slides, out }) {
  const name = path.basename(path.resolve(dir));
  let deck = templateFor(dir);
  if (brand) {
    const css = brandCss(brand).replace(/\$/g, '$$$$');
    deck = deck.replace(/(<style id="pptd-brand">)[\s\S]*?(<\/style>)/, `$1\n    /* Brand: ${path.basename(brand)} (preview). */\n    ${css}\n  $2`);
  }
  const outDir = out ? path.resolve(out) : path.join(os.tmpdir(), 'pptd-style-preview', name);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${name}-preview.pptd.html`);
  fs.writeFileSync(file, deck);
  const app = path.join(here, inSkill ? 'pptd-app.mjs' : path.join('..', 'agent', 'plugin', 'skills', 'pptd-slides', 'pptd-app.mjs'));
  const r = spawnSync(process.execPath, [app, 'shot', file, slides || 'all', '--out', outDir], { stdio: 'inherit' });
  return r.status ?? 1;
}

// ---------------------------------------------------------------- CLI

function main(argv) {
  const [cmd, target, ...rest] = argv;
  const opt = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--brand') opt.brand = rest[++i];
    else if (rest[i] === '--slides') opt.slides = rest[++i];
    else if (rest[i] === '--out') opt.out = rest[++i];
    else if (rest[i] === '--strict') opt.strict = true;
  }
  if (cmd === 'list') {
    const user = process.env.PPTD_USER_STYLES;
    for (const n of stylesIn(BUNDLED_DIR)) console.log(`${n} (bundled): ${useFor(path.join(BUNDLED_DIR, n))}`);
    for (const n of stylesIn(user)) console.log(`${n} (yours, ${path.join(user, n)}): ${useFor(path.join(user, n))}`);
    if (!user) console.log('(PPTD_USER_STYLES is not set: run from an agent started by PPTD to see the user\'s own styles)');
    return 0;
  }
  if (!['check', 'build', 'preview'].includes(cmd) || !target) {
    console.error('usage: node pptd-style.mjs list\n       node pptd-style.mjs check|build <style folder>\n       node pptd-style.mjs preview <style folder> [--brand brand.md|brand.css] [--slides 1,5,7] [--out DIR]');
    return 2;
  }
  const dir = path.resolve(target);
  if (!isDir(dir)) { console.error(`No such folder: ${dir}`); return 2; }
  const res = checkStyle(dir, opt);
  for (const w of res.warnings) console.log(`  warn  ${w}`);
  for (const e of res.errors) console.log(`  FAIL  ${e}`);
  if (res.errors.length) { console.log(`→ ${res.name}: ${res.errors.length} to fix`); return 1; }
  if (cmd === 'check') { console.log(`→ ${res.name}: OK${res.warnings.length ? ` (${res.warnings.length} warnings)` : ''}`); return 0; }
  fs.writeFileSync(path.join(dir, 'template.html'), templateFor(dir));
  if (cmd === 'build') { console.log(`→ wrote ${path.join(dir, 'template.html')}`); return 0; }
  return preview(dir, opt);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
