// Move a slide to another position in a PPTD deck (spec §4–5). Pure: HTML in, HTML out.
//
// A slide's *content* moves; what belongs to its *position* stays put:
// - the section's id (sN) and the number in its aria-label ("Slide N: …"),
// - its .controls (‹ › labels pointing at rN±1, the "N / total" counter) and .progress bar,
// - the radios, and the `#rN:checked ~ #sN` switching rules.
// So the counters, arrows and progress stay right without renumbering anything.
// What refers to a slide's content follows it: per-slide CSS (`#s3 .chart`) and jump links
// inside slide content (`<label for="r5">` on an agenda slide).

// Opening tag of <section id="sN"> and the span of the whole element (nested sections OK).
function sectionSpan(html, n) {
  const open = new RegExp(`<section\\b[^>]*\\bid\\s*=\\s*["']?s${n}(?=["'\\s>])["']?[^>]*>`, 'i').exec(html);
  if (!open) return null;
  const re = /<\/?section\b[^>]*>/gi;
  re.lastIndex = open.index + open[0].length;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) {
      return { tagStart: open.index, openTag: open[0], start: open.index + open[0].length, end: m.index, closeEnd: m.index + m[0].length };
    }
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

const MARK = (i) => `\u0000pptd-chrome-${i}\u0000`;

// Split a slide's inner HTML into its positional chrome (.controls, .progress) and the rest,
// with markers where the chrome was.
function splitChrome(inner) {
  const chrome = [];
  let out = '', pos = 0;
  const re = /<([a-z][\w-]*)\b[^>]*\bclass\s*=\s*(["'])(?:(?!\2)[^])*?\b(?:controls|progress)\b(?:(?!\2)[^])*?\2[^>]*>/gi;
  let m;
  while ((m = re.exec(inner))) {
    if (m.index < pos) continue;
    const end = elementEnd(inner, m[1], m.index + m[0].length);
    if (end < 0) continue;
    out += inner.slice(pos, m.index) + MARK(chrome.length);
    chrome.push(inner.slice(m.index, end));
    pos = end;
    re.lastIndex = end;
  }
  return { body: out + inner.slice(pos), chrome };
}

// Put position p's chrome back into a body, in order. Extra chrome goes at the end; extra
// markers are dropped.
function joinChrome(body, chrome) {
  let used = 0;
  const out = body.replace(/\u0000pptd-chrome-(\d+)\u0000/g, () => (used < chrome.length ? chrome[used++] : ''));
  return used < chrome.length ? out.replace(/\s*$/, (ws) => `\n${chrome.slice(used).join('\n')}${ws}`) : out;
}

// A slide's title for messages: from aria-label "Slide N: Title", else its first heading.
function slideTitle(openTag, inner) {
  const a = /aria-label\s*=\s*["'][^"']*?\bSlide\s+\d+\s*[:–—-]\s*([^"']+)["']/i.exec(openTag);
  if (a) return a[1].trim();
  const h = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(inner);
  return h ? h[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
}

// from, to: 1-based positions. Returns { html, title } or throws.
function moveSlide(html, from, to) {
  const spans = [];
  for (let n = 1; ; n++) {
    const s = sectionSpan(html, n);
    if (!s) break;
    spans.push(s);
  }
  const total = spans.length;
  if (!total) throw new Error('No slides (<section id="s1"> …) found in the deck.');
  if (!(from >= 1 && from <= total && to >= 1 && to <= total)) throw new Error(`Can't move slide ${from} to ${to}: the deck has ${total} slides.`);
  for (let i = 1; i < total; i++) {
    if (spans[i].tagStart < spans[i - 1].closeEnd) throw new Error('Slides are nested in each other; reorder them with the agent instead.');
  }
  if (from === to) return { html, title: slideTitle(spans[from - 1].openTag, html.slice(spans[from - 1].start, spans[from - 1].end)) };

  // order[i] = original number of the slide that ends up at position i+1.
  const order = spans.map((_, i) => i + 1);
  order.splice(to - 1, 0, ...order.splice(from - 1, 1));
  const newPos = {};
  order.forEach((orig, i) => { newPos[orig] = i + 1; });

  const parts = spans.map((s) => ({ openTag: s.openTag, ...splitChrome(html.slice(s.start, s.end)) }));
  const title = slideTitle(spans[from - 1].openTag, html.slice(spans[from - 1].start, spans[from - 1].end));

  // Jump links inside slide content follow their target slide.
  const remapFor = (body) => body.replace(/(\bfor\s*=\s*["']?)r(\d+)(?=["'\s>])/gi, (m, pre, k) => (newPos[k] ? `${pre}r${newPos[k]}` : m));

  let out = html.slice(0, spans[0].tagStart);
  order.forEach((orig, i) => {
    const p = i + 1;
    const src = parts[orig - 1];
    const tag = src.openTag
      .replace(/(\bid\s*=\s*["']?)s\d+/i, `$1s${p}`)
      .replace(/(aria-label\s*=\s*["'][^"']*?\bSlide\s+)\d+/i, `$1${p}`);
    out += tag + joinChrome(remapFor(src.body), parts[p - 1].chrome) + html.slice(spans[p - 1].end, spans[p - 1].closeEnd);
    if (p < total) out += html.slice(spans[p - 1].closeEnd, spans[p].tagStart); // whitespace/comments between slides
  });
  out += html.slice(spans[total - 1].closeEnd);

  // Per-slide CSS follows the content; the switching rules (#rN:checked ~ #sN) stay.
  out = out.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, a, css, b) => {
    const keep = [];
    css = css.replace(/#r(\d+):checked(\s*~\s*)#s\1\b/g, (m) => { keep.push(m); return `\u0000k${keep.length - 1}\u0000`; });
    css = css.replace(/#s(\d+)\b/g, (m, k) => (newPos[k] ? `#s${newPos[k]}` : m));
    css = css.replace(/\u0000k(\d+)\u0000/g, (_x, i) => keep[i]);
    return a + css + b;
  });
  return { html: out, title };
}

module.exports = { moveSlide };
