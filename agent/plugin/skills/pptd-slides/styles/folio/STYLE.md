# Style: folio

Editorial, like a well-set annual report. A margin rail on every slide holds the section
label at the top and a large italic page numeral at the bottom. Serif for what is said
(headlines, quotes, numbers), sans for what is explained. Calm, literate, unhurried.

**Use for:** operating and board reviews, strategy papers, research and policy findings,
anything that should read as considered and authoritative.
**Less suited to:** dense technical detail (use `signal` or `grid`) and high-energy pitches
(use `bold`).

Starting deck: `template.html` in this folder. Its CSS: `style.css`.

## Rules

- **The rail is on every slide:** the slide's eyebrow becomes the section label at its top,
  the footer's second span (the slide number) the italic numeral at its bottom. Put nothing
  else in the rail.
- **Serif headlines are regular weight (400), never bold.** Card headings are serif 600;
  body text, labels and table cells are sans.
- **The accent is structural:** numerals, the step and card numbers, the recommended
  column, the data line or the current bar.
- **The highlight is the editor's pen:** an underline under one phrase (`.key`), a "now"
  marker, or one annotation on a chart. Once per slide; never a fill, never text longer
  than a label.
- **Number with italic roman numerals** (`i. ii. iii.`): cards and asks do it automatically.
- **A 2px ink rule opens every block; 1px hairlines divide inside it.** Square corners, no
  filled cards, no shadows.
- Left-align everything. **Fill:** 50–60% of the field; the calm is the point.
- A results slide with one number that matters: make it `.stat.hl`; folio sets it as a
  hero figure beside a column of the others.
- Processes read as numbered rows; keep each step to a name and one line.

## Type and spacing (at 1280×720)

Headline 84 (title) / 60 (statement) serif 400 · slide title 44 serif · lead 22 sans ·
card heading 24 serif 600 · body 17 sans / 1.5 · labels 12–13 sans 600 tracked capitals ·
folio numeral 64 italic · footer 12. Spacing on a 4 base: 4 · 8 · 12 · 16 · 24 · 40 · 64.
A 208px rail, then the field with 64 margins; content from y 48 to y 660.

## With a brand

Every colour comes from the brand's tokens. Folio wants a warm, slightly off-white
`--paper`, a deep `--accent` (it carries numerals and the data) and a warm, vivid
`--highlight` for the pen. The serif is a style token, `--font-serif` (Iowan Old Style,
Palatino, Charter, Georgia); a brand that allows one typeface only sets
`--font-serif: var(--font)` in its brand block. On the section divider the rail is solid
accent with the numeral in `--on-accent`.

The palette it was designed with, for "use the style's own colours":
`--ink #1b2420 · --ink-2 #3d4843 · --muted #646e68 · --paper #f3efe6 · --accent #1f5c4a ·
--accent-soft #dde8e0 · --highlight #e2552b · --title-bg linear-gradient(160deg, #1a4136,
#0e2520) · --title-eyebrow #f2a582 · --title-soft #c7d3cc · --title-footer #8ba197`, font
`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
