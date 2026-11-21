# Style: mono

Black, white and one red dot. For technical reviews, RFCs and board pre-reads, where density
and trust matter more than drama. Quiet like a well-typeset paper.

**Use for:** design reviews, RFCs and proposals, architecture, pre-reads sent ahead of a
meeting, anything read closely rather than presented.
**Less suited to:** pitches, workshops and anything meant to excite (use `bold`, `sticker`,
`keynote` or `playful`).

Starting deck: `template.html` in this folder. Its CSS: `style.css`.

## Rules

- **System sans in light and regular weights;** never bold headlines. Numbers are large
  and light (300); the "after" number is regular (500).
- **The accent is an inverted block** (`.hl`): the core component, the recommended step, the
  "after" state. The recommended column or tier is a pale grey panel.
- **The highlight is one small red dot per slide,** placed next to the thing to look at
  (`.key`, the `.hl` stat, the "now" item). Never red text, never red fills.
- The slide's eyebrow is a quiet note at the top right; the headline sits top left.
- Number figures and sections; use margin notes; tabular numerals in every table.
- 1px black rules, square corners, no shadows, no icons. **Photos in greyscale.**
- **Fill:** 40–55% normally; dense slides (tables, specs) up to 85%.

## Type and spacing (at 1280×720)

Headline 52 · slide title 28 · statement 48 light · lead 20 · body 16 · dense 13–14 ·
labels 12–13 · footer 11 · numbers 72 light. Margins 80; a 12-column grid.

## With a brand

Every colour comes from the brand's tokens, but mono only works with a near-black `--accent`
(or `--ink`) and a single strong `--highlight` for the dot. With a colourful brand, use the
brand's darkest colour as the accent and its brightest as the dot; keep everything else
grey.

The palette it was designed with, for "use the style's own colours":
`--ink #000000 · --ink-2 #3a3a3a · --muted #707070 · --paper #ffffff · --accent #000000 ·
--accent-soft #f0f0f0 · --highlight #ff3b00 · --title-bg #000000 · --title-eyebrow #ffffff ·
--title-soft #bdbdbd · --title-footer #8a8a8a`, font `system-ui, -apple-system, "Segoe UI",
Roboto, sans-serif`.
