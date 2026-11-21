# Style: playful

Friendly, round and a bit messy on purpose. Rounded heavy type, 3px outlines, generous
corners, pills and organic blob shapes. Warm without being childish.

**Use for:** teaching and training, schools and kids, community groups, onboarding,
workshops, internal fun.
**Less suited to:** finance, board and technical reviews (use `grid`, `folio` or `mono`).

Starting deck: `template.html` in this folder. Its CSS: `style.css`.

## Rules

- **3px ink outlines,** radius 22–28 for cards, 12 for chips, full for pills; organic blobs
  behind portraits and photos. No soft shadows.
- **The accent is the main character:** the recommended plan, "you are here", the build
  blocks. **The highlight is the outcome:** the after state, the end of the path.
  `--title-eyebrow` (sun) is for stickers and badges only.
- **One tilted sticker per slide;** never tilt body text.
- Processes read as an adventure path: chips staggered up and down, joined by dots, the
  last step in the outcome colour.
- Emoji only as functional icons, at most one per card. Real illustrations or photos, never
  clip-art people. Real language from the audience in the copy.
- At most three fills on a slide. **Playful never means empty: fill 65–75%.**

## Type and spacing (at 1280×720)

Headline 68 · slide title 40 · statement 52 · lead 21 · card heading 21 · body 15–18 ·
labels 13–14 pills · footer 12. Margins 72; cards snap to an 8px grid.

## With a brand

Every colour comes from the brand's tokens. Playful wants a dark, friendly `--ink` (indigo
rather than black), a warm `--accent`, a contrasting `--highlight` (set `--on-highlight` to
white when it's mid-dark) and a sunny `--title-eyebrow`. Headlines use `--font-display`
(SF Pro Rounded, Arial Rounded, Trebuchet); a brand with one mandated typeface sets
`--font-display: var(--font)`.

The palette it was designed with, for "use the style's own colours":
`--ink #2a1e5c · --ink-2 #4b4178 · --muted #6f6696 · --paper #fff8ef · --accent #ff5a5f ·
--accent-soft #ffe3de · --highlight #2fb79c · --title-bg #2a1e5c · --title-eyebrow #ffd166 ·
--title-soft #ddd7f7 · --title-footer #aaa0dc · --on-highlight #ffffff`, font `ui-rounded,
"SF Pro Rounded", system-ui, sans-serif`.
