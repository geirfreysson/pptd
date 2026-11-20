---
title: File format
description: What a .pptd.html file is, and the rules a deck follows.
---

# File format

Decks are saved as **`<name>.pptd.html`**: one self-contained HTML file with every image and
video inside it and **no scripts**, so it's safe to open anywhere. It works on its own in any
browser and in the Microsoft Teams file preview, and it plays in PPTD, which replaces the
in-page ‹ › buttons with its own controls and adds a slideshow mode. Everything on a slide is
sized relative to the slide, so on a phone the deck is a miniature of itself rather than a
reflowed page.

The format is open. Any tool, or any agent, can write a deck PPTD will play.

## The rules at a glance

A PPTD deck:

1. Is saved as **`<name>.pptd.html`**: one file, UTF-8.
2. Has **`<meta name="pptd" content="1">`** in `<head>`.
3. Makes each slide a `<section class="slide">` and switches slides with **one hidden radio
   input per slide**: `<input type="radio" name="slide" class="slide-radio">`.
4. Puts every in-page navigation control inside an element with **`class="controls"`**.
5. Uses **no `<script>`** and no inline event handlers.
6. Loads **nothing external**: no CDN, web fonts, remote images or stylesheets.
7. Sizes the deck as a **16:9 box** in a `.deck` element, with text scaled to the deck.

Everything else is free: content, layout and branding.

## How slides change without scripts

Each slide has a hidden radio button, listed before the slides. The ‹ › buttons are
`<label>`s for the previous and next radio, so clicking one ticks it, and a CSS rule shows the
slide whose radio is ticked:

```css
.slide { display: none; }
#r1:checked ~ #s1, #r2:checked ~ #s2, #r3:checked ~ #s3 { display: flex; }
```

The labels' `::before` also stretches over the slide as click
zones: the left third goes back, the rest goes forward, so a click or tap anywhere works on a
phone too.

Because the radios share a name, the arrow keys move between them natively, so keyboard
navigation works in a plain browser too. PPTD drives a deck the same way: it ticks the n-th
radio and never runs anything in the page.

## The full specification

The complete spec, with embedded media, brands, prompt history, a conformance checklist and a
minimal example file, is
[`docs/pptd-spec.md`](https://github.com/geirfreysson/pptd/blob/main/docs/pptd-spec.md) in
the repository. The repository also has a checker that validates a deck against it:

```sh
npm run check -- deck.pptd.html
```

For an example, [open the demo deck](pathname:///demo/pptd-demo.pptd.html) and view its source.
