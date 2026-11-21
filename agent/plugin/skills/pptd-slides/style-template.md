# Style: name

<!--
  The shape of a style's STYLE.md. The folder name is the style's name (lowercase, digits
  and -), and this heading must match it. The agent chooses styles by the "Use for" line, so
  make it specific. Keep this file to what is particular to the style: the principles every
  style shares are in DESIGN.md.
-->

One or two sentences on the look and its character: what it feels like, what it is
reminiscent of.

**Use for:** the decks and audiences it suits (be specific: "board and operating reviews,
strategy papers", not "business").
**Less suited to:** what it's wrong for, and which style to use instead.

Starting deck: `template.html` in this folder. Its CSS: `style.css`.

## Rules

- **Its structural device:** rules, tinted fills, outlined boxes, panels, shapes…
- **The accent** marks … (one thing per slide).
- **The highlight** is … (how and how often).
- Type: which weights, which faces for headlines, labels and body.
- Numbering, labels, eyebrow treatment.
- What it never does.
- **Fill:** NN–NN% of the content area.

## Type and spacing (at 1280×720)

Headline · slide title · statement · lead · card heading · body · labels · footer, in px.
Spacing steps. Margins; where content ends.

## With a brand

What the style needs from a brand (a light or dark paper, a strong accent, a bright
highlight), and which optional tokens a brand may need to set for it (`--on-accent`,
`--accent-text`, `--on-highlight`, `--on-title`). Its display or label font tokens, if any,
and how a brand with one typeface overrides them.

The palette it was designed with, for "use the style's own colours":
`--ink … · --ink-2 … · --muted … · --paper … · --accent … · --accent-soft … · --highlight … ·
--title-bg … · --title-eyebrow … · --title-soft … · --title-footer …`, font `…`.
