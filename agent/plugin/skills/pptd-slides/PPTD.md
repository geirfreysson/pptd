# Working on a deck inside the PPTD app

You were started from **PPTD** ("PowerPoint is dead"), the app the user is presenting from. The user can see
the deck next to this terminal.

## Which slide

- Every message from the user comes with a `<pptd-current-slide>` note giving the slide on
  screen, e.g. slide 3 = `<section id="s3">`.
- **If the user doesn't name a slide, the request is about that slide.** "Make the title
  shorter" means the title on the current slide.
- A slide the user names ("slide 5", "the closing slide", "the chart") takes precedence.
- Requests about the whole deck ("fix the typos everywhere") apply to every slide.

## Changes the user makes in the app

- The user can reorder slides by dragging them in the app's slide drawer, and add images or
  video by dropping them on a slide. The app saves those changes itself and tells you in a
  `<pptd-user-edit>` note, which can arrive with a message or in the middle of your work.
- After such a note, what you read earlier is stale: **re-read the deck before editing it**.
  After a move, slide numbers and `<section id="sN">` ids refer to positions, so "slide 3"
  earlier in the conversation may now be a different slide. Go by the slide's content.
- A moved slide's content moves, while each position keeps its id, `.controls` and `.progress`,
  so the deck needs no renumbering after a move. Don't undo the user's change.

## Editing

- Edit the `.pptd.html` file directly. The app watches it, reloads the moment you save, and
  stays on the same slide, so the user sees each change. Don't open a browser or start a server.
- Make targeted edits to the section concerned. Don't rewrite the whole file.
- Keep the file a conforming PPTD v1 deck (`pptd-spec.md` in this folder). **Add, remove and
  reorder slides with `node <this skill folder>/pptd-deck.mjs`** (SKILL.md §3): it does all
  the numbering, so you only write slide content. After other edits, run
  `node <this skill folder>/pptd-check.mjs <deck>` and fix every FAIL. Use absolute paths,
  from the deck's folder; the app pre-approves exactly those two commands.
- New decks: see "New presentations" below. They keep `<meta name="pptd" content="1">`.
- Slide design follows SKILL.md (≤40 words per slide, headline states the conclusion, §6 type
  and alignment) and the deck's brand.
- **When the user says something looks wrong** (a line wraps, a box is cramped, things don't
  line up), fix the cause without making that element different from its siblings. Don't
  shrink one element's font or add one-off inline styles. Reword, restructure or re-layout
  (SKILL.md §6), then screenshot the slide and compare it with its neighbours before saying
  it's done.

## New presentations

- The user creates presentations by asking you ("make a 6-slide deck about our Q3 results").
  There's no New button.
- Start from `template.html` in this folder. Save as `<name>.pptd.html` in the folder the
  `<pptd-current-slide>` note gives (or one the user names). PPTD opens it as soon as you
  save, so write the file once with all slides, then refine it with edits.
- Give it the brand first (below), then the content.

## Brand

Branding is handled by talking to you; the app has no brand settings.

- **Each deck carries its own brand**, so it looks the same wherever it's opened:
  `<meta name="pptd-brand" content="Brand name">` and a `<style id="pptd-brand">` block that
  holds the brand's `:root` tokens, plus its rules in a leading CSS comment (the template
  shows the shape). It comes after the main `<style>`, so its tokens win.
- **The default brand** is a Markdown file (its path is in the `<pptd-brand>` note). Every
  new deck copies it in: its name into the meta, its tokens and a one-line summary of its
  rules into the brand block. Its rules on logos, wording and layout apply when designing.
- **A different brand for one deck:** if the user asks ("use Google colours for this one"),
  change only that deck's meta and brand block. The default stays as it is.
- **Change the default:** only when the user asks ("make this my default brand"). Rewrite
  the default brand file; existing decks keep their own brand.
- The deck on screen keeps its brand unless the user asks to change it. A deck with no brand
  block keeps its current look; when asked to brand it, add the meta and the block, and point
  its hard-coded colours at the tokens.
- Files a brand mentions (a logo, say) are next to the default brand file. Embed them in the
  deck as `data:` URIs.

### First presentation (no default brand yet)

When the `<pptd-brand>` note says no default brand has been set up and the user asks for a
new presentation, ask about branding **before** building anything. One short message, for
example:

> Before I make your first presentation: what branding should your decks use? For example:
> - "Google colours"
> - "navy #1b2a4a, teal #0f9d8a, coral #ff6f59"
> - "black and white, minimal"
> - "our logo is ~/Desktop/logo.svg, colours from it"
> - "no preference" (PPTD's neutral style)

Then:

1. Write the default brand file at the path in the note, following `brand-template.md` in this
   folder: turn the answer into the colour tokens (pick readable `--ink`/`--paper` contrast and
   soft variants yourself), plus any rules the user gave. Fill in what they didn't say sensibly.
   "No preference" means the template's neutral tokens, with Name: PPTD neutral.
2. Tell the user, briefly: this is now their **default brand** for new presentations; any
   presentation can have a **different brand** just by asking (e.g. "use red and grey for
   this one"); and they can ask you to change the default at any time.
3. Then build the presentation they asked for, with that brand.

Don't ask again once a default brand exists. Don't run this for edits to an existing deck.

## Images and video

- The user adds media by dropping it onto the slide. The app embeds it, so you don't need to:
  ```html
  <figure class="pptd-media pptd-image">
  <img alt="…" src="data:image/jpeg;base64,…">
  </figure>
  ```
  `pptd-video` holds a `<video controls>`. The styling is in `<style id="pptd-media">`.
- The `data:` URI is always on a line of its own and can be megabytes long. **Never print,
  copy or retype it.** Read the file with your file-reading tool, which truncates long lines, or with
  `grep -v 'base64,'`, and edit the lines around it. To move a figure, move the three lines
  together with a tool that copies them unchanged (e.g. a small script). Never retype them.
- Layout changes (side-by-side with text, smaller, a caption) are fine: wrap the figure or add
  classes. Keep the `pptd-media` class so the base styling still applies.
- If the user gives a file path for an image instead of dropping it, embed it as a `data:` URI
  inside the same figure markup, written by a script and not typed out.

## Don't

- Don't add `<script>`, external links to fonts, CDNs or images, or speaker notes.
- Don't touch the in-page `.controls`; the app hides them, but they must still work in a browser.
