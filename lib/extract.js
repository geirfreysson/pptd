// Turns a dropped document into Markdown for the agent: Word (.docx), Excel (.xlsx),
// PowerPoint (.pptx) and plain text (.txt, .md, .csv, .tsv, .json). No dependencies: the
// Office formats are zip archives of XML, read with zlib and scanned with regular
// expressions (never a DTD-resolving parser). Pictures inside .docx/.pptx are copied out
// next to the Markdown and linked from it, so the agent can put them on slides.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const LIMITS = {
  inputBytes: 200 * 1048576,     // the dropped file
  textBytes: 4 * 1048576,        // a plain-text file read as is
  entryBytes: 64 * 1048576,      // one decompressed zip entry (zip bombs stop here)
  totalBytes: 256 * 1048576,     // everything decompressed from one file
  imageBytes: 25 * 1048576,      // one picture copied out
  images: 80,
  sheetRows: 2000,
  sheetCols: 60,
  markdownChars: 2 * 1048576,
};

const OFFICE = new Set(['.docx', '.xlsx', '.pptx']);
const TEXT = new Set(['.txt', '.md', '.markdown', '.csv', '.tsv', '.json']);
const LEGACY = { '.doc': '.docx', '.xls': '.xlsx', '.ppt': '.pptx' };
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

const ext = (p) => path.extname(p).toLowerCase();
// 'office', 'text', 'legacy' (old binary Office: not supported) or null.
const kindOf = (p) => (OFFICE.has(ext(p)) ? 'office' : TEXT.has(ext(p)) ? 'text' : LEGACY[ext(p)] ? 'legacy' : null);

// ---------------------------------------------------------------- zip

function openZip(file) {
  const size = fs.statSync(file).size;
  if (size > LIMITS.inputBytes) throw new Error(`it is larger than ${LIMITS.inputBytes / 1048576} MB`);
  const buf = fs.readFileSync(file);
  // End of central directory: the last 22+ bytes (a comment may follow it).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("it isn't a valid Office file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  if (p === 0xffffffff) throw new Error('it is too large to read');
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error("it isn't a valid Office file");
    const flags = buf.readUInt16LE(p + 8), method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    entries.set(name, { flags, method, csize, usize, local });
    p += 46 + nlen + xlen + clen;
  }
  let used = 0;
  const read = (name, max = LIMITS.entryBytes) => {
    const e = entries.get(name);
    if (!e) return null;
    if (e.flags & 1) throw new Error('it is password-protected');
    const l = e.local;
    if (l + 30 > buf.length || buf.readUInt32LE(l) !== 0x04034b50) throw new Error("it isn't a valid Office file");
    const start = l + 30 + buf.readUInt16LE(l + 26) + buf.readUInt16LE(l + 28);
    const data = buf.subarray(start, start + e.csize);
    const room = Math.min(max, LIMITS.totalBytes - used);
    if (room <= 0) throw new Error('it holds too much data to read');
    let out;
    if (e.method === 0) out = data;
    else if (e.method === 8) {
      try { out = zlib.inflateRawSync(data, { maxOutputLength: room }); }
      catch (err) { throw new Error(err.code === 'ERR_BUFFER_TOO_LARGE' ? 'it holds too much data to read' : "it isn't a valid Office file"); }
    } else throw new Error('it uses a compression PPTD can\'t read');
    if (out.length > room) throw new Error('it holds too much data to read');
    used += out.length;
    return out;
  };
  const text = (name) => { const b = read(name); return b && b.toString('utf8'); };
  return { names: () => [...entries.keys()], has: (n) => entries.has(n), read, text, size: (n) => entries.get(n)?.usize ?? 0 };
}

// ---------------------------------------------------------------- xml helpers

const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (m, e) => {
  if (e[0] === '#') {
    const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    try { return String.fromCodePoint(n); } catch { return ''; }
  }
  return { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e.toLowerCase()];
});
const attr = (tag, name) => {
  const m = new RegExp(`\\s${name.replace(':', '\\:')}\\s*=\\s*("([^"]*)"|'([^']*)')`).exec(tag);
  return m ? decode(m[2] ?? m[3]) : null;
};
const all = (xml, re) => [...xml.matchAll(re)];

