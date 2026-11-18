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

Local builds are ad-hoc signed, so they run on the Mac that built them. Releases are signed
and notarized by GitHub Actions (below).

### Signed releases

`.github/workflows/release-macos.yml` builds an Apple Silicon DMG signed with a Developer ID,
with hardened runtime (`build/entitlements.mac.plist`), notarized and stapled. Push a tag that
matches `package.json` (`git tag v0.3.0 && git push --tags`) to publish a GitHub release, or run
the workflow by hand to get the DMG as a build artifact. It needs these repository secrets:

| Secret | Value |
|---|---|
| `CSC_LINK` | base64 of the Developer ID Application `.p12` certificate |
| `CSC_KEY_PASSWORD` | the `.p12` export password |
| `APPLE_API_KEY_BASE64` | base64 of the App Store Connect API key (`AuthKey_….p8`) |
| `APPLE_API_KEY_ID` | that key's ID |
| `APPLE_API_ISSUER` | the App Store Connect issuer ID |

```sh
gh secret set CSC_LINK < <(base64 -i DeveloperID.p12)
gh secret set CSC_KEY_PASSWORD
gh secret set APPLE_API_KEY_BASE64 < <(base64 -i AuthKey_XXXXXXXXXX.p8)
gh secret set APPLE_API_KEY_ID
gh secret set APPLE_API_ISSUER
```

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
- **New presentations**: press ⌘J and ask for one ("make a 6-slide deck about our Q3
  results"). With no deck open, the agent works in `~/Documents/PPTD`; the app opens the new
  deck as soon as the agent saves it.
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
- `PPTD.md`: working inside the app (current slide, new decks, branding, media).
- `template.html`: the starting deck. Its brand is one `<style id="pptd-brand">` block.
- `brand-template.md`: the shape of the default brand file.
- `pptd-spec.md`, `pptd-check.mjs`: copied from `docs/` and `tools/` by `npm run sync-skill`,
  which also runs before every build.

Claude Code must be installed (`claude` on your login-shell PATH, or set `PPTD_CLAUDE`).

## Branding

Branding is something you tell the agent; the app has no brand settings.

- **First presentation:** the agent asks what branding your decks should use, with examples
  ("Google colours", hex codes, "black and white, minimal", "no preference"). Your answer
  becomes your **default brand**, saved as `~/Library/Application Support/PPTD/brand.md`.
- **Every deck carries its own brand** in its HTML: `<meta name="pptd-brand" content="…">` and
  a `<style id="pptd-brand">` block with the brand's colour tokens and rules (spec §8). New decks
  copy the default in, so changing the default later doesn't restyle existing decks.
- **A different brand for one deck:** ask ("use red and grey for this one"). Only that deck
  changes.
- **Change the default:** ask ("make this my default brand").

With every message the agent is told whether the deck on screen has its own brand and where
the default brand is (or that there isn't one yet).

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
  and hooks: `UserPromptSubmit` adds the deck, slide and brand to each message; `PostToolUse`
  reports files it writes. The app also watches the agent's folder, and opens decks it creates.
- `lib/brand.js`: reads a deck's brand block and finds the default brand.
- Navigation checks the next or previous `input.slide-radio`, which is the switching
  mechanism the skill uses. Other HTML files still open; arrow keys are then left to the page.
- Decks run sandboxed with no Node access. Web links open in your default browser.

## Licence

GPL-3.0-or-later (see `LICENSE`). You may use, change and share PPTD; if you distribute a
modified version, you must share its source under the same licence.
