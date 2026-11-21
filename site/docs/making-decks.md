---
title: Making decks
description: Ask the agent for a deck, change it by talking about it, and keep your brand.
---

# Making decks

## Ask for a deck

Click **Make a new one** on the start screen (or press **⌘J**) and say what you want:

> Make a 6-slide deck about our Q3 results.

The agent writes the deck, and PPTD opens it as soon as it's saved. New presentations go in
`Documents/PPTD`.

## Change it by talking about it

Then just talk about what you see. Every message carries the slide on screen, so
*"make this shorter"* means **this** slide unless you name another. Some things to try:

- *"Make the headline shorter."*
- *"Turn this into a chart."*
- *"Add a slide about pricing after this one."*
- *"Split slide 4 into two."*

Changes appear in place as the agent saves them: you stay on the slide you're looking at, and
you can keep typing while it works. In the agent, **Enter** sends and **Shift+Enter** starts a
new line.

When you [edit by hand](./editing-by-hand.md), the agent hears about your changes, so it never
works from an out-of-date picture of the deck.

## Pick a style

Every deck has a style that decides its layout, separate from its colours:

- **Grid**: quiet and editorial. Hairlines, square corners, one accent per slide. For board
  and quarterly reviews, reports, research and technical talks.
- **Bold**: warm and confident. Heavy headlines and rounded cards that fill the slide. For
  pitches, launches, all-hands and workshops.
- **Folio**: editorial, like a well-set annual report. Serif headlines and a margin rail with
  the section and page number. For board and operating reviews, strategy and research.
- **Signal**: technical and dense, like a good dashboard. Mono headlines and panels; dark
  when your brand is dark. For engineering reviews, architecture and metrics.
- **Atelier**: geometric and warm, like a design-school poster. Flat circles, squares and
  arches carry the numbers. For workshops, training and community talks.
- **Classic**: PPTD's original look, with white cards and a coloured bar along the top.

The agent picks the style that suits what you asked for and tells you which. To choose:
*"use the grid style"*. To switch a finished deck: *"make this deck bold"*. Your slides and
your brand stay; only the layout changes. Want the same style every time? *"Always use
grid."*

Whatever the style, the agent designs by the same principles: each slide makes one point,
its headline states the conclusion, there is one thing to look at first, and the closing
slide says what you need from the audience.

## Your brand, on every deck

The first time you make a presentation, the agent asks how your decks should look:
"Google colours", your company's hex codes, "black and white, minimal", or no preference.
That becomes your **default brand**.

Every deck keeps its own copy of its brand, so it looks the same wherever it's opened, and
changing your default later doesn't restyle old decks.

- Something different for one deck? *"Use red and grey for this one."*
- Change the default? *"Make this my default brand."*
- Any brand works with any style.

## Go back to any prompt

Turn on **View › Save Prompts in Decks** and every prompt that changes a deck is kept with it.
Open the slides drawer's **Prompts** tab to see how a deck was built, prompt by prompt, and
press **↺** on any of them to put the deck back as it was at that point.

Nothing is lost when you go back: later prompts stay in the list, so you can jump forward
again.

:::note Prompts travel with the file
The prompts are saved inside the deck, so anyone you send it to can read them. That's why
this is off until you turn it on. **File › Remove Prompt History** clears them from a deck.
:::

## Choosing the agent

PPTD's built-in agent, [Pi](./pi.md), is the default. If you use **Claude Code**, choose it in **View › Agent**.
Both work the same way in PPTD. Press **⌘N** for a new window: each window has its own deck
and its own agent.
