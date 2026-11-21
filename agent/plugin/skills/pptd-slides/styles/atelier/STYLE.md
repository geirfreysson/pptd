# Style: atelier

Geometric and warm, like a design-school poster. Every slide is built from a four-shape kit
(circle, square, half-circle, quarter-circle), flat and in full colour. Shapes carry the
data: numbers sit inside them, process steps are arches, a schedule is a strip of time
blocks. Colour panels and big shapes bleed off the edge. Geometric bold headlines (Futura),
a humanist sans for reading.

**Use for:** workshops and co-design sessions, training, public-sector and community
presentations, internal launches, anything that should feel friendly, clear and made with
care.
**Less suited to:** dense financial or technical reporting (use `grid`, `folio` or `signal`).

Starting deck: `template.html` in this folder. Its CSS: `style.css`.

## Rules

- **Build from the kit:** circle, square, half-circle (arch), quarter-circle. Flat full
  colour; radius is 0 or a full shape radius, never in between. No gradients, outlines,
  shadows or soft corners.
- **Shapes carry data or structure, never decoration behind text.** A number inside a
  shape (`.stats`), arches for steps (`.steps`), time blocks (`.timeline`), a pie on a
  section divider, a dot marking the statement.
- **The accent is the structure colour:** title and section grounds, the key data shape,
  the recommended column, the takeaway panel.
- **The highlight is the spark:** one shape or one short phrase per slide. It may flood a
  whole quote slide. Never highlight-coloured text on paper.
- **At most four colours on a slide** (paper, ink, accent, highlight, with accent-soft as a
  tint of the accent).
- **Flood one slide per section** with the accent or the highlight (title, section,
  quote, closing) for rhythm.
- A chart's takeaway is a colour panel taking the right third of the slide, bleeding off
  the edge; keep the headline and chart to the left two-thirds.
- Keep the bottom-right corner (the ‹ › controls) free of shapes.
- **Fill:** 60–70% of the content area; 85% with a colour panel.

## Type and spacing (at 1280×720)

Headline 80 (title) / 56 (statement) / 60 (section) display bold · slide title 44 ·
lead 22 · card heading 24–26 · body 17–18 / 1.45 · labels 14 / 600 capitals · footer 12.
Spacing 8 · 16 · 24 · 32 · 40 · 64. Margins 64 left and right, 56 top; content ends at y 660.

## With a brand

Every colour comes from the brand's tokens. Atelier needs a strong mid-dark `--accent`
(text on it is `--on-accent`) and a bright `--highlight` that reads with `--on-highlight`
text (default `--ink`) on a flooded quote slide; a dark highlight needs
`--on-highlight: #fff`. A warm off-white `--paper` suits it. Headlines use `--font-display`
(Futura, Century Gothic, Avenir Next); a brand with one mandated typeface sets
`--font-display: var(--font)`.

The palette it was designed with, for "use the style's own colours":
`--ink #1d1b18 · --ink-2 #45413a · --muted #6f685d · --paper #efe8da · --accent #2347a6 ·
--accent-soft #d5dbee · --highlight #f4b400 · --title-bg #2347a6 · --title-eyebrow #f4b400 ·
--title-soft #d5dbee · --title-footer #a9b6de`, font `"Avenir Next", Avenir, "Segoe UI",
system-ui, sans-serif`.
