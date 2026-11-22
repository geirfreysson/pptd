---
name: pptd-slides
description: "Build and edit PPTD presentations (*.pptd.html) shown in the PPTD app: slide structure, styles and layouts, diagrams, media, branding via brand files, and the PPTD conformance rules. Use for any change to a slide or deck."
---

> **Inside the PPTD app, read `PPTD.md` in this folder first.** It covers the current slide,
> live reload, embedded media and the brand file. **Before designing slides, read
> `DESIGN.md`:** what makes a presentation good, which every style follows.

# Presentations as web pages

A deck is **one self-contained `.pptd.html` file**: inline CSS, inline SVG diagrams, no
external scripts, fonts or images. It opens from disk in any browser, previews when shared as
a file in Microsoft Teams, prints to PDF, and plays in the PPTD app.

Keep decks local: save them where the user says, and don't upload or publish them anywhere
unless the user asks.

## Files in this skill

- `DESIGN.md`: the design principles behind every style (one point per slide, one focal
  element, colour roles, type scale, the repeating frame, density, data, words).
- `styles/<name>/`: one folder per style (§1): `STYLE.md` (its rules and when to use it),
  `style.css` (its layout CSS), `template.html` (a starting deck in that style, with an
  example of every layout) and `preview.jpg` (nine slides in the style's own palette: look at
  it when choosing a style or borrowing from one). Styles: `grid`, `bold`, `folio`, `signal`, `atelier`, `keynote`,
  `mono`, `sticker`, `playful`, `classic`. The user may also have styles of their own, listed in
  the `<pptd-brand>` note; they work exactly like these.
