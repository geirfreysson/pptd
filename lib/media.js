// Insert dropped images / videos into a slide of a PPTD deck.
//
// Media is embedded as a data: URI (PPTD decks are single files). The URI sits
// on a line of its own so agents can edit around it without reading it.

const fs = require('fs');
const path = require('path');
const { nativeImage } = require('electron');

const IMAGE = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif',
  '.heic': 'image/heic', '.heif': 'image/heic', '.tif': 'image/tiff', '.tiff': 'image/tiff', '.bmp': 'image/bmp',
};
const VIDEO = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg' };

const MAX_IMAGE_EDGE = 2560;   // bigger photos are scaled down; plenty for a 4K projector at 16:9
const VIDEO_WARN_BYTES = 25 * 1024 * 1024;

const MEDIA_CSS = `<style id="pptd-media">
    /* Added by PPTD for dropped images and video. Keep the pptd-media class on figures. */
    .pptd-media { flex: 1 1 0; min-height: 0; margin: 1.4cqw 0 .6cqw; display: flex; align-items: center; justify-content: center; }
    .pptd-media > img, .pptd-media > video { display: block; max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;
      border-radius: clamp(6px, .8cqw, 14px); box-shadow: 0 1.2cqw 3.2cqw rgba(18, 27, 90, .20), 0 .15cqw .45cqw rgba(18, 27, 90, .12); }
    .pptd-media > video { background: #0b1033; }
    .pptd-media + .pptd-media { margin-top: 0; }
    @media print { .pptd-media > img, .pptd-media > video { box-shadow: none; } }
  </style>`;

const kindOf = (file) => {
  const ext = path.extname(file).toLowerCase();
  if (IMAGE[ext]) return 'image';
  if (VIDEO[ext]) return 'video';
  return null;
};

// macOS: decode formats Chromium can't (HEIC from iPhones) with the built-in sips tool.
function viaSips(file) {
  const os = require('os');
  const { execFileSync } = require('child_process');
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pptd-')), 'image.jpg');
  try {
    execFileSync('/usr/bin/sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92', file, '--out', tmp], { stdio: 'ignore', timeout: 30000 });
    return nativeImage.createFromPath(tmp);
  } catch { return null; } finally { fs.rmSync(path.dirname(tmp), { recursive: true, force: true }); }
}

// Returns { mime, data: Buffer, note } for an image, re-encoded where useful.
function encodeImage(file) {
  const ext = path.extname(file).toLowerCase();
  const raw = fs.readFileSync(file);
  // Formats Chromium shows as-is and we shouldn't touch (animation / vector).
  if (['.gif', '.svg', '.webp', '.avif'].includes(ext)) return { mime: IMAGE[ext], data: raw };

  let img = nativeImage.createFromPath(file);
  if (img.isEmpty() && process.platform === 'darwin') img = viaSips(file) || img;   // HEIC, some TIFFs
  if (img.isEmpty()) {
    if (['.png', '.jpg', '.jpeg'].includes(ext)) return { mime: IMAGE[ext], data: raw };
    throw new Error(`Can't read ${path.basename(file)} as an image.`);
  }
  const { width, height } = img.getSize();
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
  const needsConvert = !['.png', '.jpg', '.jpeg'].includes(ext);   // HEIC, TIFF, BMP → browser format
  if (scale === 1 && !needsConvert) return { mime: IMAGE[ext], data: raw };

  const out = scale < 1 ? img.resize({ width: Math.round(width * scale), quality: 'best' }) : img;
  const note = scale < 1 ? `scaled to ${Math.round(width * scale)}×${Math.round(height * scale)}` : null;
  if (ext === '.png') return { mime: 'image/png', data: out.toPNG(), note };
  return { mime: 'image/jpeg', data: out.toJPEG(88), note };
}

const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function figureHtml(kind, mime, data, alt) {
  const uri = `data:${mime};base64,${data.toString('base64')}`;
  if (kind === 'image') {
    return `      <figure class="pptd-media pptd-image">\n<img alt="${escAttr(alt)}" src="${uri}">\n      </figure>\n`;
  }
  return `      <figure class="pptd-media pptd-video">\n<video controls playsinline preload="metadata" aria-label="${escAttr(alt)}" src="${uri}"></video>\n      </figure>\n`;
}

