#!/usr/bin/env node
// Static conformance check for PPTD v1 files (docs/pptd-spec.md).
// Usage: node tools/pptd-check.mjs deck.pptd.html [more.pptd.html …]
// Exit code 0 = all files pass, 1 = at least one failure.
// Also a module: checkHtml(html, { name, size }) (used by pptd-deck.mjs and the app).
//
// Regex-based on purpose (no dependencies). It checks the rules a machine can check;
// look at the slides yourself as well.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// name: the file name (for the .pptd.html rule); size: bytes (defaults to the HTML's length).
// Returns { results: [{ ok, msg, level }], fails, warns }.
export function checkHtml(html, { name = 'deck.pptd.html', size = Buffer.byteLength(html) } = {}) {
  const results = [];
  const check = (ok, msg, level = 'MUST') => results.push({ ok: !!ok, msg, level });

  // Strip comments so commented-out markup doesn't count.
  const src = html.replace(/<!--[\s\S]*?-->/g, '');
  const head = (src.match(/<head[\s\S]*?<\/head>/i) || [''])[0];
  const tags = (re) => [...src.matchAll(re)].map((m) => m[0]);
  const attr = (tag, name) => {
    const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
    return m ? (m[2] ?? m[3] ?? m[4]) : null;
  };
  const hasAttr = (tag, name) => new RegExp(`\\s${name}(\\s|=|>|/)`, 'i').test(tag);
  const classes = (tag) => (attr(tag, 'class') || '').split(/\s+/);

  // 2. File
  check(path.basename(name).endsWith('.pptd.html'), 'file name ends in .pptd.html');
  check(/^\s*<!doctype html>/i.test(html), '<!doctype html> first');
  check(/<meta\s+charset=["']?utf-8/i.test(head), '<meta charset="utf-8"> in <head>');
  check(/<html[^>]*\slang=/i.test(src), '<html lang="…">');
  check(/<title>[^<]+<\/title>/i.test(head), '<title> set', 'SHOULD');
  check(size < 10 * 1024 * 1024, 'under 10 MB', 'SHOULD');

  // 3. Marker
  const meta = tags(/<meta\b[^>]*>/gi).find((t) => (attr(t, 'name') || '').toLowerCase() === 'pptd');
  check(meta && head.includes(meta), '<meta name="pptd"> in <head>');
  check(meta && attr(meta, 'content') === '1', 'pptd marker content="1"');

  // 4. Structure
  const decks = tags(/<main\b[^>]*>/gi).filter((t) => classes(t).includes('deck'));
  check(decks.length === 1, `exactly one <main class="deck"> (found ${decks.length})`);

  const inputs = tags(/<input\b[^>]*>/gi);
  const radios = inputs.filter((t) => (attr(t, 'name') || '') === 'slide');
  const slideRadios = radios.filter((t) => (attr(t, 'type') || '').toLowerCase() === 'radio' && classes(t).includes('slide-radio'));
  const sections = tags(/<section\b[^>]*>/gi).filter((t) => classes(t).includes('slide'));
  const n = sections.length;

  check(n > 0, `has slides (section.slide: ${n})`);
  check(radios.length === slideRadios.length, 'every name="slide" input is type="radio" class="slide-radio"');
  check(slideRadios.length === n, `one radio per slide (radios ${slideRadios.length}, slides ${n})`);
  check(slideRadios.every((t, i) => attr(t, 'id') === `r${i + 1}`), 'radio ids are r1…rN in order');
  check(sections.every((t, i) => attr(t, 'id') === `s${i + 1}`), 'section ids are s1…sN in order');
  check(slideRadios.filter((t) => hasAttr(t, 'checked')).length === 1, 'exactly one radio is checked');
  check(slideRadios.every((t) => !hasAttr(t, 'hidden')), 'radios are not hidden');
  check(slideRadios.length && hasAttr(slideRadios[0], 'autofocus'), 'r1 has autofocus', 'SHOULD');

  const lastRadio = slideRadios.length ? src.lastIndexOf(slideRadios.at(-1)) : -1;
  const firstSection = sections.length ? src.indexOf(sections[0]) : -1;
  check(lastRadio >= 0 && firstSection > lastRadio, 'all radios come before the first slide');

  const style = tags(/<style\b[^>]*>[\s\S]*?<\/style>/gi).join('\n');
  const missingSel = [];
  for (let i = 1; i <= n; i++) {
    if (!new RegExp(`#r${i}:checked\\s*~\\s*#s${i}\\b`).test(style)) missingSel.push(i);
  }
  check(!missingSel.length, `CSS has #rN:checked ~ #sN for every slide${missingSel.length ? ' (missing ' + missingSel.join(',') + ')' : ''}`);
  check(!/\.slide-radio\s*{[^}]*(display\s*:\s*none|visibility\s*:\s*hidden)/i.test(style), 'radios not display:none / visibility:hidden');
  check(!/:target\b/.test(style), 'no :target slide switching');

  // 5. Controls
  const navLabels = tags(/<label\b[^>]*>/gi).filter((t) => /^r\d+$/.test(attr(t, 'for') || ''));
  const controlsCount = tags(/<[a-z]+\b[^>]*>/gi).filter((t) => classes(t).includes('controls')).length;
  check(!navLabels.length || controlsCount > 0, 'in-page ‹ › labels are inside .controls');

  // 6. Sizing
  check(/\.deck\s*{[^}]*container-type\s*:\s*inline-size/i.test(style), '.deck has container-type: inline-size');
  check(/\.deck\s*{[^}]*177\.7\d*vh/i.test(style) && /56\.25vw/i.test(style), '.deck is a 16:9 box (177.78vh / 56.25vw)');
  check(/(^|[\s,}])body\s*{[^}]*background/i.test(style) || /html\s*,\s*body\s*{[^}]*background/i.test(style), 'body has a background colour');
  check(/cqw/.test(style), 'font sizes use container units (cqw)', 'SHOULD');

  // 8. Content and safety
  check(!/<script\b/i.test(src), 'no <script>');
  check(!/\son[a-z]+\s*=/i.test(src.replace(/<style[\s\S]*?<\/style>/gi, '')), 'no inline on*= handlers');
  check(!/javascript:/i.test(src), 'no javascript: URLs');
  check(!/<(iframe|object|embed)\b/i.test(src), 'no iframe/object/embed');
  check(!/<form\b[^>]*\saction=/i.test(src), 'no <form action>');
  const ext = [
    ...tags(/<(img|source|video|audio|image|use)\b[^>]*>/gi).map((t) => attr(t, 'src') || attr(t, 'href') || attr(t, 'xlink:href') || ''),
    ...tags(/<link\b[^>]*>/gi).map((t) => attr(t, 'href') || ''),
    ...[...style.matchAll(/url\(\s*['"]?([^'")]+)/gi)].map((m) => m[1]),
    ...[...style.matchAll(/@import\s+(?:url\()?['"]?([^'");]+)/gi)].map((m) => m[1]),
  ].filter((u, i, a) => /^(https?:)?\/\//i.test(u) && a.indexOf(u) === i);
  check(!ext.length, `no external resources${ext.length ? ': ' + ext.slice(0, 3).join(', ') : ''}`);
  check(/@media\s+print/i.test(style), '@media print block', 'SHOULD');

  const fails = results.filter((r) => !r.ok && r.level === 'MUST').length;
  const warns = results.filter((r) => !r.ok && r.level !== 'MUST').length;
  return { results, fails, warns };
}

function main(files) {
  if (!files.length) {
    console.error('usage: node tools/pptd-check.mjs <file.pptd.html> [...]');
    process.exit(2);
  }
  let failed = false;
  for (const file of files) {
    const { results, fails, warns } = checkHtml(fs.readFileSync(file, 'utf8'), { name: file, size: fs.statSync(file).size });
    console.log(`\n${file}`);
    for (const r of results) {
      const tag = r.ok ? 'PASS' : r.level === 'MUST' ? 'FAIL' : 'WARN';
      console.log(`  ${tag}  ${r.msg}`);
    }
    console.log(`  → ${fails ? 'NOT CONFORMING' : 'CONFORMING'} (${fails} fail, ${warns} warn)`);
    if (fails) failed = true;
  }
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
