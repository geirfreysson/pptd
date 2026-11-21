---
title: Editing by hand
description: Reorder slides, drop in images and video, copy and export slides.
---

# Editing by hand

You don't have to ask the agent for everything.

## The slides drawer

Press **⌥⌘S** to open the drawer: a picture of every slide. Click one to show it, and
**drag** it to reorder.

With the slides drawer open, select a slide and press **Delete** to remove it. Press **⌘Z**
or choose **Undo** in the message at the top of the window to restore it.

## Images and video

**Drop images or video** onto a slide, or onto a slide in the drawer. Photos are resized and
iPhone photos converted for you. Everything is stored inside the deck file, so it still works
when you send it.

The agent often leaves **photo placeholders**: striped boxes with a short note on what picture
would work ("a portrait, same crop as the others", "the store after, same angle"). Drop a
photo onto one and it fills that box, cropped to fit. Drop it anywhere else on the slide and
it goes into the first empty placeholder. Dropping onto a filled one replaces the photo.

On a slide **without a placeholder**, the picture goes at the end of the slide and the agent
opens, already told what you added. Tell it what to do with the picture ("make it the
background", "put it beside the list", "give it a slide of its own").

## Documents for the agent

Drop a **Word, Excel or PowerPoint** file (or a text, Markdown, CSV or JSON file) onto the
window and it goes to the agent instead of onto a slide. PPTD turns it into text the agent can
read: headings, lists and tables from Word, every sheet from Excel, every slide (with its
speaker notes) from PowerPoint, and any pictures inside. The agent opens, and you tell it what
to make: "chart revenue by region on this slide", "turn this report into a ten-slide deck",
"rebuild this PowerPoint as a PPTD deck". The deck doesn't change until you ask.

This works with no deck open too. Very large spreadsheets are cut to their first 2,000 rows per
sheet, and the agent is told so. Older .doc, .xls and .ppt files can't be read: save them as
.docx, .xlsx or .pptx first. The text stays on your Mac; it's removed when the window closes.

## Copy and export

- **Copy a slide as an image** with **⇧⌘C**, to paste into an email or chat.
- **Export every slide** as a PNG with **File › Export Slides as Images…**.

## Undo

**⌘Z** takes back the last move, drop or revert, as does the **Undo** button on the message
that appears at the top of the window.

## Other editors

A deck is an ordinary HTML file. Edit it in any other editor and PPTD picks up the change
without losing your place.

Whatever you change by hand, the agent is told about it, so its next edit starts from the
deck as it is now.
