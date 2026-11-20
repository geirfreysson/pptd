---
name: pptd-slides
description: "Build and edit PPTD presentations (*.pptd.html) shown in the PPTD app: slide structure, layout, diagrams, media, branding via brand files, and the PPTD conformance rules. Use for any change to a slide or deck."
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
- `pptd-app.mjs`: asks the running PPTD app (which renders decks itself, no browser needed):
  - `node pptd-app.mjs shot deck.pptd.html [3|2,5|1-4|all] [--size WxH] [--out DIR]`
    screenshots slides (default: all, 1280×720) and prints one PNG path per slide. Read the
    PNGs to see the slides.
  - `node pptd-app.mjs keys deck.pptd.html` presses real arrow keys and clicks ‹ ›, and checks
    there are zero `<script>` tags. Exits non-zero on failure.

  Don't launch Google Chrome or another browser for screenshots or tests.
- `pptd-check.mjs deck.pptd.html`: PPTD conformance checker. `pptd-spec.md`: the format.
- `pptd-deck.mjs`: adds, removes and reorders slides with all the numbering done for you
  (§3). Use it for every structural change; you only write slide content.
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
4. **Size everything with container units.** `.deck { container-type: inline-size }` and every
   font size, gap, padding and box size as plain `Ncqw` (1cqw = 12.8px at 1280×720), so the
   whole slide scales as one picture. No `clamp()` with px floors or caps, and no
   `@media (max-width…)` phone layout: on a phone the deck is a miniature of the same slide,
   not a reflowed page. Only 1px hairline borders stay in px. Check at 1280×720, 1920×1080, a
   tall frame such as 1000×1000 and a phone (390×844): the phone must look like the 1280×720
   slide, shrunk.
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
- **Click zones:** a click or tap on the slide itself also navigates: the left third goes back,
  the rest goes forward (the whole slide on the first one). The template does this with the
  labels' `::before` (the `.controls` rules), so keep its `.controls` CSS and the labels'
  `aria-label="Previous slide"` / `"Next slide"` exactly. Links in a slide sit above the zones.
  There is no swipe: that would need a script.
- **Arrow keys:** the radios are *invisible but focusable* (not `hidden`, not
  `display: none`). A focused radio group natively moves with ←/→ (and ↑/↓), which many
  presentation clickers also send. `autofocus` on r1 gives focus on load; clicking a ‹ ›
  label refocuses the radio.
- **Slides switch instantly.** No `animation` or `transition` on `.slide` (no fade or slide-in
  on entry): a fade from part-transparent shows the deck background through, a flash on every
  change. Motion inside a slide (a hover, a progress bar) is fine.
- Known limits, worth telling the user: clicking slide content drops focus (click ‹ or ›
  once to get arrows back); arrows wrap from last slide to first; Teams may ignore
  `autofocus`, so the first arrow press may need one click first.
- First slide uses `<span class="nav-ph">` instead of ‹, last slide instead of ›.

