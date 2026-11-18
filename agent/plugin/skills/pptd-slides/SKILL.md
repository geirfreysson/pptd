---
name: pptd-slides
description: Build and edit PPTD presentations (*.pptd.html) shown in the PPTD app: slide structure, layout, diagrams, media, branding via brand files, and the PPTD conformance rules. Use for any change to a slide or deck.
---

> **Inside the PPTD app, read `PPTD.md` in this folder first.** It covers the current slide,
> live reload, embedded media and the brand file.

# Presentations as web pages

A deck is **one self-contained `.pptd.html` file**: inline CSS, inline SVG diagrams, no
external scripts, fonts or images. It opens from disk in any browser, previews when shared as
a file in Microsoft Teams, prints to PDF, and plays in the PPTD app.

Keep decks local: save them where the user says, and don't upload or publish them anywhere
unless the user asks.

## Files in this skill

- `template.html`: starting point. Copy it, keep the `<style>` block, and replace the six
  example slides (title, cards, HTML flow, SVG worked example, status matrix, thank you).
- `shot.sh deck.html N out.png [WxH]`: screenshot slide N in headless Chrome.
- `keytest.mjs /abs/path/deck.html`: presses real arrow keys and clicks ‹ › in headless
  Chrome, and checks there are zero `<script>` tags. Exits non-zero on failure.
- `pptd-check.mjs deck.pptd.html`: PPTD conformance checker. `pptd-spec.md`: the format.
- `brand-template.md`: the shape of the user's default brand file.

## 1. Branding