- `pptd-app.mjs`: asks the running PPTD app (which renders decks itself, no browser needed):
  - `node pptd-app.mjs new deck.pptd.html --style NAME [--slides N] [--brand default|style|FILE]`
    makes a new deck from the style's template, with the brand, and shows it in the user's
    PPTD window (§1).
  - `node pptd-app.mjs open deck.pptd.html` shows that deck in the user's PPTD window.
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
- `pptd-style.mjs`: lists styles (bundled and the user's own), checks and builds a style
  folder, and previews it with a brand (`PPTD.md`, "Styles of your own").
- `style-template.md`: the shape of a style's `STYLE.md`.
- `deck-skeleton.html`: the shared deck every style's `template.html` is built from.

## 1. Style, layouts and brand

A deck's look has three independent layers, each in its own block in `<head>`:

1. **The frame** (the first `<style>`): navigation, sizing, print and the Teams fixes. It is
   the same in every deck. Don't restyle it.
2. **The style** (`<style id="pptd-style">`, named by `<meta name="pptd-style">`): layout,
   type scale, spacing, corners, how cards and charts are drawn. Copied from
   `styles/<name>/style.css`.
3. **The brand** (`<style id="pptd-brand">`, named by `<meta name="pptd-brand">`): colours and
   font, as tokens. Any brand works with any style.

### Styles

| Style | Look | Use for |
|---|---|---|
| `grid` | Quiet, editorial: hairlines, square corners, mono labels, one accent | Board and quarterly reviews, reports, research, technical and architecture talks |
| `bold` | Warm, confident: heavy headlines, rounded tinted cards that fill the slide, one solid accent surface | Pitches, launches, all-hands, workshops and training |
| `folio` | Editorial, like an annual report: serif headlines, a margin rail with section and page numeral, roman numerals | Operating and board reviews, strategy, research and policy findings |
| `signal` | Technical, dashboard-like: mono headlines, panels with shared dividers, a header bar; dark with a dark brand | Engineering and platform reviews, architecture, metrics, developer audiences |
| `atelier` | Geometric and warm: a kit of flat shapes that carry the data, colour panels bleeding off the edge, Futura headlines | Workshops, training, public-sector and community talks, friendly launches |
| `keynote` | Photo first: photos bleeding to the edge, huge type, little chrome; dark with a dark brand | Kick-offs, all-hands, launches, customer stories |
| `mono` | Black, white and one red dot: light type, inverted blocks, dense and calm | Design reviews, RFCs, proposals, pre-reads |
| `sticker` | Loud pitch deck: ink-bordered boxes with hard shadows, black-weight type, one tilted sticker | Investor and sales pitches, launches, consumer brands |
| `playful` | Friendly and round: outlined chips, blobs, an adventure path, rounded type | Teaching, schools, community groups, onboarding, fun workshops |
| `classic` | PPTD's original: white cards with borders, a gradient bar on top | Status and delivery reporting; the user's older decks |

- **Read the deck's `styles/<name>/STYLE.md` before designing slides for it,** and follow its
  rules (how much of the slide to fill, where the accent goes, what never to do).
- **A new deck:** use the style the user names; else the default style in their brand file,
  if it names one; else choose from the table by the deck's purpose. Use the default brand
  unless the user names another. Make it with `pptd-app.mjs new` (`PPTD.md`, "New
  presentations"): it builds the `<head>` (frame, style and brand blocks) from the style's
  `template.html` and shows the deck at once. Use the template's example slides as
  references for markup, not as the deck's outline. The deck's outline comes from the
  content. Say the style and brand
  in one line, because the style's preview shows its own palette, not the user's brand ("Grid
  style with your Ipsos brand; say 'bold style' for a warmer look, or 'grid's own colours'
  for the look in its preview").
- **The style's own colours:** when the user asks for the style's own look ("its own
  colours", "black and white" for mono), use the palette from the style's `STYLE.md` ("With a
  brand"): `new … --brand style` does it for a new deck; for a deck that exists, put it in
  the brand block and name the brand after the style. Don't make up a palette of your own.
- **Restyle a deck** ("make this bold"): replace the `pptd-style` block with the new style's
  `style.css` and change the meta. Slides need no rewrite, because every style draws the same
  layouts. Remove rules of the deck's own that only suited the old style. Then screenshot
  every slide and fix what the new style's rules ask for (e.g. bold wants one solid accent
  surface and a `.key` phrase; grid wants an eyebrow on every slide).
- **A deck with no `pptd-style` block** (made before styles existed) has its look in its first
  `<style>`. Keep it unless the user asks to restyle; then rebuild its `<head>` styles from a
  style's `template.html` (frame, style block, and the deck's own brand block) and keep any
  per-slide rules (`#s3 …`).
- **You have design freedom.** Styles and layouts are a guide and a vocabulary, not a set of
  forms to fill in. Compose slides from the content: combine layouts, design a layout no class
  covers, draw a custom diagram, build a slide around one photo or one number. Build new things
  from the style's tokens, type sizes and spacing, so they belong. Put the deck's own CSS
  (per-slide rules such as `#s4 …`, and new classes) in a `<style>` block after the brand
  block, never in the `pptd-style` block, which a restyle replaces. What is not optional: the
  principles in `DESIGN.md`, the style's voice (`STYLE.md`), the brand's colours, and the
  checks in §7.
- **Apply the style correctly first; then the user can override it.** The first version in
  a style is that style: its type (font, weights, letter-spacing, case), its chrome (bars,
  rules, corners, shadows) and its rules in `STYLE.md`. The deck's own CSS adds to the style.
  Unless the user asks, it doesn't change the style's type, show what the style hides (mono
  hides `.title-mark`), or copy another style's chrome (classic's gradient bar in a mono
  deck). To borrow a device from another style, rebuild it in this style's voice (`DESIGN.md`,
  "Using the styles for inspiration"). When the user asks to change something ("bigger
  title", "a red bar on top"), do that, and only that:
  - Change the role, not its voice. A bigger title is a bigger `font-size`; keep the style's
    weight, font and letter-spacing. Never tighten tracking past the style's value: at
    display sizes, the space between letters shrinks with it and letters touch.
  - Everything else stays as the style draws it. The next change starts from the style plus
    the user's earlier overrides, not from your own additions.
  - If the override clashes with a style rule (a huge drawing in a style that wants a quiet
    cover), make the rest give way: e.g. keep the title clear of the drawing.
- **Each style draws the same markup its own way** (folio sets a `.stat.hl` as a hero figure
  beside the others, signal draws `.bars` horizontally and the timeline as a vertical log,
  atelier puts each stat inside a shape and turns the chart's `.takeaway` into an edge panel),
  so look at the screenshot, not just the markup.

### Layouts

Every style draws these classes; the templates show each one. Put a slide's main block in
`.content`, which takes the height between the headline and the footer. They cover common
shapes of content; they are not a complete list of what a slide can be.

| Content | Markup |
|---|---|
| Title / closing | `section.slide.title-slide`: `.eyebrow`, `.content` > `h1` + `.title-mark` + `.lead`; closing: `.content` > `.split` > `h2` + `ol.asks` |
| Section divider | `section.slide.section-slide` > `.content` > `.section-num` + `.section-text` (`.eyebrow`, `h2`, `.lead`) |
| One claim | `p.statement`, with the words that matter in `span.key` |
| 2–4 parallel points | `.cards` > `.card` (`.num`, `h3`, `p`) |
| A process, 3–5 steps | `ol.steps` > `li.step` (`.num`, `h3`, `p`) |
| 2–4 numbers | `.stats` > `.stat` (`.value` with optional `span.unit`, `.label`, `.delta`) |
| Us vs alternatives | `table.compare`, our column's cells `.win` |
| Chart + takeaway | `.split` > `.bars` (`.bar` with `style="--v: .62"`: `.val`, `.fill`, `.cat`) + `.takeaway` (`.eyebrow`, `h3`, `p`) |
| Status | `table.matrix` with `td.status.green` / `.blue` / `.amber` |
| A worked example | inline SVG in `.diagram` (§4) |
| A quote | `figure.quote` > `blockquote` + `figcaption` (`b` name, `span` role) |
| Roadmap | `ol.timeline` > `li` (`.when`, `h3`, `p`); `li.now`, `li.goal` |
| Agenda | `ol.agenda` > `li` (`.when` time · duration, `h3`, `p`); `li.now` |
| A photo slide | `section.slide.photo-slide` with `figure.photo` (right two-thirds; `.full` for all of it); text on the scrim side, ≤25 words |
| Photos side by side, before/after | `.photos` > `figure.photo` (+ `figcaption` label); `.hl` on the one that matters |
| People | `.people` > `figure.person` (`figure.photo` portrait, `b` name, `span` role) |
| Pricing or options | `.tiers` > `.tier` (`.name`, `.price` with `span.unit`, `ul`); `.tier.hl` recommended |
| Architecture | `.layers` > `.layer` (`.name`, `.boxes` > `.box`); `.box.hl` core, `.box.read` dashed, `.box.wide` |
| Dense numbers | `table.data` (right-aligned tabular figures, units in the header, `tr.hl`, `td.hl`, `tfoot` total) |
| An explanation | `.columns` > `p` (two columns; under about 120 words) |
| Appendix, references | `ol.refs` > `li` (`.num`, the item, `.page`) |
| Older layouts | `.grid.two/.three/.four` of `.panel`, `.tag`, `.callout`, `.path` of `.node` + `.arrow` |

`.hl` marks the one element a slide is about (a card, step, stat or bar); `.est` marks an
estimated bar. Use at most one `.hl` and one `.key` per slide.

**Photos.** `figure.photo` is a photo slot. Leave it empty with a `data-brief` describing
the photo you want (subject, crop, where the empty space is); it shows as a placeholder
with the brief, and when the user drops an image onto it, PPTD fills that slot (the image
becomes an `<img>` inside the figure, cropped to fit). A filled slot's `data:` URI is on its
own line: never print or retype it (`PPTD.md`, "Images and video"). The agenda, photo,
people, tier, layer, data, columns and refs layouts live in the frame's base layer; the
style colours and sets their fonts through its variables, so they look right in every
style.

### Brand

The brand block holds the tokens `--ink`, `--ink-2`, `--muted`, `--paper`, `--accent`,
`--accent-soft`, `--highlight`, `--title-bg`, `--title-eyebrow`, `--title-soft`,
`--title-footer` and `--font`, with the brand's rules in a leading CSS comment. Styles take
every colour from these. (`PPTD.md` covers where brands come from: the user's default brand,
or what they ask for.)

- Follow the deck's brand. Don't invent brand colours, and don't imitate a company's branding
  unless the user asks for it.
- Don't add logos or other copyrighted assets unless the user or the brand supplies the file.
  Embed supplied images as `data:` URIs (see `PPTD.md`, "Images and video").
- Fonts: system fonts only, through `--font`. No web-font download, which Teams and offline
  viewing may block.
- Status colours (`--green`, `--amber`, and `--ink` for proven) are not brand colours and mean
  the same on every slide: green = signed off/ready, ink = proven/proof of concept/agreed,
  amber = in progress/to agree.
- **Check contrast** when a brand meets a style: body text on `--paper`, text on
  `--title-bg`, and anything drawn on the accent. Three optional tokens fix the pairings a
  brand's colours break: `--on-accent` (text on accent fills; default `--paper`),
  `--accent-text` (the accent used as text; default `--accent`) and `--on-highlight` (text on
  highlight fills; default `--ink`). A light accent such as yellow needs all of them. Set them
  in the deck's brand block and in the brand file.

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
  the rest goes forward (the whole slide on the first one). The frame CSS does this with the
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

- **Linear flow (3–5 steps):** `ol.steps` of `li.step` (§1, Layouts). Highlight the step the
  slide is about with `.step.hl`.
- **Anything with structure** (data going in and out, tables, branching, before/after):
  inline SVG inside `.diagram`, with a `viewBox` and `width: 100%`, styled with classes
  (`dg-box`, `dg-label`, `dg-sub`, `dg-arrow`, `dg-step`) rather than inline colours. Give it
  `role="img"`, a `<title>` and a `<desc>` that says in words what it shows. Prefix the
  marker and element ids per slide (`dg4-arr`) so they don't collide.
- **Prefer a worked example to an abstract box diagram.** Show real-looking data moving
  through the steps (e.g. a respondent table → the new column → the resulting table) and
  label it "Illustrative" in the footer if the numbers are made up.
- Number the steps (`.dg-step` circles) when there is an order, and say on the slide what is
  live, what is proof of concept and what is only designed.
- Bar charts of up to about 8 values: the HTML `.bars` layout. Other charts (burn-ups,
  trends): inline SVG, label lines directly instead of using a legend where possible, and keep
  labels clear of the lines.
- One idea per diagram. If labels need to shrink below about 11px at 1280×720, split the slide.

## 5. Writing the slides

- The headline states the conclusion ("Processing is ready. Tables are in progress."),
  not the topic ("Processing status").
- At most about 40 words of body text per slide. Cards: a `.num`, an `h3`, and one or two
  sentences.
- Put sources and caveats in the `.footer`, not the body.
- No presenter-facing instructions on slides ("update before presenting", "TBC").
- Don't overstate: keep "signed off", "pilot proven", "proof of concept" and "agreed"
  distinct, and name who or what is the evidence.

## 6. Type, alignment and consistency

A deck looks designed when the same kind of thing looks the same everywhere. That matters more
than any one element fitting perfectly.

- **Design by `DESIGN.md`:** one point per slide, one focal element, the colour roles,
  the style's density (no small block over an empty half-slide), one numbering system, and
  status tags only for status.
- **Pick the layout from the content's shape:** parallel points → `.cards`; an order →
  `.steps`; numbers → `.stats`; us vs others → `.compare`; one claim → `.statement`; a trend
  → `.bars` beside a `.takeaway`. Don't put a process in cards or numbers in prose.

- **One type scale, set in the stylesheet.** Font sizes come from the classes in the
  `pptd-style` block (`h2`, `.lead`, `h3`, `p`, `.tag`, `.footer`, …). Never put `font-size`,
  `line-height`, `letter-spacing` or `white-space: nowrap` in a `style=""` attribute.
- **Same role, same size, on every slide.** All card headings match, all big numbers
  match, all body text matches, within a slide and across the deck. If one element needs a
  different size, the design is wrong, not the size.
- **Readable floors at 1280×720:** body text and card text no smaller than the style's `p`
  size, labels and tags no smaller than its `.eyebrow` size, nothing (SVG labels included)
  under about 11px. Never shrink text to make it fit.
- **When text wraps, overflows or looks cramped, fix it in this order:**
  1. Reword: shorter words, fewer words ("3 developers" → "3 devs" only if that reads well).
  2. Restructure: e.g. a big number with its unit as a smaller label underneath, used the
     same way in every sibling card ("171" / "tickets", "3" / "developers").
  3. Re-layout: fewer columns, a wider box, or split the slide.
  4. Only then change a size, for the whole role (one rule for the class in the deck's own
     `<style>` block), so every element of that kind changes together, and check every slide
     that uses it.
- **Parallel things are built alike.** Sibling cards have the same structure (number,
  heading, sentence), similar text length, equal height and aligned tops. A row of stats uses the
  same form in every cell: all numbers, or all words.
- **Align to the grid.** Use the style's layout classes (§1) and their gaps. No one-off
  `margin`/`padding` nudges in `style=""`. Text is left-aligned unless the style centres it.
  Edges line up across a slide.
- **Spacing follows the style.** Keep the same distance between eyebrow, headline, lead and
  content on every slide.
- These rules hold when the user overrides the style (§1) too. If a request can only be met
  by breaking them, say so, propose the alternatives above and let them choose.

## 7. Check before handing over

1. `node pptd-app.mjs keys deck.pptd.html` → all PASS, 0 script tags.
2. `node pptd-app.mjs shot deck.pptd.html` (every slide at 1280×720), then Read each PNG:
   no overlapping or clipped text, nothing hidden behind the ‹ › controls or the footer,
   no labels crossing chart lines, no heading or label that wraps on its own while its
   siblings don't, matching sizes and alignment for elements of the same kind, no slide whose
   content ends in the top half with the rest empty, and one focal point per slide (§6).
   Then go through the checklist at the end of `DESIGN.md`.
   `grep -nE 'style="[^"]*(font-size|line-height|letter-spacing|nowrap)' deck.pptd.html`
   should find nothing (§6). After a change to one slide, shoot that slide and its neighbours
   (`shot deck 2-4`) rather than the whole deck.
3. For a new deck or a restyle, Read the style's `preview.jpg` and compare: each difference
   should come from the content, the brand or something the user asked for. Read every rule
   in the deck's own CSS that sets `font-family`, `font-weight`, `letter-spacing` or
   `text-transform` on a style's class, or draws a bar or rule, and remove those the user
   didn't ask for (§1).
4. Spot-check a couple of slides with `--size 1920x1080`, `--size 1000x1000` (Teams-like
   frame) and `--size 390x844` (a phone: the same slide, shrunk; §2).
5. PDF: the `@media print` block lets any browser print the deck; the user does that themselves.
6. `node pptd-check.mjs deck.pptd.html` → CONFORMING.
7. Tell the user the file path. Commit only if asked.