// Photo slots: <figure class="photo" data-brief="…"></figure> placeholders that a style
// draws (the frame's base layer). Returns the slots in slide n, in document order (which is
// also the order the deck view's querySelectorAll sees them).
const SLOT_OPEN = /<figure\b[^>]*\bclass\s*=\s*["'](?:[^"']*\s)?photo(?:\s[^"']*)?["'][^>]*>/gi;
function photoSlots(html, n) {
  const sec = findSection(html, n);
  if (!sec) return [];
  const slots = [];
  SLOT_OPEN.lastIndex = sec.start;
  let m;
  while ((m = SLOT_OPEN.exec(html)) && m.index < sec.end) {
    const inner = m.index + m[0].length;
    const close = html.indexOf('</figure>', inner);   // a slot holds no nested figure
    if (close < 0 || close > sec.end) break;
    const body = html.slice(inner, close);
    const brief = m[0].match(/data-brief\s*=\s*"([^"]*)"/i)?.[1] || '';
    slots.push({ inner, close, body, empty: !/<img\b/i.test(body), brief });
  }
  return slots;
}

// Fill a photo slot in slide n with an image. `slot` is the index of the slot the image was
// dropped on (filled or not: a filled one is replaced); without it, the first empty slot.
// Returns { html, brief } or null when there is no slot to fill. The data: URI goes on a line
// of its own, as with dropped figures.
function fillPhotoSlot(html, n, slot, mime, data, alt) {
  const slots = photoSlots(html, n);
  const target = Number.isInteger(slot) && slot >= 0 && slots[slot] ? slots[slot] : slots.find((s) => s.empty);
  if (!target) return null;
  const img = `\n<img alt="${escAttr(alt)}" src="data:${mime};base64,${data.toString('base64')}">\n`;
  const rest = target.body.replace(/\n?<img\b[^>]*>\n?/gi, '');   // drop a previous photo, keep the caption
  return { html: html.slice(0, target.inner) + img + rest + html.slice(target.close), brief: target.brief };
}

// Locate <section id="sN"> … </section> (handles nested <section>s).
function findSection(html, n) {
  const open = new RegExp(`<section\\b[^>]*\\bid\\s*=\\s*["']?s${n}["'\\s>][^>]*>`, 'i').exec(html)
    || new RegExp(`<section\\b[^>]*\\bid\\s*=\\s*["']?s${n}["']?>`, 'i').exec(html);
  if (!open) return null;
  const start = open.index + open[0].length;
  const re = /<\/?section\b[^>]*>/gi;
  re.lastIndex = start;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) return { start, end: m.index };
  }
  return null;
}

// Pure function: returns the new HTML with the figure inserted into slide n (1-based).
function insertFigure(html, n, figure) {
  const sec = findSection(html, n);
  if (!sec) throw new Error(`Slide ${n} (<section id="s${n}">) not found in the deck.`);
  const body = html.slice(sec.start, sec.end);
  // Insert before the slide's absolutely-positioned chrome (footer / controls / progress),
  // so the figure takes the remaining height below the headline.
  const chrome = /\n?[ \t]*<(div|nav|footer)\b[^>]*class\s*=\s*["'][^"']*\b(footer|controls|progress)\b/i.exec(body);
  let at = chrome ? sec.start + chrome.index : sec.end;
  // Start on a fresh line.
  let fig = figure;
  if (html[at] !== '\n' && html[at - 1] !== '\n') fig = '\n' + fig;
  if (html[at] === '\n') at += 1;
  let out = html.slice(0, at) + fig + html.slice(at);

  if (!/<style\b[^>]*id\s*=\s*["']pptd-media["']/i.test(out)) {
    const head = out.search(/<\/head>/i);
    if (head < 0) throw new Error('Deck has no </head>.');
    out = out.slice(0, head) + '  ' + MEDIA_CSS + '\n' + out.slice(head);
  }
  return out;
}

module.exports = { kindOf, encodeImage, figureHtml, insertFigure, findSection, photoSlots, fillPhotoSlot, VIDEO, VIDEO_WARN_BYTES };
