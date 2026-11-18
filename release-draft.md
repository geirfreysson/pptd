# PPTD v0.1.0

The first release of PPTD: presentations you make by asking, saved as single HTML files that
open anywhere.

## Make and change decks by asking

- Press ⌘J and ask for a presentation. The agent writes it and PPTD opens it as soon as it's
  saved; new decks go in `Documents/PPTD`.
- Every message carries the slide on screen, so "make this shorter" means that slide.
- Built-in agent, nothing to install: sign in with ChatGPT (Plus/Pro), Claude (Pro/Max) or an
  Anthropic API key. Claude Code can be used instead (View › Agent).
- The agent checks its own work by looking at the slides as PPTD renders them.

## Edit by hand

- Slides drawer (⌥⌘S) with a picture of every slide; drag to reorder.
- Drop images or video onto a slide. Photos are resized and HEIC converted.
- Copy a slide as an image (⇧⌘C) or export every slide as a PNG.
- ⌘Z undoes moves, drops and reverts. The agent is told about your changes.

## Brands

- The first deck asks how your presentations should look; that becomes your default brand.
- Each deck keeps its own brand, so it looks the same wherever it's opened. Ask for a
  different look for one deck, or to change the default.

## Prompt history (optional)

- Turn on View › Save Prompts in Decks to keep every prompt that changed a deck. The
  drawer's Prompts tab lists them, and ↺ puts the deck back as it was after any of them.
- Off by default, because the prompts are saved in the file you share.

## Present

- Full-screen slideshow (⌘↩) or a slideshow in the window (⌘⌥↩).

## Platforms

- macOS (Apple Silicon), Windows (x64) and Linux (x64: AppImage and .deb). This first release
  isn't signed, so macOS and Windows ask you to confirm the first time you open it (below).
