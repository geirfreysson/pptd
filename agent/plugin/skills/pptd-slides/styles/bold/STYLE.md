# Style: bold

Warm, confident and high-contrast. Heavy headlines, rounded tinted surfaces that stretch to
fill the slide, pill labels, and one solid accent surface per slide.

**Use for:** pitches, product launches, all-hands, workshops and training, internal
updates that should feel energetic.
**Less suited to:** dense reviews, audit and status reporting (use `grid` or `classic`).

Starting deck: `template.html` in this folder. Its CSS: `style.css`.

## Rules

- **One idea per slide;** headlines of two lines at most.
- **One solid accent surface per slide:** the hero card (`.card.hl`), the current step, the
  winning column's header, the current bar, or a section divider's background. Never more.
- **The highlight is a marker stroke** under 1–4 key words (`.key`, once per slide), or the
  "now" pill on a timeline. Never a background or a chart colour.
- **Tinted fills, no borders or shadows.** Surfaces are `--accent-soft` or the neutral tint;
  only table rows get a hairline.
- **Pill labels** instead of plain eyebrows (the `.eyebrow` is drawn as a pill).
- Weights 700–800 for headlines; never thin weights or outlined boxes. Don't mix square and
  rounded corners: radius 20 for cards, 16 for list items, 12 for bars, pills fully round.
- **Fill:** 65–75% of the space between headline and footer. Cards, steps and stats stretch
  to fill their row, so slides feel full.
- Body text never below 18px at 1280×720.

## Type and spacing (at 1280×720)

Headline 88 (title, closing) / 64 (statement) / 96 (section divider) · slide title 44 / 800 ·
lead 26 · card heading 26 / 700 · body 20 / 1.4 · labels 14 / 700 pills · footer 13 ·
stats 72 / 800. Spacing steps 8 · 16 · 24 · 40 · 56 · 80; 40 from title to content. Margins
72 left and right, 64 top; content ends at y 660, the footer band is the last 30px.

## With a brand

Every colour comes from the brand's tokens, so any brand works, but bold puts text **on**
the accent, so check these pairings when you apply a brand (and set the override in the
deck's brand block when one doesn't read):

- Text on accent fills is `--on-accent` (default `--paper`). A light accent (yellow, lime,
  light blue) needs `--on-accent: <the brand's dark ink>`.
- The accent as text on `--paper` / `--accent-soft` is `--accent-text` (default `--accent`).
  A light accent needs a darker shade of it, e.g. `--accent-text: #7a6200` for `#f5c400`.
- The `.key` stroke is `--marker` (default: the highlight at 65%). If the brand's highlight is
  dark, set `--marker` to a light tint, e.g. `color-mix(in srgb, var(--accent) 45%, transparent)`.
- Text on the highlight ("now" pill) is `--on-highlight` (default `--ink`); a dark highlight
  needs `--on-highlight: #fff`.

The palette it was designed with, for "use the style's own colours":
`--ink #1f1813 · --ink-2 #4b3f36 · --muted #7a6c60 · --paper #fbf7f1 · --accent #c8461f ·
--accent-soft #f8e1d5 · --highlight #ffd23f · --title-bg linear-gradient(150deg, #2b1d15,
#5a2614) · --title-eyebrow #ffb08c · --title-soft #ecdccd · --title-footer #bca390`, font
`Inter, "Segoe UI", system-ui, -apple-system, Roboto, sans-serif`.
