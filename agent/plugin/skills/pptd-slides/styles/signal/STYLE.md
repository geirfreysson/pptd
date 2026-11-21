# Style: signal

Technical and dense, like a good dashboard or a terminal. A header bar on every slide; mono
for headlines, numbers and labels, sans for sentences; panels butted together with shared
1px dividers; a faint dot grid as texture. Designed dark: a near-black slide with one bright
accent.

**Use for:** engineering and platform reviews, architecture, incident and performance
reports, product metrics, developer audiences.
**Less suited to:** board narratives and anything warm or emotional (use `folio` or `bold`).

Starting deck: `template.html` in this folder. Its CSS: `style.css`.

## Rules

- **The header bar is on every content slide:** the slide's eyebrow, read like a path
  ("Results / p99 latency"), with a small accent square before it.
- **Mono for headlines, numbers and labels; sans for sentences.** Never long paragraphs in
  mono.
- **The accent means "the result":** the hero number, the chosen option, the active node,
  the current bar, an improvement. The **highlight means "live, or watch this"**: a status
  dot, an in-progress release, an incident, a trade-off. At most once per slide, never for
  good news, and never on the same element as the accent.
- **Tag things like code:** `[01]`, `//`, `>`, `▲ ▼` (cards, steps and asks do it).
- **Panels butt together** with shared 1px dividers; the active one gets a 2px accent
  border. Square corners (dots are the only circles), no shadows or glows.
- Put units smaller after big numbers ("9 ms"). Bars run horizontally; the roadmap is a
  vertical log, newest or nearest first.
- **Fill:** 70–80% of the content area: dense like a dashboard, but every number labelled.
- Title and closing slides are the bright accent; content slides stay dark.

## Type and spacing (at 1280×720)

Headline 76 (title) / 52 (statement) mono 700 · slide title 36 mono 700 · lead 21 sans ·
card heading 22 mono 700 · body 17 sans / 1.5 · labels 12 mono capitals · footer 11 mono ·
stats 64 mono 700. Spacing on a 4 base: 4 · 8 · 12 · 16 · 20 · 28 · 32 · 48. A 56px
header bar, then content from y 88 to y 660; 56 side margins.

## With a brand

Every colour comes from the brand's tokens, so signal is only dark when the brand is: with a
light brand it becomes a light technical deck, which works too. For the dark look, the
brand block needs a dark `--paper`, a light `--ink`, a dark `--accent-soft` (the accent at
about 12% on paper) and a bright `--accent`; the title tokens then describe dark text on
the accent (`--title-bg` = the accent, `--title-eyebrow` dark). Set `--on-accent` to the dark
paper colour. If the user's brand is light and they want signal dark, derive a dark variant
of their brand for this deck and say so.

Labels and headlines use `--font-mono` (system monospace); a brand block may set it.

The palette it was designed with, for "use the style's own colours":
`--ink #e7ebee · --ink-2 #b3bcc5 · --muted #808b96 · --paper #0d1115 · --accent #c4f135 ·
--accent-soft #1d2712 · --highlight #ff5c9d · --title-bg #c4f135 · --title-eyebrow #0d1115 ·
--title-soft #2e3c0e · --title-footer #4a5b1a · --on-accent #0d1115`, font
`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