// Relationships of a part: id → { target (zip path), type, external }.
function rels(zip, part) {
  const dir = path.posix.dirname(part);
  const xml = zip.text(`${dir}/_rels/${path.posix.basename(part)}.rels`) || '';
  const map = new Map();
  for (const [tag] of all(xml, /<Relationship\b[^>]*>/g)) {
    const target = attr(tag, 'Target') || '';
    const external = attr(tag, 'TargetMode') === 'External';
    const resolved = external ? target : target.startsWith('/') ? target.slice(1) : path.posix.normalize(path.posix.join(dir, target));
    map.set(attr(tag, 'Id'), { target: resolved, type: attr(tag, 'Type') || '', external });
  }
  return map;
}

// Markdown table: the first row is the header; pipes and line breaks inside cells escaped.
function mdTable(rows) {
  if (!rows.length) return '';
  const width = Math.max(...rows.map((r) => r.length));
  const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();
  const line = (r) => `| ${Array.from({ length: width }, (_, i) => cell(r[i])).join(' | ')} |`;
  return [line(rows[0]), `| ${Array(width).fill('---').join(' | ')} |`, ...rows.slice(1).map(line)].join('\n');
}

// ---------------------------------------------------------------- pictures

// Copies a picture out of the zip once; returns its path relative to the Markdown, or null.
function pictureSaver(zip, outDir, mediaName) {
  const saved = new Map();
  let count = 0;
  const save = (zipPath) => {
    if (saved.has(zipPath)) return saved.get(zipPath);
    let rel = null;
    const x = path.posix.extname(zipPath).toLowerCase();
    if (IMAGE_EXT.has(x) && count < LIMITS.images && zip.size(zipPath) <= LIMITS.imageBytes) {
      try {
        const data = zip.read(zipPath, LIMITS.imageBytes);
        if (data) {
          const name = `image${++count}${x === '.jpeg' ? '.jpg' : x}`;
          fs.mkdirSync(path.join(outDir, mediaName), { recursive: true });
          fs.writeFileSync(path.join(outDir, mediaName, name), data);
          rel = `${mediaName}/${name}`;
        }
      } catch { rel = null; }
    }
    saved.set(zipPath, rel);
    return rel;
  };
  return { save, count: () => count };
}

// ---------------------------------------------------------------- docx

function docxStyles(zip) {
  const xml = zip.text('word/styles.xml') || '';
  const map = new Map();             // styleId → { level: heading 1-6 or 0, list, ilvl }
  for (const [block] of all(xml, /<w:style\b[\s\S]*?<\/w:style>/g)) {
    const id = attr(block.slice(0, block.indexOf('>') + 1), 'w:styleId');
    if (!id) continue;
    const name = (attr(/<w:name\b[^>]*>/.exec(block)?.[0] || '', 'w:val') || '').toLowerCase();
    const lvl = attr(/<w:outlineLvl\b[^>]*>/.exec(block)?.[0] || '', 'w:val');
    let level = 0;
    if (name === 'title') level = 1;
    else if (/^heading \d$/.test(name)) level = Number(name.slice(-1));
    else if (lvl != null && Number(lvl) < 9) level = Number(lvl) + 1;
    // List styles carry their numbering themselves ("List Bullet 2" is the second level).
    const list = /<w:numPr\b/.test(block) || /^list (bullet|number)/.test(name);
    const ilvl = Number(attr(/<w:ilvl\b[^>]*>/.exec(block)?.[0] || '', 'w:val') ?? NaN);
    map.set(id, { level: Math.min(level, 6), list, ilvl: Number.isFinite(ilvl) ? ilvl : Math.max(0, Number(/ (\d)$/.exec(name)?.[1] || 1) - 1) });
  }
  return map;
}

