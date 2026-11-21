# Brand

<!--
  PPTD default brand: used for every NEW presentation. The agent writes this file from
  what the user says about branding; the user doesn't edit it by hand (but can).
  Each deck copies the brand into its own <meta name="pptd-brand"> and
  <style id="pptd-brand"> when it is created, so changing this file later doesn't
  restyle existing decks.
-->

Name: (your organisation or project)
Style: (optional: the default style for new decks: `grid`, `bold`, `folio`, `signal`,
`atelier`, `keynote`, `mono`, `sticker`, `playful` or `classic`. Blank: the agent chooses per deck.)

## Colours

Tokens for the deck's `<style id="pptd-brand">` block. Keep the names; set the values.

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
  /* Only when the defaults don't read, e.g. a light (yellow) accent or a dark highlight: */
  /* --on-accent: #111;      text on accent fills (default --paper) */
  /* --accent-text: #7a6200; the accent as text on paper (default --accent) */
  /* --on-highlight: #fff;   text on highlight fills (default --ink) */
  /* --on-title: #f6f3ee;    headlines on --title-bg, for a dark brand whose --paper is dark */
}
```

Colour names to use in conversation (e.g. "our navy"): …

## Logo and assets

- (e.g. `logo.svg` next to this file: bottom-left of title slides only, 12% of slide width.
  Embed it in decks as a data: URI.)
- (Or: no logo on slides.)

## Typography

- (System fonts only; web fonts don't load offline or in Teams previews.)

## Voice and wording

- (e.g. British English. Sentence case headlines. No exclamation marks.)

## Do and don't

- (Anything else the agent should always or never do on your slides.)
