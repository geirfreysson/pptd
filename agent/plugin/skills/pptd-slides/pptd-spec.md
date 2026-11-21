# PPTD — presentation file format, v1

A **PPTD file** is a single, self-contained HTML presentation named `<name>.pptd.html`.
It works on its own in any browser and in the Microsoft Teams file preview, and it plays in the
**PPTD** app ("PowerPoint is dead"), which replaces the in-page ‹ › buttons with native controls and adds a
slideshow mode.

This document is written for agents (and people) that generate presentations. The words
**MUST**, **SHOULD** and **MAY** are used in their RFC 2119 sense.

Check a file with:

```sh
node tools/pptd-check.mjs path/to/deck.pptd.html
```

---

## 1. Rules at a glance

An agent producing a PPTD deck MUST:

1. Save it as **`<name>.pptd.html`**: one file, UTF-8.
2. Put **`<meta name="pptd" content="1">`** in `<head>`.
3. Make each slide a `<section class="slide">` and switch slides with **one hidden radio
   input per slide**: `<input type="radio" name="slide" class="slide-radio">`.
4. Put every in-page navigation control inside an element with **`class="controls"`**.
5. Use **no `<script>`** and no inline event handlers (`onclick=` etc.).
6. Load **nothing external**: no CDN, web fonts, remote images or `<link rel=stylesheet>`.
7. Size the deck as a **16:9 box** in a `.deck` element, with text scaled to the deck.

Everything else is free: content, layout and branding. The `pptd-slides` skill bundled with
the app has a starting deck per style that follows all seven rules, with its layout in one
style block and its brand colours in one `:root` block, each of which can be replaced.

---

## 2. File

| Requirement | Level |
|---|---|
| File name ends in `.pptd.html` (lower case). The part before it is the title shown in the app. | MUST |
| One file; all CSS inline in `<style>`; images as inline SVG or `data:` URIs | MUST |
| `<!doctype html>`, `<meta charset="utf-8">`, `<html lang="…">` | MUST |
| `<title>` set to the deck title | SHOULD |
| `<meta name="viewport" content="width=device-width, initial-scale=1">` | SHOULD |
| Under 10 MB | SHOULD |

## 3. Marker

```html
<meta name="pptd" content="1">
```

- MUST appear in `<head>`. `content` is the spec version the file follows (currently `1`).
- The app uses it, together with the slide radios, to recognise a PPTD deck. Without it
  the app treats the file as an ordinary web page.

## 4. Structure

```html
<body>
  <main class="deck">
    <!-- 1. ALL radios first, one per slide, in slide order -->
    <input type="radio" name="slide" id="r1" class="slide-radio" checked autofocus aria-label="Slide 1">
    <input type="radio" name="slide" id="r2" class="slide-radio" aria-label="Slide 2">
    <input type="radio" name="slide" id="r3" class="slide-radio" aria-label="Slide 3">

    <!-- 2. then the slides, in the same order -->
    <section id="s1" class="slide" aria-label="Slide 1: Title"> …
      <nav class="controls"> … ‹ › labels, counter … </nav>
      <div class="progress"><span style="width: 33.3%"></span></div>
    </section>
    <section id="s2" class="slide" aria-label="Slide 2: …"> … </section>
    <section id="s3" class="slide" aria-label="Slide 3: …"> … </section>
  </main>
</body>
```

| Requirement | Level |
|---|---|
| Exactly one `main.deck` element contains all slides | MUST |
| One `input.slide-radio[type=radio][name=slide]` per slide | MUST |
| The *n*-th radio shows the *n*-th `section.slide`: document order is slide order | MUST |
| Radio ids `r1…rN`, section ids `s1…sN` | MUST |
| Exactly one radio has `checked` in the file (normally `r1`) | MUST |
| All radios come before all sections, as siblings of the sections inside `.deck` | MUST |
| No other radio inputs with `name="slide"` | MUST |
| Radios are invisible but focusable: not `hidden`, not `display:none`, not `visibility:hidden` | MUST |
| `autofocus` on `r1` | SHOULD |

### Slide switching (CSS only)

```css
.slide-radio { position: fixed; top: 0; left: 0; width: 1px; height: 1px;
               margin: 0; opacity: 0; pointer-events: none; }
.slide { display: none; }
#r1:checked ~ #s1, #r2:checked ~ #s2, #r3:checked ~ #s3 { display: flex; }
```

The visible slide MUST depend only on which radio is `:checked`. Slides switch instantly:
**the app turns off `animation` and `transition` on `.slide`**, so don't give slides an entry
animation (a fade from part-transparent shows the deck background through, a flash on every
change). Do not use `:target`,
`#hash` links, `:focus` or `:hover` to switch slides. The app changes slides by checking a
radio, and it notices nothing else.

## 5. Controls