function docx(zip, pics) {
  const xml = zip.text('word/document.xml');
  if (!xml) throw new Error("it isn't a Word document");
  const styles = docxStyles(zip);
  const relMap = rels(zip, 'word/document.xml');
  const out = [];
  let para = null;                   // { text, level, list, ilvl }
  let inText = false;
  let tables = [];                   // stack of { rows, row, cell }
  let headings = 0, paragraphs = 0;
  const tok = /<(\/?)(w:p|w:tbl|w:tr|w:tc|w:t|w:tab|w:br|w:cr|w:pStyle|w:outlineLvl|w:numPr|w:ilvl|a:blip|v:imagedata)\b([^>]*?)(\/?)>|([^<]+)/g;
  for (const m of xml.matchAll(tok)) {
    const [, close, name, rest, self, text] = m;
    if (text != null) { if (inText && para) para.text += decode(text); continue; }
    const tag = `<${name}${rest}>`;
    if (name === 'w:p') {
      if (!close && !self) para = { text: '', level: 0, list: false, ilvl: 0 };
      else if (close && para) {
        const t = para.text.replace(/[ \t]+/g, ' ').trim();
        const table = tables.at(-1);
        if (table) { if (table.cell != null) table.cell.push(t); }
        else if (t) {
          paragraphs++;
          if (para.level) { headings++; out.push(`${'#'.repeat(para.level)} ${t}`); }
          else if (para.list) out.push(`${'  '.repeat(para.ilvl)}- ${t}`);
          else out.push(t);
        }
        para = null;
      }
    } else if (name === 'w:t') inText = !close && !self;
    else if (!para && name !== 'w:tbl' && name !== 'w:tr' && name !== 'w:tc') continue;
    else if (name === 'w:tab' && !close) para.text += '\t';
    else if ((name === 'w:br' || name === 'w:cr') && !close) para.text += '\n';
    else if (name === 'w:pStyle' && !close) {
      const st = styles.get(attr(tag, 'w:val'));
      if (st) { para.level = st.level || para.level; if (st.list) { para.list = true; para.ilvl = st.ilvl; } }
    }
    else if (name === 'w:outlineLvl' && !close) { const l = Number(attr(tag, 'w:val')); if (l < 9) para.level = Math.min(l + 1, 6); }
    else if (name === 'w:numPr' && !close) para.list = true;
    else if (name === 'w:ilvl' && !close) para.ilvl = Math.min(Number(attr(tag, 'w:val')) || 0, 8);
    else if ((name === 'a:blip' || name === 'v:imagedata') && !close) {
      const r = relMap.get(attr(tag, 'r:embed') || attr(tag, 'r:id'));
      const rel = r && !r.external ? pics.save(r.target) : null;
      if (rel) para.text += ` ![picture](${rel}) `;
    } else if (name === 'w:tbl') {
      if (!close) tables.push({ rows: [], row: null, cell: null });
      else {
        const t = tables.pop();
        if (!t) continue;
        const outer = tables.at(-1);
        if (outer) { if (outer.cell) outer.cell.push(t.rows.map((r) => r.join(' / ')).join('; ')); }
        else if (t.rows.length) out.push(mdTable(t.rows));
      }
    } else if (name === 'w:tr') {
      const t = tables.at(-1);
      if (!t) continue;
      if (!close) t.row = [];
      else if (t.row) { if (t.row.some((c) => c)) t.rows.push(t.row); t.row = null; }
    } else if (name === 'w:tc') {
      const t = tables.at(-1);
      if (!t) continue;
      if (!close && !self) t.cell = [];
      else if (close && t.cell) { t.row?.push(t.cell.filter(Boolean).join(' ')); t.cell = null; }
    }
  }
  const summary = `${paragraphs} paragraph${paragraphs === 1 ? '' : 's'}${headings ? `, ${headings} heading${headings === 1 ? '' : 's'}` : ''}`;
  // Blank lines between blocks, but list items stay together.
  const body = out.map((b, i) => (i && /^\s*- /.test(b) && /^\s*- /.test(out[i - 1]) ? '\n' : i ? '\n\n' : '') + b).join('');
  return { body, summary };
}

// ---------------------------------------------------------------- xlsx

