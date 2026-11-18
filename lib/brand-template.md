# Brand

<!--
  PPTD brand file. The agent in the PPTD app reads it before designing slides.

  Where it applies:
  - brand.md in a deck's folder applies to the decks in that folder.
  - Your default brand file (PPTD › File › Edit Brand…) applies everywhere else.

  Write it for the agent, in plain language. Files you mention (a logo, say) are
  looked up next to this file. Delete these comments when you're done.
-->

Name: (your organisation or project)

## Colours

Paste-ready tokens for the deck's `:root` brand block. Change the values; keep the names.

```css
:root {
  --ink: #1c2230;        /* headings, body text */
  --ink-2: #434b5c;      /* secondary text */
  --muted: #6b7385;      /* captions, footers */
  --paper: #f7f7f5;      /* slide background */
  --accent: #4361ee;     /* accents, arrows, top bar */
  --accent-soft: #eef1fe;/* callouts, hover rows */
  --highlight: #f25c3b;  /* title rule, step numbers. Sparingly */
  --title-bg: linear-gradient(125deg, #12151d 0%, #1c2230 58%, #2b3a8c 100%);
  --title-eyebrow: #b9c4ff;
  --title-soft: #e3e6ee;
  --title-footer: #a9b0c0;
  --font: Inter, "Segoe UI", system-ui, Arial, sans-serif;
}
```

Colour names to use in conversation (e.g. "our navy"): …

## Logo and assets

- (e.g. `logo.svg` next to this file: bottom-left of title slides only, 12% of slide width.)
- (Or: no logo on slides.)

## Typography

- (System fonts only; web fonts don't load offline or in Teams previews.)

## Voice and wording

- (e.g. British English. Sentence case headlines. No exclamation marks.)

## Do and don't

- (Anything else the agent should always or never do on your slides.)
