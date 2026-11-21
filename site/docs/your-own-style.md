---
title: Make your own style
description: Turn a design you like into a PPTD style, with Claude Design or any other source.
---

# Make your own style

Besides the [built-in styles](./styles.md), you can have styles of your own. You bring a
design; the agent studies it and turns it into a style that works with any content and any
brand. Your styles stay on your computer and are used just like the built-in ones.

## 1. Get a design

The best source is a small set of example slides plus the rules behind them. Any of these
work:

- **A design made with Claude** (Claude Design): download it as a zip. The prompt below gets a
  design that converts well.
- **An HTML page or a slide deck** someone made, or a **PDF** of one.
- **Screenshots** of slides you like.
- **Your organisation's brand guidelines**, if they describe slide layouts.

### A prompt for Claude Design

> Design a presentation style called **[name]** for **[what it's for: board reviews, sales
> pitches, teaching…]**. Describe the feel in a sentence: **[calm and editorial / loud and
> playful / …]**.
>
> Constraints:
> - 16:9 slides at 1280×720. System fonts only (give a font stack). No web fonts, no
>   JavaScript, flat CSS and inline SVG only.
> - Colours as exactly these tokens: `--ink, --ink-2, --muted, --paper, --accent,
>   --accent-soft, --highlight, --title-bg, --title-eyebrow, --title-soft, --title-footer`.
> - Keep the bottom-right 160×60px free (navigation) and a 30px footer band.
>
> Show these slides, with realistic sample content for one fictional company: title, agenda,
> section divider, one big statement, three points, a 4–5 step process, 3–4 big numbers, a
> comparison table, a chart with its takeaway, a dense data table, an architecture diagram,
> a photo slide, before/after photos, a team slide with portraits, a quote, pricing tiers, a
> timeline, a closing slide with the decisions you need, and an appendix.
>
> Then add two spec slides: the type scale in px, spacing, grid and margins, how much of the
> slide content fills, corners, borders and shadows; what the accent and the highlight are
> for; and five do's and don'ts that make the style recognisable.

## 2. Ask for the style

Tell the agent where the design is and what to call the style:

> *"Make a style called harbour from ~/Downloads/design.zip"*

The agent:

1. unpacks the design and looks at every slide. Nothing in it is run: a Claude Design zip
   contains scripts, and PPTD renders the slides with scripts and the network switched off;
2. works out the system behind it: palette, type, spacing, how it separates things, what the
   accent is for;
3. turns that into a style that works for any content and any brand, rather than copying the
   slides;
4. checks it, and tries it with the design's own colours, your brand and a difficult colour
   (a pale yellow accent), and fixes what doesn't read;
5. shows you a few slides, and offers to keep the design's colours as a brand too.

## 3. Use it

> *"Make a 6-slide deck about our Q3 results in the harbour style"*
> *"Make this deck harbour"*
> *"Always use harbour"*

The agent also considers your styles when it chooses one for you.

## Change, share or remove a style

- **Change it** by asking: *"Make the headlines bigger in my harbour style"*. Decks you've
  already made keep the style they were made with, because every deck carries its own copy.
- **Share it**: your styles are folders in the PPTD folder in your application data
  (`~/Library/Application Support/PPTD/styles` on a Mac). Copy one to someone else's same
  folder.
- **Remove it**: delete its folder. Decks made with it still look the same.

## Without PPTD's agent

Your styles are plain folders (`STYLE.md`, `style.css`), so you can also make or edit one with
Claude Code, or by hand, in that `styles` folder. Ask it to follow `PPTD.md` ("Making a
style") in PPTD's slide skill, which is inside the app.

## A one-off look

For a single deck, just describe the look: *"make this one feel like a newspaper"*. The agent
designs it for that deck alone, and offers to save it as one of your styles.
