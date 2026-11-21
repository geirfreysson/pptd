# Style: sticker

Loud, chunky and confident, like a startup pitch deck. Every container is a box with a 3px
ink border, round corners and a hard offset shadow; headings in a black-weight sans; one
tilted "sticker" per slide.

**Use for:** investor and sales pitches, product launches, marketing, consumer brands.
**Less suited to:** board reviews, technical detail and anything that must look sober
(use `grid`, `folio` or `mono`).

Starting deck: `template.html` in this folder. Its CSS: `style.css`.

## Rules

- **Every box has a 3px ink border, an 18px radius and a hard shadow** (offset, no blur).
  Pills and circles take a full radius.
- **One container is the hero:** fill it with the accent (the `.hl` card, the hero stat
  circle, our column). At most two coloured containers on a slide.
- **The highlight is the sticker:** one tilted call-out per slide (the `.key` figure, the
  takeaway, "now"), tilted 1.5–4°. Never tilt more than one thing, never tilt body text.
- Headings and numbers in Arial Black / 900. No thin weights.
- Section dividers flood with the highlight, the section name in a big pill.
- Keep copy short and punchy: it's a pitch.
- No blurred shadows, gradients or hairlines; keep shadows out of the ‹ › corner.
- **Fill:** 65–75%. Containers are big and chunky and fill their row.

## Type and spacing (at 1280×720)

Headline 76 · slide title 44 · statement 56 · lead 23 · card heading 22 · body 17–18 ·
labels 13–15 / 900 · footer 12. Margins 64, top 56; content ends at y 660.

## With a brand

Every colour comes from the brand's tokens. Sticker wants a saturated `--accent`, a bright
`--highlight` that reads with `--on-highlight` (default ink) and a warm, light `--paper`.
`--title-eyebrow` is used for the tilted badge on the title slide. Text on a fill is always
ink or paper.

The palette it was designed with, for "use the style's own colours":
`--ink #141414 · --ink-2 #3a3a3a · --muted #5e5e5e · --paper #fff6e5 · --accent #5b3df5 ·
--accent-soft #e4ddff · --highlight #7be0b0 · --title-bg #5b3df5 · --title-eyebrow #ffe066 ·
--title-soft #e4ddff · --title-footer #c3b8ff`, font `system-ui, -apple-system, "Segoe UI",
Roboto, sans-serif`.