- In-page ‹ › buttons SHOULD be `<label for="rN">` elements, so the file still works in a
  browser and in Teams, where scripts are blocked.
- They MUST sit inside an element with `class="controls"`. **The app hides every `.controls`
  element** and shows its own toolbar instead. Do not put anything inside `.controls` that
  the audience needs to see.
- The ‹ › labels MAY also cover the slide as click zones (e.g. a `::before` that spans the left
  third for ‹ and the rest for ›), so a click or tap on the slide navigates in a browser and on a
  phone. They hide with `.controls` in the app. Links in a slide must stay clickable above them.
- A `.progress` bar MAY be used. It stays visible in the app.
- The first slide has no ‹ and the last has no ›. Use a placeholder element to keep the
  layout steady.

## 6. Sizing and layout

The app shows the deck in three ways: under a toolbar, filling a window, and full screen on
black. The deck must look right at any window size. A deck is a picture of a slide, not a web
page: on a phone it shows as a miniature of the same 16:9 slide, never as a reflowed layout.

| Requirement | Level |
|---|---|
| `.deck` is a 16:9 box that fits the viewport: `width: min(100vw, 177.78vh); height: min(100vh, 56.25vw)` | MUST |
| `html, body { margin: 0; height: 100%; }` with `body { display: grid; place-items: start center; overflow: hidden; }` | MUST |
| `.deck { container-type: inline-size; position: relative; overflow: hidden; }` | MUST |
| Font sizes, spacing and box sizes in container units only (e.g. `1.6cqw`), with no px floors or caps (`clamp(14px, …)`), so everything scales with the slide. Hairline borders MAY stay `1px` | SHOULD |
| No layout changes for narrow screens: no `@media (max-width…)`, `(min-width…)` or `(orientation…)` rules that restyle the slides | SHOULD |
| `body` has an explicit background colour | MUST |
| Nothing essential in the bottom-right corner (about 12% × 8% of the slide). The in-page controls sit there in a browser | SHOULD |

**What the app changes during a slideshow** (do not fight it with `!important` rules on these
properties):

```css
html, body { background: #000 !important; }
body       { place-items: center !important; }
.deck      { box-shadow: none !important; }
```

## 7. Keyboard

The app owns the keyboard. ← → ↑ ↓, PageUp/PageDown, Home/End, and in a slideshow Enter,
Space, Backspace and Esc, are caught before the page sees them.

- The deck MUST NOT depend on its own key handling for anything except radio-group arrow
  navigation, which is the browser default.
- The deck MUST NOT use `accesskey` on navigation.

## 8. Content and safety

| Requirement | Level |
|---|---|
| No `<script>`, no `on*=` attributes, no `javascript:` URLs | MUST |
| No `<iframe>`, `<object>`, `<embed>`, `<form action>` | MUST |
| No external URLs in `src`, `href` on `<link>`, CSS `url()` or `@import` | MUST |
| Plain links (`<a href="https://…">`) are allowed. The app opens them in the default browser | MAY |
| No speaker notes or presenter-only text: anything in the file is visible to anyone it is shared with | MUST |
| An `@media print` block that prints one slide per page | SHOULD |
| `@media (prefers-reduced-motion: reduce)` honoured for animations inside slides | SHOULD |

### Embedded media

Images and video are embedded as `data:` URIs, so the deck stays a single file. The PPTD app
writes this markup when media is dropped on a slide; agents adding media SHOULD use the same:

```html
<figure class="pptd-media pptd-image">
<img alt="Description" src="data:image/jpeg;base64,…">
</figure>

<figure class="pptd-media pptd-video">
<video controls playsinline preload="metadata" aria-label="Description" src="data:video/mp4;base64,…"></video>
</figure>
```

| Requirement | Level |
|---|---|
| The `data:` URI is on a line of its own (agents and editors can then edit around it) | MUST |
| A figure goes inside the slide's `<section>`, before its `.footer` / `.controls` / `.progress` | SHOULD |
| Its styling is one `<style id="pptd-media">` block in `<head>`; the figure fills the free height below the headline, centred, rounded corners, soft shadow | SHOULD |
| Images: longest edge ≤ 2560 px; PNG, JPEG, GIF, WebP, SVG or AVIF (convert HEIC/TIFF) | SHOULD |
| Video: MP4 (H.264/AAC) or WebM, `controls`, no `autoplay` | SHOULD |
| Total file size: a short clip only; warn above 25 MB of video | SHOULD |

**Photo slots.** A deck may leave a place for a photo: a `<figure class="photo">` with a
`data-brief` describing the picture wanted. Empty, it shows as a placeholder with the brief;
the deck's CSS crops whatever fills it. When an image is dropped on a slide that has photo
slots, the app fills the slot it was dropped on (replacing a photo already there), or else
the first empty slot, instead of adding a `pptd-media` figure:

