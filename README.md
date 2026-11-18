# PPTD — PowerPoint is dead

A macOS app for presentations that are single HTML files (`*.pptd.html`). It plays them with
native controls and a slideshow mode, and edits them with an agent in a terminal next to the
slides. The deck's in-page ‹ › buttons are hidden; navigation lives in the app's toolbar.

```sh
npm install
npm start                      # then ⌘O, or drop a .html file on the window
npm start -- path/to/deck.pptd.html  # open a file directly
```

### From the command line

```sh
npm link                         # once: puts `pptd` on your PATH
pptd path/to/deck.pptd.html
```

`pptd` (in `bin/`) starts the dev version in this repo, or the installed app if
`node_modules` is missing. If PPTD is already running, the file opens in its window.
Relative paths are resolved from the folder you run it in.

## Build the native app

```sh
npm run build   # → dist/mac-arm64/PPTD.app   (fast, no installer)
npm run dist    # → dist/PPTD-<version>-arm64.dmg
```

The app icon is `build/icon.icns`, made from `build/source-icon.png` by `npm run icon`
(white rounded square with macOS padding; needs Python with Pillow). `npm start` keeps its
settings in `PPTD Dev`, so it can run next to an installed PPTD.app.

The build is ad-hoc signed (no Apple Developer certificate), so it runs on this Mac. On
another Mac, Gatekeeper will block it until you right-click → Open, or until the build is signed
and notarized with a Developer ID.

The app registers as an *alternate* handler for `.html`, so it appears in Finder's
**Open With** menu without taking over as the default browser. (macOS can't associate a
double extension like `.pptd.html` on its own.)

## The PPTD format

Decks are saved as `<name>.pptd.html`. The spec agents must follow is in
[`docs/pptd-spec.md`](docs/pptd-spec.md). Check a file with:

```sh
npm run check -- path/to/deck.pptd.html
```

## Editing with the app

- **Slides drawer** (left, ⌥⌘S): a picture of every slide. It scrolls on its own; click a slide
  to show it. Pictures refresh whenever the file changes.
- **Agent** (bottom, ⌘J): Claude Code in a terminal, started in the deck's folder. Each message
  you send carries the slide on screen, so "make the headline shorter" applies to that slide
  unless you name another one. The agent edits the file; the app reloads it straight away and
  stays on the same slide. **Hide** keeps the session; **Stop**/**Restart** end it or start a new one.
  The first time in a folder, Claude Code asks whether you trust it.
- **Drop images or video** on the slide (or on a slide in the drawer): the app embeds them
  as a centred, rounded image or a video with controls, on that slide. Photos are scaled to
  2560 px and HEIC is converted to JPEG. Videos over 25 MB ask first. **⌘Z** undoes the last drop.
  Dropping a file on the terminal pastes its path instead.
- Edits made in any editor are picked up too: the app watches the file.

### The agent's context

Agents started from the app load a bundled Claude Code plugin (`agent/plugin`) with the
slide skill `pptd-slides`. It is brand-neutral and maintained in this repo:

- `SKILL.md`: slide structure, layout, diagrams, writing, checks.
- `PPTD.md`: working inside the app (current slide, live reload, media, brand files).
- `template.html`: the starting deck. All brand colours and the font are in one `:root` block.
- `pptd-spec.md`, `pptd-check.mjs`: copied from `docs/` and `tools/` by `npm run sync-skill`,
  which also runs before every build.

Claude Code must be installed (`claude` on your login-shell PATH, or set `PPTD_CLAUDE`).

## Branding

Brand rules live in a Markdown **brand file**, outside the app, so they never ship with it and
updates never overwrite them. The agent is told which one applies with every message.

1. `brand.md` in the deck's folder: a project or client brand, kept next to its decks.
2. Your default brand: `~/Library/Application Support/PPTD/brand.md`.
3. Neither: the skill's neutral palette.

**File › Edit Brand…** opens the brand in effect (creating your default from a template the
first time). **Edit Default Brand…** and **New Brand for This Folder** do what they say. A brand
file has paste-ready `:root` tokens plus plain-language rules for logos, type and wording;
logo files sit next to it. Changes apply from the agent's next message.

## Controls

| | |
|---|---|
| ‹ › toolbar buttons, ← → ↑ ↓, PageUp/PageDown | previous / next slide (stops at the ends, no wrap) |
| Home / End | first / last slide |
| **▶ Slideshow** (⌘⇧↩) | full-screen slideshow |
| **▾ → Fill Window** (⌘⌥↩) | slideshow inside the current window (toolbar hidden) |
| In a slideshow: Enter / Space | next slide (Shift+Enter, Backspace: previous) |
| In a slideshow: Esc | end the slideshow |
| ⌥⌘S / ⌘J | slides drawer / agent terminal |
| ⌘Z | undo the last dropped image or video |
| ⌘R | reload the deck |

## How it works

- `main.js`: window, layout, slideshow modes, file watching, media drops, undo, menu.
- `deck-preload.js`: runs inside the deck. Catches navigation keys (so the deck's own radio
  group can't wrap from last to first) and dropped files.
- `index.html` / `renderer.js` / `preload.js`: toolbar, slides drawer, terminal (xterm.js).
- `lib/thumbs.js`: renders slide pictures in a hidden offscreen window.
- `lib/media.js`: embeds images/video into a slide's `<section>`.
- `lib/agent.js`: finds `claude`, starts it in a pty (node-pty) with the plugin, system prompt
  and a `UserPromptSubmit` hook that adds the current slide and brand file to each message.
- `lib/brand.js`: brand-file lookup; `lib/brand-template.md` is the blank brand file.
- Navigation checks the next or previous `input.slide-radio`, which is the switching
  mechanism the skill uses. Other HTML files still open; arrow keys are then left to the page.
- Decks run sandboxed with no Node access. Web links open in your default browser.
