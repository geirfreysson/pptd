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

## Editing

- Edit the `.pptd.html` file directly. The app watches it, reloads the moment you save, and
  stays on the same slide, so the user sees each change. Don't open a browser or start a server.
- Make targeted edits to the section concerned. Don't rewrite the whole file.
- Keep the file a conforming PPTD v1 deck (`pptd-spec.md` in this folder). After structural
  edits (adding, removing or reordering slides), update all the numbering listed in SKILL.md §3,
  then run `node <this skill folder>/pptd-check.mjs <deck>` (absolute path, from the deck's
  folder; the app pre-approves exactly that command) and fix every FAIL.
- New decks: save as `<name>.pptd.html` and add `<meta name="pptd" content="1">` to `<head>`.
- Slide design follows SKILL.md (≤40 words per slide, headline states the conclusion) and the
  brand file, if one applies.

## Brand

- Each message's note also carries a `<pptd-brand>` line: either the path of the brand file
  that applies to this deck, or a statement that none does.
- The app looks for `brand.md` in the deck's folder first, then for the user's default brand
  file. The first one found applies.
- When one applies, read it (once per session, and again if the note names a different file)
  and follow it: its `:root` tokens go into the deck's brand tokens block, and its rules on
  logos, wording and layout override SKILL.md. Files it refers to (a logo, say) are relative
  to the brand file's folder.
- New decks get the brand from the start. Existing decks keep their look unless the user
  asks you to apply the brand.
- Don't edit the brand file unless the user asks you to.
- With no brand file, keep the template's neutral tokens.

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