```html
<figure class="photo" data-brief="Photo: the store after, same angle">
<img alt="Description" src="data:image/jpeg;base64,…">
<figcaption>After</figcaption>
</figure>
```

| Requirement | Level |
|---|---|
| A slot is a `figure` whose class list contains `photo`; it holds no nested `figure` | MUST |
| A filled slot holds one `<img>`, its `data:` URI on a line of its own; the figure keeps its classes, `data-brief` and any `figcaption` | MUST |
| The deck's CSS sizes the slot and crops the image to it (`object-fit: cover`) | SHOULD |

### Reordering, adding and removing slides (app and `pptd-deck.mjs`)

The user can drag a slide to another position in the app's slide drawer, and agents add,
remove and reorder slides with `pptd-deck.mjs` (in the skill folder; source in `tools/`).
Both rewrite the file so that a slide's **content** moves and everything tied to a
**position** stays:

- Each `<section>` keeps its position's `id` (`sN`) and the number in its `aria-label`
  (`Slide N: …`); the title after the number moves with the content.
- Each position keeps its `.controls` and `.progress` elements (‹ › targets, counter, width).
- Radios and the `#rN:checked ~ #sN` switching rules are unchanged.
- Per-slide CSS in `<style>` blocks (`#s3 .chart`) and `for="rN"` jump links inside slide
  content are renumbered to follow the slide they refer to.