Each deck carries its brand: `<meta name="pptd-brand" content="Name">` and a
`<style id="pptd-brand">` block after the main `<style>`, holding the brand tokens `--ink`,
`--ink-2`, `--muted`, `--paper`, `--accent`, `--accent-soft`, `--highlight`, `--title-bg`,
`--title-eyebrow`, `--title-soft`, `--title-footer` and `--font`, with the brand's rules in a
leading CSS comment. The rest of the CSS only uses these variables. (`PPTD.md` covers where
brands come from: the user's default brand, or what they ask for.)

- Follow the deck's brand. Don't invent brand colours, and don't imitate a company's branding
  unless the user asks for it.
- Don't add logos or other copyrighted assets unless the user or the brand supplies the file.
  Embed supplied images as `data:` URIs (see `PPTD.md`, "Images and video").
- Title and closing slides use `.title-slide` (`--title-bg`, `--highlight` top bar and rule).
- Content slides: paper background, an 8px `--ink`→`--accent` bar at the top, an `.eyebrow`
  (`01 · Section`), an `h2` headline, an optional `.lead`, and a `.footer` with the source.
- Fonts: system fonts only, through `--font`. No web-font download, which Teams and offline
  viewing may block.
- Status colours (`--green`, `--amber`, and `--ink` for proven) are not brand colours and mean
  the same on every slide: green = signed off/ready, ink = proven/proof of concept/agreed,
  amber = in progress/to agree.
- Check contrast: body text on `--paper` and white text on `--title-bg` must stay readable.

## 2. Teams compatibility (the important part)

Teams opens shared HTML in a sandboxed preview. Learned the hard way:

1. **No `<script>` at all.** Teams warns that scripts won't run, and inline `onclick` handlers
   also fail. Everything (navigation, hover, progress) must be CSS.
2. **No `#hash` / `:target` navigation.** Anchor links don't navigate in the Teams preview.
   Use the radio-button pattern below.
3. **Anchor the deck to the top:** `body { display: grid; place-items: start center; }`.
   With `center`, the 16:9 deck sits in the middle of Teams' tall preview frame and a
   big grey band appears above it.
4. **Size text with container units.** `.deck { container-type: inline-size }` and every
   font size as `clamp(min, Ncqw, max)`, so text scales with the slide, not the window.
   Check at 1280×720, 1440×900, 1920×1080 and a tall frame such as 1000×1000.
5. **No speaker notes in the file.** Whatever is in the HTML is visible to anyone it is
   shared with. Keep presenter text out, or in a separate local file.
6. Self-contained only: no CDN links, external fonts or remote images.

## 3. Navigation: click and arrow keys, zero JavaScript

```html
<main class="deck">
  <input type="radio" name="slide" id="r1" class="slide-radio" checked autofocus aria-label="Slide 1">
  <input type="radio" name="slide" id="r2" class="slide-radio" aria-label="Slide 2">
  …all radios first, then the sections…
  <section id="s1" class="slide" aria-label="Slide 1: Title">…
    <nav class="controls"><span class="nav-ph"></span><span class="counter">1 / N</span>
      <label for="r2" class="nav-btn" aria-label="Next slide">›</label></nav>
    <div class="progress"><span style="width: X%"></span></div>
  </section>
```

```css
.slide-radio { position: fixed; top: 0; left: 0; width: 1px; height: 1px; margin: 0; opacity: 0; pointer-events: none; }
#r1:checked ~ #s1, #r2:checked ~ #s2, … { display: flex; }
```

- **Clicking:** each slide's ‹ › are `<label for="rN±1">`. Clicking a label checks that radio,
  and the `~` sibling selector shows the matching section.
- **Arrow keys:** the radios are *invisible but focusable* (not `hidden`, not
  `display: none`). A focused radio group natively moves with ←/→ (and ↑/↓), which many
  presentation clickers also send. `autofocus` on r1 gives focus on load; clicking a ‹ ›
  label refocuses the radio.
- Known limits, worth telling the user: clicking slide content drops focus (click ‹ or ›
  once to get arrows back); arrows wrap from last slide to first; Teams may ignore
  `autofocus`, so the first arrow press may need one click first.
- First slide uses `<span class="nav-ph">` instead of ‹, last slide instead of ›.

**When adding, removing or reordering slides, update all of these:** the radio list, the
`#rN:checked ~ #sN` selector list, every section's `id`/`aria-label`, each `‹ › for=`
target, every `N / total` counter and every progress width (`N/total × 100%`). Do it with a
small script and then run `keytest.mjs`. When renumbering with a regex, match only
`<section …>` tags, or it will also rewrite CSS attribute selectors.

## 4. Diagrams for complicated concepts

If a slide needs more than two sentences to explain how something works, draw it.

- **Linear flow (3–6 steps):** HTML `.path` of `.node` + `.arrow`. Highlight the step the slide
  is about with `.node.hl`. Stacks vertically on mobile.
- **Anything with structure** (data going in and out, tables, branching, before/after):
  inline SVG inside `.diagram`, with a `viewBox` and `width: 100%`, styled with classes
  (`dg-box`, `dg-label`, `dg-sub`, `dg-arrow`, `dg-step`) rather than inline colours. Give it
  `role="img"`, a `<title>` and a `<desc>` that says in words what it shows. Prefix the
  marker and element ids per slide (`dg4-arr`) so they don't collide.
- **Prefer a worked example to an abstract box diagram.** Show real-looking data moving
  through the steps (e.g. a respondent table → the new column → the resulting table) and
  label it "Illustrative" in the footer if the numbers are made up.
- Number the steps (`.dg-step` circles in `--highlight`) when there is an order, and say on the slide what is
  live, what is proof of concept and what is only designed.
- Charts (burn-ups, trends): inline SVG, label lines directly instead of using a legend
  where possible, and keep labels clear of the lines.
- One idea per diagram. If labels need to shrink below about 11px at 1280×720, split the slide.

## 5. Writing the slides

- The headline states the conclusion ("Processing is ready. Tables are in progress."),
  not the topic ("Processing status").
- At most about 40 words of body text per slide. Cards: a tag, an `h3`, and one or two sentences.
- Put sources and caveats in the `.footer`, not the body.
- No presenter-facing instructions on slides ("update before presenting", "TBC").
- Don't overstate: keep "signed off", "pilot proven", "proof of concept" and "agreed"
  distinct, and name who or what is the evidence.

## 6. Check before handing over

1. `node keytest.mjs /abs/path/deck.html` → all PASS, 0 script tags.
2. `shot.sh deck.html N out.png` for **every** slide at 1280×720, then Read each PNG:
   no overlapping or clipped text, nothing hidden behind the ‹ › controls or the footer,
   no labels crossing chart lines. (Screenshots can look faded because of the 0.22s entry
   animation; that is fine.)
3. Spot-check a couple of slides at 1920×1080 and 1000×1000 (Teams-like frame).
4. Optional PDF: Chrome `--print-to-pdf` works because of the `@media print` block.
5. `node pptd-check.mjs deck.pptd.html` → CONFORMING.
6. Tell the user the file path. Commit only if asked.