const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
function xlsxFormats(zip) {
  const xml = zip.text('xl/styles.xml') || '';
  const custom = new Map();
  for (const [tag] of all(xml, /<numFmt\b[^>]*>/g)) custom.set(Number(attr(tag, 'numFmtId')), attr(tag, 'formatCode') || '');
  const cellXfs = /<cellXfs\b[\s\S]*?<\/cellXfs>/.exec(xml)?.[0] || '';
  return all(cellXfs, /<xf\b[^>]*>/g).map(([tag]) => {
    const id = Number(attr(tag, 'numFmtId') || 0);
    const code = (custom.get(id) || '').replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
    if (BUILTIN_DATE.has(id) || (code && /[dmyhs]/i.test(code) && !/^[#0.,%\s]*$/.test(code))) return /[hs]/i.test(code) || [18, 19, 20, 21, 22, 45, 46, 47].includes(id) ? 'datetime' : 'date';
    if (id === 9 || id === 10 || code.includes('%')) return 'percent';
    return '';
  });
}
const colIndex = (ref) => { let n = 0; for (const ch of /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() || '') n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
const tidyNumber = (n) => String(Number.isInteger(n) ? n : Number(n.toPrecision(12)));

function excelDate(serial, kind, date1904) {
  const ms = Math.round(((date1904 ? serial + 1462 : serial) - 25569) * 86400000);
  if (!Number.isFinite(ms)) return tidyNumber(serial);
  const iso = new Date(ms).toISOString();
  if (kind === 'date' || iso.endsWith('T00:00:00.000Z')) return iso.slice(0, 10);
  return serial < 1 ? iso.slice(11, 16) : `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

function xlsx(zip) {
  const wb = zip.text('xl/workbook.xml');
  if (!wb) throw new Error("it isn't an Excel workbook");
  const date1904 = /<workbookPr\b[^>]*date1904\s*=\s*["'](1|true)["']/.test(wb);
  const relMap = rels(zip, 'xl/workbook.xml');
  const shared = all((zip.text('xl/sharedStrings.xml') || ''), /<si\b[^>]*>([\s\S]*?)<\/si>/g)
    .map(([, si]) => all(si.replace(/<rPh\b[\s\S]*?<\/rPh>/g, ''), /<t\b[^>]*>([\s\S]*?)<\/t>/g).map((m) => decode(m[1])).join(''));
  const formats = xlsxFormats(zip);
  const parts = [];
  let sheets = 0, totalRows = 0;
  for (const [tag] of all(wb, /<sheet\b[^>]*>/g)) {
    const name = attr(tag, 'name') || `Sheet ${sheets + 1}`;
    const hidden = /hidden/.test(attr(tag, 'state') || '');
    const target = relMap.get(attr(tag, 'r:id'))?.target;
    const xml = target && zip.text(target);
    if (!xml) continue;
    sheets++;
    const grid = [];
    let rowsSeen = 0, cut = false, maxCol = -1;
    for (const [, rowAttrs, rowBody] of all(xml, /<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const r = Number(attr(`<row${rowAttrs}>`, 'r')) - 1;
      const ri = Number.isInteger(r) && r >= 0 ? r : grid.length;
      if (rowsSeen >= LIMITS.sheetRows) { cut = true; break; }
      const cells = [];
      let ci = 0;
      for (const [, cAttrs, cBody = ''] of all(rowBody, /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ctag = `<c${cAttrs}>`;
        const ref = attr(ctag, 'r');
        if (ref) ci = colIndex(ref);
        const t = attr(ctag, 't') || 'n';
        const v = /<v>([\s\S]*?)<\/v>/.exec(cBody)?.[1];
        let out = '';
        if (t === 's') out = shared[Number(v)] ?? '';
        else if (t === 'inlineStr') out = all(cBody, /<t\b[^>]*>([\s\S]*?)<\/t>/g).map((m) => decode(m[1])).join('');
        else if (t === 'b') out = v === '1' ? 'TRUE' : v === '0' ? 'FALSE' : '';
        else if (v == null || v === '') { const f = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(cBody)?.[1]; if (f) out = `=${decode(f)}`; }
        else {
          const raw = decode(v);
          const num = Number(raw);
          const fmt = formats[Number(attr(ctag, 's') || 0)] || '';
          if (t === 'n' && raw !== '' && Number.isFinite(num)) {
            out = fmt === 'date' || fmt === 'datetime' ? excelDate(num, fmt, date1904)
              : fmt === 'percent' ? `${tidyNumber(num * 100)}%` : tidyNumber(num);
          } else out = raw;
        }
        if (ci < LIMITS.sheetCols && out !== '') { cells[ci] = out; maxCol = Math.max(maxCol, ci); }
        ci++;
      }
      if (cells.length) { grid[ri] = cells; rowsSeen++; }
    }
    const rows = grid.filter(Boolean);
    // Drop columns that are empty in every row.
    const used = Array.from({ length: maxCol + 1 }, (_, c) => rows.some((r) => r[c] != null));
    const table = rows.map((r) => used.map((u, c) => (u ? r[c] ?? '' : null)).filter((x) => x !== null));
    totalRows += rows.length;
    const dims = /<dimension\b[^>]*ref\s*=\s*"([^"]*)"/.exec(xml)?.[1];
    parts.push([
      `## Sheet: ${name}${hidden ? ' (hidden)' : ''}`,
      rows.length ? mdTable(table) : '_(empty)_',
      cut ? `_Only the first ${LIMITS.sheetRows} rows are shown${dims ? ` (the sheet spans ${dims})` : ''}._` : '',
      maxCol + 1 >= LIMITS.sheetCols ? `_Only the first ${LIMITS.sheetCols} columns are shown._` : '',
    ].filter(Boolean).join('\n\n'));
  }
  return { body: parts.join('\n\n'), summary: `${sheets} sheet${sheets === 1 ? '' : 's'}, ${totalRows} row${totalRows === 1 ? '' : 's'}` };
}

// ---------------------------------------------------------------- pptx

function pptxParagraphs(xml, skipPh = []) {
  const lines = [];
  for (const [p] of all(xml, /<a:p\b[\s\S]*?<\/a:p>|<a:p\/>/g)) {
    const lvl = Number(attr(/<a:pPr\b[^>]*>/.exec(p)?.[0] || '', 'lvl') || 0);
    const t = all(p, /<a:t>([\s\S]*?)<\/a:t>|<a:br\b[^>]*\/>/g).map((m) => (m[1] != null ? decode(m[1]) : '\n')).join('').trim();
    if (t) lines.push({ t, lvl });
  }
  return lines;
}

function pptxShapes(xml, relMap, pics) {
  const out = [];
  let title = '';
  const tok = /<p:sp\b[\s\S]*?<\/p:sp>|<p:pic\b[\s\S]*?<\/p:pic>|<p:graphicFrame\b[\s\S]*?<\/p:graphicFrame>/g;
  for (const [shape] of xml.matchAll(tok)) {
    if (shape.startsWith('<p:pic')) {
      const r = relMap.get(attr(/<a:blip\b[^>]*>/.exec(shape)?.[0] || '', 'r:embed'));
      const rel = r && !r.external ? pics.save(r.target) : null;
      if (rel) out.push(`![picture](${rel})`);
      continue;
    }
    if (shape.startsWith('<p:graphicFrame')) {
      const rows = all(shape, /<a:tr\b[\s\S]*?<\/a:tr>/g).map(([tr]) =>
        all(tr, /<a:tc\b[\s\S]*?<\/a:tc>/g).map(([tc]) => pptxParagraphs(tc).map((l) => l.t).join(' ')));
      if (rows.length) out.push(mdTable(rows));
      else if (/<c:chart\b/.test(shape)) out.push('_(a chart)_');
      continue;
    }
    const ph = attr(/<p:ph\b[^>]*>/.exec(shape)?.[0] || '', 'type') || (/<p:ph\b/.test(shape) ? 'body' : '');
    if (['sldNum', 'dt', 'ftr', 'sldImg', 'hdr'].includes(ph)) continue;
    const lines = pptxParagraphs(shape);
    if (!lines.length) continue;
    if ((ph === 'title' || ph === 'ctrTitle') && !title) { title = lines.map((l) => l.t).join(' '); continue; }
    if (ph === 'subTitle') { out.push(`_${lines.map((l) => l.t).join(' ')}_`); continue; }
    out.push(lines.map((l) => `${'  '.repeat(Math.min(l.lvl, 8))}- ${l.t.replace(/\n/g, ' ')}`).join('\n'));
  }
  return { title, out };
}

function pptx(zip, pics) {
  const pres = zip.text('ppt/presentation.xml');
  if (!pres) throw new Error("it isn't a PowerPoint presentation");
  const relMap = rels(zip, 'ppt/presentation.xml');
  const parts = [];
  let n = 0;
  for (const [tag] of all(pres, /<p:sldId\b[^>]*>/g)) {
    const target = relMap.get(attr(tag, 'r:id'))?.target;
    const xml = target && zip.text(target);
    if (!xml) continue;
    n++;
    const sRels = rels(zip, target);
    const { title, out } = pptxShapes(xml, sRels, pics);
    const hidden = /<p:sld\b[^>]*\sshow\s*=\s*["']0["']/.test(xml);
    const notesTarget = [...sRels.values()].find((r) => r.type.endsWith('/notesSlide'))?.target;
    const notesXml = notesTarget && zip.text(notesTarget);
    const notes = notesXml ? pptxShapes(notesXml, new Map(), { save: () => null }).out.join('\n').replace(/^- /gm, '') : '';
    parts.push([
      `## Slide ${n}${title ? `: ${title.replace(/\n/g, ' ')}` : ''}${hidden ? ' (hidden)' : ''}`,
      ...out,
      notes ? `Speaker notes:\n\n> ${notes.replace(/\n/g, '\n> ')}` : '',
    ].filter(Boolean).join('\n\n'));
  }
  return { body: parts.join('\n\n'), summary: `${n} slide${n === 1 ? '' : 's'}` };
}

// ---------------------------------------------------------------- text

function plainText(file) {
  const size = fs.statSync(file).size;
  const buf = fs.readFileSync(file).subarray(0, LIMITS.textBytes);
  let text;
  if (buf[0] === 0xff && buf[1] === 0xfe) text = buf.subarray(2).toString('utf16le');
  else if (buf[0] === 0xfe && buf[1] === 0xff) { const b = Buffer.from(buf.subarray(2)); b.swap16?.(); text = b.toString('utf16le'); }
  else text = buf.toString('utf8').replace(/^﻿/, '');
  if (text.includes('\u0000')) throw new Error("it doesn't look like a text file");
  const lines = text.split('\n').length;
  return { text, cut: size > LIMITS.textBytes, summary: `${lines} line${lines === 1 ? '' : 's'}` };
}

// ---------------------------------------------------------------- entry point

const safeName = (s) => s.replace(/[^\w.\- ]+/g, '_').replace(/^\.+/, '').slice(0, 80) || 'file';

// Extracts `file` into `outDir`. Returns { md, summary, pictures, mediaDir }. Throws an
// Error whose message completes "Can't read <name>: …".
function extract(file, outDir) {
  const kind = kindOf(file);
  if (kind === 'legacy') throw new Error(`PPTD reads ${LEGACY[ext(file)]}, not ${ext(file)}. Save it in the newer format and drop it again`);
  if (!kind) throw new Error('PPTD reads Word, Excel and PowerPoint files and plain text');
  fs.mkdirSync(outDir, { recursive: true });
  const base = safeName(path.basename(file));
  // A fresh name per drop, so dropping the same file twice keeps both.
  let stem = base, i = 1;
  while (fs.existsSync(path.join(outDir, `${stem}.md`))) stem = `${base}-${++i}`;
  const md = path.join(outDir, `${stem}.md`);
  const mediaName = `${stem}-pictures`;

  let body, summary, pictures = 0, cut = false;
  if (kind === 'text') {
    const t = plainText(file);
    const x = ext(file);
    const fence = x === '.md' || x === '.markdown' ? '' : x.slice(1) === 'txt' ? 'text' : x.slice(1);
    body = fence ? `\`\`\`${fence}\n${t.text.replace(/```/g, '`​``')}\n\`\`\`` : t.text;
    summary = t.summary;
    cut = t.cut;
  } else {
    const zip = openZip(file);
    const pics = pictureSaver(zip, outDir, mediaName);
    const r = ext(file) === '.docx' ? docx(zip, pics) : ext(file) === '.xlsx' ? xlsx(zip) : pptx(zip, pics);
    body = r.body;
    summary = r.summary;
    pictures = pics.count();
    if (pictures) summary += `, ${pictures} picture${pictures === 1 ? '' : 's'}`;
  }
  if (body.length > LIMITS.markdownChars) { body = body.slice(0, LIMITS.markdownChars); cut = true; }
  const head = `# ${path.basename(file)}\n\n_Extracted by PPTD from ${file} (${summary})._${cut ? ' _The file was longer than this; only the start is shown._' : ''}\n\n`;
  fs.writeFileSync(md, head + (body.trim() || '_(no text found)_') + '\n');
  return { md, summary, pictures, mediaDir: pictures ? path.join(outDir, mediaName) : null, cut };
}

module.exports = { extract, kindOf, openZip, LIMITS };
