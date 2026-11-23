#!/usr/bin/env node
// Structural edits to a PPTD v1 deck (docs/pptd-spec.md), so agents only write slide
// content, never the numbering. Used by agents (from the pptd-slides skill folder) and by
// the app (dragging a slide in the drawer).
//
//   node pptd-deck.mjs list   <deck>              outline: number, id, title, layout, words;
//                                                 then a note on layouts the deck repeats
//   node pptd-deck.mjs move   <deck> <from> <to>  move a slide (1-based positions)
//   node pptd-deck.mjs add    <deck> --after <n> [--count <k>]
//                                                 insert k empty slides (default 1) after n (0 = first)
//   node pptd-deck.mjs delete <deck> <n>          remove slide n
//
// Exit 0 = done, 1 = refused (the deck is left as it was), 2 = usage.
//
// The model. Each slide is its <section> plus the comments just before it; those move
// together. Everything tied to a *position* stays with the position: the section's id (sN)
// and the number in its aria-label, its .controls (‹ › targets, "N / total" counter) and
// .progress bar, the radios and the `#rN:checked ~ #sN` rules. When the number of slides
// changes, each position's controls are copied from the nearest old position with the same
// role (first, middle, last) and renumbered. References to a slide's *content* follow it:
// per-slide CSS (`#s3 .chart`) and `for="rN"` jump links inside slide content.
// Every change is checked with the conformance checker; a change that would add a failure
// is refused.

import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { checkHtml } from './pptd-check.mjs';

// ---------------------------------------------------------------- parsing

function sectionSpan(html, n) {
  const open = new RegExp(`<section\\b[^>]*\\bid\\s*=\\s*["']?s${n}(?=["'\\s>])["']?[^>]*>`, 'i').exec(html);
  if (!open) return null;
  const re = /<\/?section\b[^>]*>/gi;
  re.lastIndex = open.index + open[0].length;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) return { tagStart: open.index, openTag: open[0], start: open.index + open[0].length, end: m.index, closeEnd: m.index + m[0].length };
  }
  return null;
}

// End (after the closing tag) of the element whose opening tag ends at `from`.
function elementEnd(html, tag, from) {
  const re = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = from;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    if (m[0].endsWith('/>')) continue;
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return -1;
}

const MARK = (i) => `\u0000chrome${i}\u0000`;
const MARK_RE = /\u0000chrome(\d+)\u0000/g;

