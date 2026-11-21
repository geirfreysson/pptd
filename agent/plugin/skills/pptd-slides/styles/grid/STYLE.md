# Style: grid

Quiet, precise and editorial. A 12-column grid, hairlines and whitespace instead of boxes,
square corners, mono uppercase labels. The accent marks exactly one thing per slide.

**Use for:** board and quarterly reviews, reports, research findings, architecture and
technical talks, anything that should read as careful and factual.
**Less suited to:** energetic pitches and workshops (use `bold`).

Starting deck: `template.html` in this folder. Its CSS: `style.css`.

## Rules

- **One accent per slide:** the key number, the current step, the winning column or the
  current bar (`.hl` / `.win` / `.key`). Everything else is ink, ink-2 or muted.
- **Highlight is a marker, never text or a fill behind text:** the small square for "now" on
  a timeline, an SLA met, a risk. At most one per slide.
- **Rules, not boxes.** Cards and panels are a 2px rule on top and whitespace. Divide with
  1px hairlines. No rounded corners, no shadows, no filled cards.
- **Left-align everything,** quotes and statements included. Snap edges to the grid: text
  blocks span 8–10 of 12 columns; a takeaway sits in the last 4 (`.split`).
- **Every content slide has an eyebrow:** a short mono label above the headline (the topic,
  the source, the period). Keep it under about 6 words.
- Weights 400–600. Headlines are 500, never bold.
- **Fill:** the main block takes 55–65% of the space between headline and footer. The
  whitespace is part of the design, but a block that sits in a third of the slide is too
  small: add a column, use `.statement`, or pick a bigger layout.

## Type and spacing (at 1280×720)

Headline 72 (title, closing) / 56 (statement, divider) · slide title 40 · lead 24 ·
card heading 26 (other headings 22) / 600 · body 18 (cards 20) · labels 13 mono uppercase ·
footer 12 · stats 72 / 400. Spacing steps 8 · 16 · 24 · 32 · 48 · 64; 48 from title to content.
Margins 64 left and right, 56 top; content ends at y 660, the footer band is the last 30px.

## With a brand

Every colour comes from the brand's tokens, so any brand works. Grid looks best with a
neutral, near-white `--paper` and a single strong `--accent`; a neo-grotesque `--font`
("Helvetica Neue", Inter, "Segoe UI") suits it. Labels use `--font-mono` (system monospace);
a brand block may set it.

The palette it was designed with, for "use the style's own colours":
`--ink #12171d · --ink-2 #3a434e · --muted #69737f · --paper #f5f6f7 · --accent #2b55c8 ·
--accent-soft #e2e8f6 · --highlight #f0b429 · --title-bg #12171d · --title-eyebrow #8eaaf5 ·
--title-soft #aeb6c0 · --title-footer #7d8794`, font `"Helvetica Neue", Helvetica, Inter,
"Segoe UI", system-ui, Arial, sans-serif`.
