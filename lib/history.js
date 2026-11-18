// Prompt history: the prompts that built a deck, kept in the deck itself, and snapshots of
// the deck after each one, kept on this Mac so the drawer's Prompts tab can revert to them.
//
// In the deck (docs/pptd-spec.md, "Prompt history"): an inert <template id="pptd-prompts">
// in <head> with one <li> per agent run (or revert). Each records data-hash, the hash of the
// deck after that run with this block removed, so appending to the block never changes it.
//
// On this Mac: userData/history/<hash>.html.gz holds the deck content (block removed) with
// that hash. Content-addressed, so a state is stored once and a row needs no other index.
// A row shows a revert button only when its snapshot is here; decks made elsewhere, or
// snapshots pruned for space, simply have none.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const BLOCK_RE = /[ \t]*<template\b[^>]*\bid=["']pptd-prompts["'][^>]*>[\s\S]*?<\/template>[ \t]*\r?\n?/gi;
const MAX_PROMPT = 4000;   // characters kept per prompt (pasted documents stay out)

// ---------------------------------------------------------------- the block in the deck

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// The deck without its history block: what hashes and snapshots are made of.
const strip = (html) => html.replace(BLOCK_RE, '');

const hashOf = (html) => crypto.createHash('sha256').update(strip(html)).digest('hex').slice(0, 32);

// Entries: { id, at, kind: 'prompt'|'revert', text, hash, before?, to?, outcome? }
function read(html) {
  const m = html.match(/<template\b[^>]*\bid=["']pptd-prompts["'][^>]*>([\s\S]*?)<\/template>/i);
  if (!m) return [];
  const out = [];
  for (const li of m[1].matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi)) {
    const attrs = {};
    for (const a of li[1].matchAll(/data-([a-z-]+)="([^"]*)"/gi)) attrs[a[1].toLowerCase()] = unesc(a[2]);
    out.push({
      id: attrs.id || '', at: attrs.at || '', kind: attrs.kind === 'revert' ? 'revert' : 'prompt',
      text: unesc(li[2]), hash: attrs.hash || '', before: attrs.before || '', to: attrs.to || '',
      outcome: attrs.outcome || '',
    });
  }
  return out;
}

function render(entries) {
  const lis = entries.map((e) => {
    const attrs = [['id', e.id], ['at', e.at], e.kind === 'revert' && ['kind', 'revert'], e.to && ['to', e.to],
      ['hash', e.hash], e.before && ['before', e.before], e.outcome && ['outcome', e.outcome]].filter(Boolean);
    return `      <li ${attrs.map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>${esc(e.text)}</li>`;
  });
  return `  <template id="pptd-prompts">\n    <ol>\n${lis.join('\n')}\n    </ol>\n  </template>\n`;
}

// html with its block replaced by `entries` (none: block removed), just before </head>.
function write(html, entries) {
  const bare = strip(html);
  if (!entries.length) return bare;
  const at = bare.search(/<\/head\s*>/i);
  if (at < 0) return bare;
  return bare.slice(0, at) + render(entries) + bare.slice(at);
}

const newId = () => crypto.randomBytes(4).toString('hex');
const clip = (s) => (s.length > MAX_PROMPT ? `${s.slice(0, MAX_PROMPT)}…` : s);

// ---------------------------------------------------------------- snapshots on this Mac

function createStore(dir, maxBytes = () => 1024 * 1048576) {
  const file = (hash) => path.join(dir, `${hash}.html.gz`);
  const valid = (hash) => /^[0-9a-f]{32}$/.test(hash || '');

  function prune() {
    let items;
    try {
      items = fs.readdirSync(dir).filter((n) => n.endsWith('.html.gz')).map((n) => {
        const st = fs.statSync(path.join(dir, n));
        return { n, size: st.size, used: st.mtimeMs };
      });
    } catch { return; }
    let total = items.reduce((s, i) => s + i.size, 0);
    const cap = maxBytes();
    if (total <= cap) return;
    items.sort((a, b) => a.used - b.used);
    for (const i of items) {
      if (total <= cap) break;
      try { fs.rmSync(path.join(dir, i.n)); total -= i.size; } catch {}
    }
  }

  return {
    // Stores the deck (block removed); returns its hash.
    save(html) {
      const hash = hashOf(html);
      const f = file(hash);
      try {
        if (fs.existsSync(f)) { const t = new Date(); fs.utimesSync(f, t, t); return hash; }
        fs.mkdirSync(dir, { recursive: true });
        const tmp = `${f}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, zlib.gzipSync(strip(html)));
        fs.renameSync(tmp, f);
        prune();
      } catch (e) { console.error('history:', e.message); }
      return hash;
    },
    has: (hash) => valid(hash) && fs.existsSync(file(hash)),
    load(hash) {
      if (!valid(hash)) return null;
      try {
        const html = zlib.gunzipSync(fs.readFileSync(file(hash))).toString('utf8');
        const t = new Date(); fs.utimesSync(file(hash), t, t);
        return html;
      } catch { return null; }
    },
    prune,
  };
}

// ---------------------------------------------------------------- what the drawer shows

// Rows for the Prompts tab. A revert hides (dims) the rows it went back past; prompts made
// after it are live again. `current` marks the row whose state is the deck now.
function rows(entries, nowHash, store) {
  const live = entries.map(() => true);
  entries.forEach((e, i) => {
    if (e.kind !== 'revert') return;
    const j = e.to === 'start' ? -1 : entries.findIndex((x) => x.id === e.to);
    if (e.to !== 'start' && j < 0) return;
    for (let k = j + 1; k < i; k++) live[k] = false;
  });
  let n = 0;
  const out = entries.map((e, i) => ({
    id: e.id, kind: e.kind, at: e.at, outcome: e.outcome,
    n: e.kind === 'prompt' ? ++n : null,
    text: e.kind === 'revert'
      ? (e.to === 'start' ? 'Reverted to the start' : `Reverted to #${entries.slice(0, entries.findIndex((x) => x.id === e.to) + 1).filter((x) => x.kind === 'prompt').length || '?'}`)
      : e.text,
    live: live[i], canRevert: e.kind === 'prompt' && !!store?.has(e.hash), current: false,
    hash: e.hash,
  }));
  // The start: the deck before the first prompt, when this Mac kept it.
  const first = entries.find((e) => e.kind === 'prompt');
  const start = first?.before ? { id: 'start', kind: 'start', text: 'Before the first prompt', hash: first.before,
    canRevert: !!store?.has(first.before), current: false, live: true } : null;
  const all = start ? [start, ...out] : out;
  const cur = all.findLast((r) => r.kind !== 'revert' && r.hash === nowHash);
  if (cur) cur.current = true;
  for (const r of all) delete r.hash;
  return { start, rows: out };
}

module.exports = { strip, hashOf, read, write, newId, clip, createStore, rows };
