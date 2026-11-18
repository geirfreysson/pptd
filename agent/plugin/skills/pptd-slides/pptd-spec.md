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
the app has a template that follows all seven rules, with its brand colours in one `:root`
block that a brand file can replace.

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

The visible slide MUST depend only on which radio is `:checked`. Do not use `:target`,
`#hash` links, `:focus` or `:hover` to switch slides. The app changes slides by checking a
radio, and it notices nothing else.

## 5. Controls

- In-page ‹ › buttons SHOULD be `<label for="rN">` elements, so the file still works in a
  browser and in Teams, where scripts are blocked.
- They MUST sit inside an element with `class="controls"`. **The app hides every `.controls`
  element** and shows its own toolbar instead. Do not put anything inside `.controls` that
  the audience needs to see.
- A `.progress` bar MAY be used. It stays visible in the app.
- The first slide has no ‹ and the last has no ›. Use a placeholder element to keep the
  layout steady.

## 6. Sizing and layout

The app shows the deck in three ways: under a toolbar, filling a window, and full screen on
black. The deck must look right at any window size.

| Requirement | Level |
|---|---|
| `.deck` is a 16:9 box that fits the viewport: `width: min(100vw, 177.78vh); height: min(100vh, 56.25vw)` | MUST |
| `html, body { margin: 0; height: 100%; }` with `body { display: grid; place-items: start center; overflow: hidden; }` | MUST |
| `.deck { container-type: inline-size; position: relative; overflow: hidden; }` | MUST |
| Font sizes in container units, e.g. `clamp(14px, 1.6cqw, 30px)`, so text scales with the slide | SHOULD |
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
| `@media (prefers-reduced-motion: reduce)` honoured for slide animations | SHOULD |

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

## 9. Versioning

- This is version **1**. A future version will bump `content` in the marker, and the app
  will keep playing v1 files.
- Unknown `content` values: the app tries to play the file as v1.
- Reserved, so do not use them for other purposes: the class names `notes` and `pptd-*`, and
  `data-pptd-*` attributes. `pptd-media`, `pptd-image`, `pptd-video` and `<style id="pptd-media">`
  are already defined above.

## 10. Conformance checklist for agents

Before handing a deck over:

1. File is named `*.pptd.html` and contains `<meta name="pptd" content="1">`.
2. `node tools/pptd-check.mjs <file>` reports **PASS** on every check.
3. Number of radios = number of sections = the `N` in every `n / N` counter.
4. Every slide was looked at at 1280×720 (e.g. headless Chrome screenshot) with no clipped
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
    h1 { font-size: clamp(28px, 5cqw, 96px); margin: 0; }
    p  { font-size: clamp(14px, 2cqw, 40px); }
    .controls { position: absolute; right: 2.4%; bottom: 2%; display: flex; gap: 8px; }
    .controls label, .controls span { width: 40px; height: 36px; display: grid; place-items: center;
            border: 1px solid #ccc; border-radius: 8px; cursor: pointer; }
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
