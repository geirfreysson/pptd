# Style: classic

PPTD's original look: white cards with hairline borders and rounded corners, an 8px
ink-to-accent bar along the top of every content slide, centred flow nodes, bold headlines.
Decks made before styles existed (no `pptd-style` meta) look like this.

**Use for:** status updates, project and delivery reporting, internal working sessions;
when the user wants the familiar PPTD look.

Starting deck: `template.html` in this folder. Its CSS: `style.css`.

## Rules

- Content slides: paper background, the top bar, an `.eyebrow` (`01 · Section`), an `h2`
  headline, an optional `.lead`, the main block in `.content`, and a `.footer` with the source.
- Title and closing slides use `.title-slide` (`--title-bg`, a `--highlight` top bar and the
  `.title-mark` rule under the headline).
- Highlight the one element the slide is about with `.hl` (an accent ring); use the
  `--highlight` colour for step numbers and "now" only.
- Cards are white on paper; don't put cards inside cards.
- **Fill:** the main block takes 55–70% of the space between headline and footer.

## With a brand

Works with any brand: every colour comes from the tokens. Text on accent fills (the winning
column's header) is `--on-accent`, the accent as text is `--accent-text`, and text on the
highlight (step numbers) is `--on-highlight`; a brand with a light accent or highlight sets
these (see the bold style's notes).
