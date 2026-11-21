# Style: keynote

Photo first, words second, like a product keynote. Big confident type, photos that bleed to
the edge, very little chrome. Designed dark.

**Use for:** kick-offs, all-hands, launches, customer stories, anything carried by pictures
and a few big statements.
**Less suited to:** dense analysis and status reporting (use `grid`, `mono` or `folio`).

Starting deck: `template.html` in this folder. Its CSS: `style.css`.

## Rules

- **Photos lead.** Use `.photo-slide` (photo on two-thirds, or `.full`) and `.photos`
  generously; one hero photo per slide, supporting photos are details at a third of the size.
- **Text never sits on the raw photo:** it goes on the solid side; the scrim joins them. A
  slide with text over a photo carries 25 words at most.
- **Brief every photo** in `data-brief`: the subject, and where it sits (the third opposite
  the text, with space where the type goes). Portraits share crop, eye line and background.
- Photos may bleed under the ‹ › corner; text and controls may not.
- The **accent** marks the one featured thing (the core node, the popular tier, the
  "after"); the **highlight** is for good numbers and the eyebrow on a photo.
- Square corners, no shadows, 1px rules at low contrast. No stock handshakes, no rounded
  photo corners, no more than three photos on a slide.
- **Fill:** photo slides 100%; text slides about 60%.

## Type and spacing (at 1280×720)

Headline 84 · slide title 44 · statement 60 · lead 22 · card heading 22 · body 16–17 ·
labels 13 capitals tracked +0.16em · footer 12 · stats 72. Margins 72; photos bleed.

## With a brand

Every colour comes from the brand's tokens; keynote looks its best with a dark brand. A dark
brand sets `--paper` near-black, `--ink` warm white, `--accent-soft` a dark tint of the accent,
`--title-bg` the paper colour and `--on-title` the ink colour (headlines on title slides).
With a light brand it becomes a bright, photo-led deck.

The palette it was designed with, for "use the style's own colours":
`--ink #f6f3ee · --ink-2 #cfc9bf · --muted #968f85 · --paper #0e0e0f · --accent #ff6b35 ·
--accent-soft #2c1b13 · --highlight #ffd27a · --title-bg #0e0e0f · --title-eyebrow #ffd27a ·
--title-soft #e6e0d6 · --title-footer #a8a196 · --on-title #f6f3ee · --on-accent #0e0e0f`,
font `"Helvetica Neue", Helvetica, "Segoe UI", Arial, sans-serif`.