**Adding, removing or reordering slides: use `pptd-deck.mjs`** (in this folder; run it
with `node` and its absolute path, from the deck's folder):

```sh
node pptd-deck.mjs list   deck.pptd.html          # outline: number, id, title, words
node pptd-deck.mjs add    deck.pptd.html --after 3   # empty slide at position 4 (0 = first)
node pptd-deck.mjs add    deck.pptd.html --after 5 --count 2   # two empty slides, positions 6–7
node pptd-deck.mjs move   deck.pptd.html 5 2      # slide 5 to position 2
node pptd-deck.mjs delete deck.pptd.html 4
```

- It renumbers everything: radios, `#rN:checked ~ #sN` rules, ids, `aria-label` numbers,
  ‹ › targets, `N / total` counters, progress widths, and per-slide CSS (`#s3 …`) and jump
  links that refer to a moved slide. It checks the result with the checker and refuses
  (leaving the file alone) rather than save a broken deck.
- `add` makes an empty slide and prints a placeholder (`<!-- pptd:new-slide … -->` and
  `<h2>New slide</h2>`). Replace those two lines with the slide's content using your normal
  edit tool, and put the title in the section's `aria-label`. **To add several slides, add
  them in one call** (`--count`), then fill each placeholder; each is unique, so fill them in
  any order. Don't alternate add and fill.
- Each position keeps its own `.controls` and `.progress`; slide content is everything else.
  Keep per-slide chrome inside those two elements and content outside them.
- Slide numbers change after every add, move and delete: run `list` again rather than
  reusing numbers from before.
- **Only if it refuses** (e.g. a deck under 3 slides, or a layout it doesn't recognise), do
  it by hand: update the radio list, the `#rN:checked ~ #sN` selector list, every section's
  `id`/`aria-label`, each `‹ › for=` target, every `N / total` counter and every progress
  width (`N/total × 100%`), then run `pptd-app.mjs keys`. When renumbering with a regex, match
  only `<section …>` tags, or it will also rewrite CSS attribute selectors.

## 4. Diagrams for complicated concepts

If a slide needs more than two sentences to explain how something works, draw it.

- **Linear flow (3–6 steps):** HTML `.path` of `.node` + `.arrow`. Highlight the step the slide
  is about with `.node.hl`.
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

## 6. Type, alignment and consistency

A deck looks designed when the same kind of thing looks the same everywhere. That matters more
than any one element fitting perfectly.

- **One type scale, set in the stylesheet.** Font sizes come from the classes in the
  `<style>` block (`h2`, `.lead`, `h3`, `p`, `.tag`, `.footer`, …). Never put `font-size`,
  `line-height`, `letter-spacing` or `white-space: nowrap` in a `style=""` attribute.
- **Same role, same size, on every slide.** All card headings match, all big numbers
  match, all body text matches, within a slide and across the deck. If one element needs a
  different size, the design is wrong, not the size.
- **Readable floors at 1280×720:** body text and card text no smaller than the template's `p`
  size, labels and tags no smaller than the `.tag` size, nothing (SVG labels included) under
  about 11px. Never shrink text to make it fit.
- **When text wraps, overflows or looks cramped, fix it in this order:**
  1. Reword: shorter words, fewer words ("3 developers" → "3 devs" only if that reads well).
  2. Restructure: e.g. a big number with its unit as a smaller label underneath, used the
     same way in every sibling card ("171" / "tickets", "3" / "developers").
  3. Re-layout: fewer columns, a wider box, or split the slide.
  4. Only then change a size, for the whole role (the class in the stylesheet), so every
     element of that kind changes together, and check every slide that uses it.
- **Parallel things are built alike.** Sibling cards have the same structure (tag, heading,
  one sentence), similar text length, equal height and aligned tops. A row of stats uses the
  same form in every cell: all numbers, or all words.
- **Align to the grid.** Use the template's layout classes (`.grid`, `.panel`, …) and their gaps.
  No one-off `margin`/`padding` nudges in `style=""`. Text is left-aligned unless the
  template centres it. Edges line up across a slide.
- **Spacing follows the template.** Keep the same distance between eyebrow, headline, lead and
  content on every slide.
- If the user's request can only be met by breaking these rules, say so, propose the
  alternatives above and let them choose.

## 7. Check before handing over

1. `node pptd-app.mjs keys deck.pptd.html` → all PASS, 0 script tags.
2. `node pptd-app.mjs shot deck.pptd.html` (every slide at 1280×720), then Read each PNG:
   no overlapping or clipped text, nothing hidden behind the ‹ › controls or the footer,
   no labels crossing chart lines, no heading or label that wraps on its own while its
   siblings don't, and matching sizes and alignment for elements of the same kind (§6).
   `grep -n 'style="[^"]*font-size' deck.pptd.html` should find nothing. After a change to one
   slide, shoot that slide and its neighbours (`shot deck 2-4`) rather than the whole deck.
3. Spot-check a couple of slides with `--size 1920x1080` and `--size 1000x1000` (Teams-like frame).
4. PDF: the `@media print` block lets any browser print the deck; the user does that themselves.
5. `node pptd-check.mjs deck.pptd.html` → CONFORMING.
6. Tell the user the file path. Commit only if asked.