// A slide's positional chrome (.controls, .progress) out of its inner HTML, with markers.
function splitChrome(inner) {
  const chrome = [];
  let body = '', pos = 0, m;
  const re = /<([a-z][\w-]*)\b[^>]*\bclass\s*=\s*(["'])(?:(?!\2)[^])*?\b(?:controls|progress)\b(?:(?!\2)[^])*?\2[^>]*>/gi;
  while ((m = re.exec(inner))) {
    if (m.index < pos) continue;
    const end = elementEnd(inner, m[1], m.index + m[0].length);
    if (end < 0) continue;
    body += inner.slice(pos, m.index) + MARK(chrome.length);
    chrome.push(inner.slice(m.index, end));
    pos = end;
    re.lastIndex = end;
  }
  return { body: body + inner.slice(pos), chrome };
}

function joinChrome(body, chrome) {
  let used = 0;
  const out = body.replace(MARK_RE, () => (used < chrome.length ? chrome[used++] : ''));
  return used < chrome.length ? out.replace(/\s*$/, (ws) => `\n${chrome.slice(used).join('\n')}${ws}`) : out;
}

// Whitespace and comments at the end of `text` (they belong to the next slide).
const leadingGapLen = (text) => (/(?:\s*<!--(?:(?!-->)[\s\S])*-->)*\s*$/.exec(text) || [''])[0].length;

export function parseDeck(html) {
  const spans = [];
  for (let n = 1; ; n++) {
    const s = sectionSpan(html, n);
    if (!s) break;
    spans.push(s);
  }
  const total = spans.length;
  if (!total) throw new Error('No slides found: expected <section id="s1"> … (see pptd-spec.md §4).');
  for (let i = 1; i < total; i++) {
    if (spans[i].tagStart < spans[i - 1].closeEnd) throw new Error('Slides are nested inside each other; edit this deck by hand.');
  }
  const slides = [];
  const seps = []; // text between slides that isn't a slide's leading comments (stays put)
  let prevEnd = 0;
  spans.forEach((s, i) => {
    const between = html.slice(prevEnd, s.tagStart);
    const gapLen = leadingGapLen(between);
    const gap = between.slice(between.length - gapLen);
    if (i > 0) seps.push(between.slice(0, between.length - gapLen));
    const { body, chrome } = splitChrome(html.slice(s.start, s.end));
    slides.push({ gap, openTag: s.openTag, body, chrome, close: html.slice(s.end, s.closeEnd), orig: i + 1 });
    if (i === 0) slides.pre = html.slice(0, s.tagStart - gapLen);
    prevEnd = s.closeEnd;
  });
  return { pre: slides.pre, slides, seps, post: html.slice(spans[total - 1].closeEnd), total };
}

// ---------------------------------------------------------------- reading

const stripTags = (h) => h.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z#0-9]+;/gi, 'x').replace(/\s+/g, ' ').trim();

function slideTitle(slide) {
  const a = /aria-label\s*=\s*["'][^"']*?\bSlide\s+\d+\s*[:\u2013\u2014-]\s*([^"']+)["']/i.exec(slide.openTag);
  if (a) return a[1].trim();
  const h = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(slide.body);
  return h ? stripTags(h[1]) : '';
}

export function listSlides(html) {
  const { slides } = parseDeck(html);
  return slides.map((s, i) => {
    const text = stripTags(s.body.replace(MARK_RE, ''));
    const media = (s.body.match(/<(img|video)\b/gi) || []).length;
    return { n: i + 1, id: `s${i + 1}`, title: slideTitle(s), layout: slideLayout(s), words: text ? text.split(' ').length : 0, media, isNew: /<!--\s*pptd:new-slide\b/.test(s.body) };
  });
}

// The slide's main layout: its section class (title, section, photo), else the first of the
// skill's layout classes in its body, else "own" (markup of the deck's own).
const SECTION_LAYOUTS = { 'title-slide': 'title', 'section-slide': 'section', 'photo-slide': 'photo' };
const BODY_LAYOUTS = new Set(['cards', 'steps', 'stats', 'compare', 'bars', 'matrix', 'diagram', 'quote', 'statement', 'timeline',
  'agenda', 'photos', 'people', 'tiers', 'layers', 'data', 'columns', 'refs', 'asks', 'grid', 'path']);
function slideLayout(slide) {
  const own = (/\sclass\s*=\s*["']([^"']*)["']/i.exec(slide.openTag)?.[1] || '').split(/\s+/);
  for (const c of own) if (SECTION_LAYOUTS[c]) return SECTION_LAYOUTS[c];
  for (const m of slide.body.matchAll(/\sclass\s*=\s*["']([^"']*)["']/gi)) {
    for (const c of m[1].split(/\s+/)) if (BODY_LAYOUTS.has(c)) return c;
  }
  return 'own';
}

// Layouts a deck leans on: one on more than a third of its content slides (at least three
// of them), or the same one on neighbouring content slides. Title, section, closing and
// slides of the deck's own markup don't count.
export function layoutRepeats(rows) {
  const content = rows.filter((r) => !['title', 'section', 'own'].includes(r.layout) && !r.isNew);
  const notes = [];
  const count = {};
  for (const r of content) count[r.layout] = (count[r.layout] || 0) + 1;
  for (const [layout, k] of Object.entries(count)) {
    if (k >= 3 && k > content.length / 3) notes.push(`${layout} on ${k} of ${content.length} content slides`);
  }
  for (let i = 0; i < rows.length; ) {
    let j = i;
    while (j + 1 < rows.length && content.includes(rows[i]) && content.includes(rows[j + 1]) && rows[j + 1].layout === rows[i].layout) j++;
    if (j > i) notes.push(`${rows[i].layout} on slides ${rows[i].n}${j > i + 1 ? '–' : ' and '}${rows[j].n} in a row`);
    i = j + 1;
  }
  return notes;
}

// ---------------------------------------------------------------- writing

// Percentages in the deck's own style: a deck that writes "50.0%" gets fixed decimals,
// otherwise one decimal at most with whole numbers bare ("16.7%", "50%").
let pctFixed = 0; // decimals when the deck uses fixed ones, else 0 (set per render)
const fmtPct = (x) => {
  if (pctFixed) return x.toFixed(pctFixed);
  const r = Math.round(x * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

// Chrome from old position q of T, renumbered for new position p of T2.
function renumberChrome(html, q, T, p, T2) {
  if (q === p && T === T2) return html;
  let out = html.replace(/(\bfor\s*=\s*["']?)r(\d+)(?=["'\s>])/gi, (m, pre, k) => `${pre}r${Number(k) - q + p}`);
  out = out.replace(new RegExp(`(>\\s*)${q}(\\s*(?:/|of)\\s*)${T}(\\s*<)`, 'g'), `$1${p}$2${T2}$3`);
  out = out.replace(new RegExp(`(\\b(?:Slide|slide)\\s+)${q}(\\s+of\\s+)${T}\\b`, 'g'), `$1${p}$2${T2}`);
  out = out.replace(/(\bwidth\s*:\s*)([\d.]+)%/gi, (m, pre, v) => {
    const x = Number(v);
    if (Math.abs(x - (q / T) * 100) < 0.15) return `${pre}${fmtPct((p / T2) * 100)}%`;
    if (T > 1 && T2 > 1 && Math.abs(x - ((q - 1) / (T - 1)) * 100) < 0.15) return `${pre}${fmtPct(((p - 1) / (T2 - 1)) * 100)}%`;
    return m;
  });
  return out;
}

const role = (p, T) => (T === 1 ? 'only' : p === 1 ? 'first' : p === T ? 'last' : 'middle');

// Positional chrome for every position of a deck going from T to T2 slides.
function positionalChrome(oldChrome, T, T2) {
  return Array.from({ length: T2 }, (_, i) => {
    const p = i + 1;
    let q;
    if (T2 === T) q = p;
    else if (role(p, T2) === 'first') q = 1;
    else if (role(p, T2) === 'last') q = T;
    else q = Math.min(Math.max(p, 2), T - 1);
    if (role(q, T) !== role(p, T2) && oldChrome.some((c) => c.length)) {
      throw new Error(`This deck has ${T} slide${T === 1 ? '' : 's'}, too few to copy the ‹ › controls for a ${role(p, T2)} slide from. Do this one by hand (SKILL.md §3).`);
    }
    return oldChrome[q - 1].map((c) => renumberChrome(c, q, T, p, T2));
  });
}

function render(deck, order, T2, extraSlide) {
  const { slides, seps, pre, post, total: T } = deck;
  const fixed = slides.flatMap((s) => s.chrome).join('').match(/width\s*:\s*\d+\.(0+)%/);
  pctFixed = fixed ? fixed[1].length : 0;
  const chrome = positionalChrome(slides.map((s) => s.chrome), T, T2);
  const newPos = {}; // original number -> new position (absent = deleted)
  order.forEach((s, i) => { if (s.orig) newPos[s.orig] = i + 1; });
  const remapFor = (body) => body.replace(/(\bfor\s*=\s*["']?)r(\d+)(?=["'\s>])/gi, (m, p1, k) => {
    const to = newPos[k] ?? Math.min(Number(k), T2); // a deleted target points at its neighbour
    return `${p1}r${to}`;
  });
  let out = pre;
  order.forEach((s, i) => {
    const p = i + 1;
    if (i > 0) out += seps[Math.min(i - 1, seps.length - 1)] ?? '';
    const tag = s.openTag
      .replace(/(\bid\s*=\s*["']?)s\d+/i, `$1s${p}`)
      .replace(/(aria-label\s*=\s*["'][^"']*?\bSlide\s+)\d+/i, `$1${p}`);
    out += s.gap + tag + joinChrome(remapFor(s.body), chrome[i]) + s.close;
  });
  out += post;

  // Radios: one per slide, r1…rT2. Added ones copy the last; removed ones go from the end.
  if (T2 !== T) out = resizeRadios(out, T, T2);

  // CSS: per-slide rules follow their slide; switching rules (#rN:checked ~ #sN) are positional.
  out = out.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, a, css, b) => {
    const keep = [];
    css = css.replace(/#r(\d+):checked(\s*~\s*)#s\1\b/g, (m) => { keep.push(m); return `\u0000k${keep.length - 1}\u0000`; });
    css = css.replace(/#s(\d+)\b/g, (m, k) => (newPos[k] ? `#s${newPos[k]}` : Number(k) <= T ? `#pptd-deleted-s${k}` : m));
    css = css.replace(/\u0000k(\d+)\u0000/g, (_x, i) => keep[i]);
    if (T2 > T) {
      css = css.replace(new RegExp(`#r${T}:checked(\\s*~\\s*)#s${T}\\b`, 'g'), (m, sep) => {
        let add = '';
        for (let k = T + 1; k <= T2; k++) add += `, #r${k}:checked${sep}#s${k}`;
        return m + add;
      });
    } else if (T2 < T) {
      for (let k = T; k > T2; k--) {
        css = css.replace(new RegExp(`\\s*,\\s*#r${k}:checked\\s*~\\s*#s${k}\\b(?![\\w-])`, 'g'), '');
        css = css.replace(new RegExp(`#r${k}:checked\\s*~\\s*#s${k}\\b(?![\\w-])\\s*,\\s*`, 'g'), '');
      }
    }
    return a + css + b;
  });
  return out;
}

function resizeRadios(html, T, T2) {
  const radioRe = (k) => new RegExp(`[ \\t]*<input\\b[^>]*\\bid\\s*=\\s*["']?r${k}(?=["'\\s>/])[^>]*>[ \\t]*\\r?\\n?`, 'i');
  if (T2 > T) {
    const last = radioRe(T).exec(html);
    if (!last) throw new Error(`Radio r${T} not found.`);
    let add = '';
    for (let k = T + 1; k <= T2; k++) {
      add += last[0]
        .replace(/(\bid\s*=\s*["']?)r\d+/i, `$1r${k}`)
        .replace(/(aria-label\s*=\s*["'][^"']*?\bSlide\s+)\d+/i, `$1${k}`)
        .replace(/\s(checked|autofocus)(?=[\s>/=])(\s*=\s*(["'])[^"']*\3)?/gi, '');
    }
    const at = last.index + last[0].length;
    return html.slice(0, at) + (last[0].endsWith('\n') ? '' : '\n') + add + html.slice(at);
  }
  for (let k = T; k > T2; k--) {
    const m = radioRe(k).exec(html);
    if (!m) throw new Error(`Radio r${k} not found.`);
    const wasChecked = /\schecked(?=[\s>/=])/i.test(m[0]);
    html = html.slice(0, m.index) + html.slice(m.index + m[0].length);
    if (wasChecked) html = html.replace(radioRe(1), (r1) => r1.replace(/(<input\b)/i, '$1 checked'));
  }
  return html;
}

const range = (a, b) => (a === b ? `Slide ${a}` : `Slides ${a}–${b}`);

// Every operation returns { html, message }; `message` says what moved and the new numbering.

export function moveSlide(html, from, to) {
  const deck = parseDeck(html);
  const T = deck.total;
  if (!(from >= 1 && from <= T && to >= 1 && to <= T)) throw new Error(`Can't move slide ${from} to ${to}: the deck has ${T} slides.`);
  const title = slideTitle(deck.slides[from - 1]);
  if (from === to) return { html, message: `Slide ${from} is already at position ${to}.`, title };
  const order = [...deck.slides];
  order.splice(to - 1, 0, ...order.splice(from - 1, 1));
  const [lo, hi] = from < to ? [from, to] : [to, from];
  return {
    html: render(deck, order, T),
    title,
    message: `Moved slide ${from}${title ? ` ("${title}")` : ''} to position ${to}; it is now <section id="s${to}">. Slides ${lo}–${hi} have new numbers and ids.`,
  };
}

export function addSlide(html, after) {
  const deck = parseDeck(html);
  const T = deck.total;
  if (!(after >= 0 && after <= T)) throw new Error(`--after must be 0–${T} (0 = before the first slide).`);
  const p = after + 1;
  const token = randomBytes(3).toString('hex');
  const ref = deck.slides[Math.min(after, T - 1)];
  const indent = (/\n([ \t]*)$/.exec(ref.gap) || ['', ''])[1];
  const inner = indent + (/^\s*\n([ \t]+)/.exec(ref.body)?.[1]?.slice(indent.length) || '  ');
  const placeholder = `<!-- pptd:new-slide ${token} -->`;
  const chromeCount = ref.chrome.length;
  const body = `\n${inner}${placeholder}\n${inner}<h2>New slide</h2>\n`
    + Array.from({ length: chromeCount }, (_, i) => `${inner}${MARK(i)}\n`).join('') + indent;
  const slide = { gap: `\n\n${indent}`, openTag: `<section id="s${p}" class="slide" aria-label="Slide ${p}: New slide">`, body, chrome: [], close: '</section>', orig: null };
  const order = [...deck.slides];
  order.splice(after, 0, slide);
  return {
    html: render(deck, order, T + 1),
    placeholder: `${placeholder}\n${inner}<h2>New slide</h2>`,
    message: `Added an empty slide at position ${p}: <section id="s${p}">.${p <= T ? ` ${range(p + 1, T + 1)} moved up one.` : ''}\nFill it by replacing these two lines with the slide's content:\n  ${placeholder}\n  <h2>New slide</h2>\nand put its title in the section's aria-label ("Slide ${p}: New slide").`,
  };
}

// Several empty slides in a row, starting after `after`. Each gets its own placeholder.
export function addSlides(html, after, count = 1) {
  if (!(count >= 1 && count <= 50)) throw new Error('--count must be 1–50.');
  if (count === 1) return addSlide(html, after);
  const T = parseDeck(html).total;
  const added = [];
  for (let i = 0; i < count; i++) {
    const r = addSlide(html, after + i);
    html = r.html;
    added.push({ n: after + i + 1, placeholder: r.placeholder });
  }
  const first = after + 1, last = after + count;
  const lines = added.map((a) => `  s${a.n}:\n${a.placeholder.split('\n').map((l) => `    ${l.trim()}`).join('\n')}`).join('\n');
  return {
    html,
    message: `Added ${count} empty slides at positions ${first}–${last} (<section id="s${first}"> … <section id="s${last}">).${last < T + count ? ` ${range(last + 1, T + count)} moved up ${count}.` : ''}\n`
      + `Fill each by replacing its two placeholder lines with that slide's content (any order; each is unique), and put its title in the section's aria-label:\n${lines}`,
  };
}

export function deleteSlide(html, n) {
  const deck = parseDeck(html);
  const T = deck.total;
  if (!(n >= 1 && n <= T)) throw new Error(`Can't delete slide ${n}: the deck has ${T} slides.`);
  if (T === 1) throw new Error("Can't delete the only slide.");
  const title = slideTitle(deck.slides[n - 1]);
  const order = deck.slides.filter((_, i) => i !== n - 1);
  return {
    html: render(deck, order, T - 1),
    title,
    message: `Deleted slide ${n}${title ? ` ("${title}")` : ''}.${n < T ? ` ${range(n + 1, T)} moved down one.` : ''} The deck has ${T - 1} slides.`,
  };
}

// Refuse a change that adds a checker failure the deck didn't already have.
export function verify(before, after, name) {
  const fails = (h) => new Set(checkHtml(h, { name }).results.filter((r) => !r.ok && r.level === 'MUST').map((r) => r.msg.replace(/\s*\(.*\)$/, '')));
  const had = fails(before);
  const added = [...fails(after)].filter((m) => !had.has(m));
  if (added.length) throw new Error(`Refused: the result would fail the PPTD checker (${added.join('; ')}). The deck was not changed; edit it by hand.`);
}

// ---------------------------------------------------------------- CLI

function writeAtomic(file, text) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

const USAGE = `usage:
  node pptd-deck.mjs list   <deck.pptd.html>
  node pptd-deck.mjs move   <deck.pptd.html> <from> <to>
  node pptd-deck.mjs add    <deck.pptd.html> --after <n> [--count <k>]   (0 = before the first slide)
  node pptd-deck.mjs delete <deck.pptd.html> <n>
Slide numbers are 1-based positions, as shown by list.`;

function main(argv) {
  const [cmd, file, ...rest] = argv;
  const int = (v) => (/^\d+$/.test(v ?? '') ? Number(v) : NaN);
  if (!cmd || !file || !['list', 'move', 'add', 'delete'].includes(cmd)) { console.error(USAGE); return 2; }
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch (e) { console.error(`Can't read ${file}: ${e.message}`); return 1; }
  try {
    if (cmd === 'list') {
      const rows = listSlides(html);
      console.log(`${path.basename(file)}: ${rows.length} slides`);
      for (const r of rows) {
        console.log(`${String(r.n).padStart(3)}  ${`s${r.n}`.padEnd(4)} ${r.title || '(no title)'}  · ${r.isNew ? 'NEW, still empty' : r.layout} · ${r.words} words${r.media ? ` · ${r.media} media` : ''}`);
      }
      const notes = layoutRepeats(rows);
      if (notes.length) console.log(`Layouts repeated: ${notes.join('; ')}. Give those slides the layout their content's shape asks for (SKILL.md §6).`);
      return 0;
    }
    let res;
    if (cmd === 'move') {
      const [from, to] = rest.map(int);
      if (Number.isNaN(from) || Number.isNaN(to)) { console.error(USAGE); return 2; }
      res = moveSlide(html, from, to);
    } else if (cmd === 'add') {
      const i = rest.indexOf('--after');
      const after = i >= 0 ? int(rest[i + 1]) : NaN;
      const c = rest.indexOf('--count');
      const count = c >= 0 ? int(rest[c + 1]) : 1;
      if (Number.isNaN(after) || Number.isNaN(count)) { console.error(USAGE); return 2; }
      res = addSlides(html, after, count);
    } else {
      const n = int(rest[0]);
      if (Number.isNaN(n)) { console.error(USAGE); return 2; }
      res = deleteSlide(html, n);
    }
    if (res.html !== html) {
      verify(html, res.html, file);
      writeAtomic(file, res.html);
    }
    console.log(res.message);
    return 0;
  } catch (e) {
    console.error(e.message);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