When the number of slides changes, the radios and switching rules grow or shrink at the
end, and each position's `.controls` and `.progress` are copied from the nearest old position
with the same role (first, middle, last) and renumbered: ‹ › targets, `N / total` counters
and progress widths (`N/total` or `(N-1)/(total-1)`, in the deck's own number format).
Comments just before a `<section>` belong to that slide and move with it. A change that would
add a checker failure is refused.

Decks stay conforming without other changes. Keep per-slide chrome inside `.controls` or
`.progress` so it stays with its position, and anything else inside the slide content.

### Brand

A deck records the brand it was made with, so it keeps its look wherever it is opened and an
agent editing it knows which brand to follow:

```html
<meta name="pptd-brand" content="Acme">
<style> … the deck's CSS, using var(--ink), var(--accent) … </style>
<style id="pptd-brand">
  /* Brand: Acme. Rules: logo bottom-left on title slides only; sentence-case headlines. */
  :root { --ink: #1b2a41; --accent: #0a84ff; --paper: #f6f7f9; --font: "Segoe UI", Arial, sans-serif; … }
</style>
```

| Requirement | Level |
|---|---|
| `<meta name="pptd-brand" content="…">` in `<head>` names the brand | SHOULD |
| One `<style id="pptd-brand">` holds the brand's `:root` tokens, after the main `<style>` so it wins | SHOULD |
| The rest of the CSS takes brand colours and the font from those tokens, not hard-coded values | SHOULD |
| The brand's rules (logo use, wording) are summarised in a CSS comment at the top of the block | MAY |

Token names used by the bundled styles: `--ink`, `--ink-2`, `--muted`, `--paper`,
`--accent`, `--accent-soft`, `--highlight`, `--title-bg`, `--title-eyebrow`, `--title-soft`,
`--title-footer`, `--font`. A brand may also set `--on-accent` (text on accent fills),
`--accent-text` (the accent as text) and `--on-highlight` (text on highlight fills) when the
defaults (`--paper`, `--accent`, `--ink`) don't read against its colours, and `--on-title`
(headlines on `--title-bg`, default `--paper`) when the brand's paper is dark.

### Style

A deck may also record the style its layout comes from, so an agent editing it knows which
design rules to follow and can switch it to another style:

```html
<meta name="pptd-style" content="grid">
<style> … frame: navigation, sizing, print … </style>
<style id="pptd-style"> /* Style: grid. … */ .card { … } .stats { … } … </style>
<style id="pptd-brand"> … </style>
```

| Requirement | Level |
|---|---|
| `<meta name="pptd-style" content="…">` in `<head>` names the style (letters, digits, `-`, `_`): a bundled style, one of the user's own, or `custom` for a style made for this deck alone | MAY |
| One `<style id="pptd-style">` holds the style's CSS, after the main `<style>` and before the brand block | MAY |
| The style block takes every colour from the brand tokens (directly or through `color-mix()`), so any brand works with it | SHOULD |

A deck without these keeps whatever look its CSS gives it.

### Prompt history

When the user turns on View › Save Prompts in Decks, the app records each agent prompt that
changed a deck in an inert `<template>` in `<head>`. Browsers don't render a template, and
it holds no script.

```html
<template id="pptd-prompts">
  <ol>
    <li data-id="3fa2c81d" data-at="2026-11-18T10:42:00.000Z" data-hash="…" data-before="…">Make a 6-slide deck on Q3 results</li>
    <li data-id="9b01e7aa" data-at="…" data-kind="revert" data-to="3fa2c81d" data-hash="…">Reverted to #1</li>
  </ol>
</template>
```

- One `<li>` per agent run that changed the deck, in order. Its text is the prompt, plus any
  messages sent while the agent was working, one per line, HTML-escaped (`&`, `<`, `>`, `"`).
- `data-hash`: the deck after that run, as the first 32 hex digits of the SHA-256 of the
  file **with this block removed**, so adding to the block never changes the hash.
  `data-before`: the same for the deck before the run (left out when unknown).
- `data-outcome`: `aborted` or `interrupted` (the user stopped the run) or `error`.
- `data-kind="revert"` rows record a revert in the app; `data-to` is the `data-id` it went
  back to (`start`: before the first prompt). Earlier rows are never removed by a revert.
- The app keeps the deck states themselves in its own data folder, keyed by hash; a deck
  carries only the prompts and hashes. The app offers to revert only to states it has.
- The app rewrites the block after each run, from the history it read before that run, so a
  block an agent dropped comes back. Agents should leave it as it is.

| Requirement | Level |
|---|---|
| At most one `<template id="pptd-prompts">`, in `<head>` | MUST |
| Agents leave the block as it is | SHOULD |

File › Remove Prompt History deletes the block.

## 9. Versioning

- This is version **1**. A future version will bump `content` in the marker, and the app
  will keep playing v1 files.
- Unknown `content` values: the app tries to play the file as v1.
- Reserved, so do not use them for other purposes: the class names `notes` and `pptd-*`,
  `data-pptd-*` attributes, and `pptd-*` meta names and element ids. `pptd-media`,
  `pptd-image`, `pptd-video`, `<style id="pptd-media">`, `<meta name="pptd-brand">`,
  `<style id="pptd-brand">` and `<template id="pptd-prompts">` are already defined above.

## 10. Conformance checklist for agents

Before handing a deck over:

1. File is named `*.pptd.html` and contains `<meta name="pptd" content="1">`.
2. `node tools/pptd-check.mjs <file>` reports **PASS** on every check.
3. Number of radios = number of sections = the `N` in every `n / N` counter.
4. Every slide was looked at at 1280×720 (e.g. the skill's `pptd-app.mjs shot`, or a browser) with no clipped
   or overlapping text.
5. Opening it in the PPTD app shows the slides with no in-page ‹ › and the toolbar counter
   is correct.

## Appendix: minimal conforming file

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="pptd" content="1">
  <title>Minimal deck</title>
  <style>
    html, body { margin: 0; height: 100%; background: #e9edf2; font-family: system-ui, sans-serif; }
    body { display: grid; place-items: start center; overflow: hidden; }
    .deck { width: min(100vw, 177.78vh); height: min(100vh, 56.25vw); container-type: inline-size;
            position: relative; overflow: hidden; background: #fff; }
    .slide-radio { position: fixed; top: 0; left: 0; width: 1px; height: 1px; margin: 0; opacity: 0; pointer-events: none; }
    .slide { display: none; position: absolute; inset: 0; padding: 6%; flex-direction: column; }
    #r1:checked ~ #s1, #r2:checked ~ #s2 { display: flex; }
    h1 { font-size: 5cqw; margin: 0; }
    p  { font-size: 2cqw; }
    .controls { position: absolute; right: 2.4%; bottom: 2%; display: flex; gap: .6cqw; }
    .controls label, .controls span { width: 3.1cqw; height: 2.8cqw; display: grid; place-items: center;
            border: 1px solid #ccc; border-radius: .6cqw; cursor: pointer; font-size: 1.4cqw; }
    .controls .ph { visibility: hidden; }
    @media print {
      html, body { height: auto; overflow: visible; display: block; }
      .slide { display: flex !important; position: relative; width: 13.333in; height: 7.5in; break-after: page; }
      .controls { display: none !important; }
    }
  </style>
</head>
<body>
  <main class="deck">
    <input type="radio" name="slide" id="r1" class="slide-radio" checked autofocus aria-label="Slide 1">
    <input type="radio" name="slide" id="r2" class="slide-radio" aria-label="Slide 2">

    <section id="s1" class="slide" aria-label="Slide 1: Title">
      <h1>Hello</h1><p>First slide.</p>
      <nav class="controls"><span class="ph"></span><label for="r2" aria-label="Next slide">›</label></nav>
    </section>
    <section id="s2" class="slide" aria-label="Slide 2: End">
      <h1>Thanks</h1><p>Last slide.</p>
      <nav class="controls"><label for="r1" aria-label="Previous slide">‹</label><span class="ph"></span></nav>
    </section>
  </main>
</body>
</html>
```
