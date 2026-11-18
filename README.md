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
`node_modules` is missing. If PPTD is already running, the file opens in its front window, or the window already
showing it.
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
  to show it. Pictures refresh whenever the file changes. **Drag a slide** to move it; a line
  shows where it lands. ⌘Z undoes the move. The slide's content moves while each position keeps
  its arrows, counter and progress bar, so the deck stays valid. The agent is told about the
  move (and about dropped media), so it re-reads the deck instead of trusting slide numbers it
  saw earlier.
- **New presentations**: press ⌘J and ask for one ("make a 6-slide deck about our Q3
  results"). With no deck open, the agent works in `~/Documents/PPTD`; the app opens the new
  deck as soon as the agent saves it.
- **Agent** (bottom, ⌘J): a coding agent in a terminal, started in the deck's folder. ⌘J puts
  the cursor in it, so you can type straight away (even while it starts). Each message
  you send carries the slide on screen, so "make the headline shorter" applies to that slide
  unless you name another one. The agent edits the file; the app reloads it straight away and
  stays on the same slide. **Hide** keeps the session; **Stop**/**Restart** end it or start a new one.
- **Choosing the agent** (View › Agent): **Pi** is built in and is the default, so nothing needs
  installing. If Pi has no AI model to use when you open the agent, the agent pane shows a
  sign-in panel: **Sign in with ChatGPT** (Plus/Pro), **Sign in with Claude** (Pro/Max), or an
  **Anthropic API key**. Pi starts as soon as you're signed in. View › Agent › Sign In to a Model
  for Pi… opens it again later. PPTD's Pi keeps its sign-ins, settings and sessions in its own
  folder (`PPTD/pi` in your application-data folder, e.g. `~/Library/Application Support/PPTD/pi`),
  apart from any pi you run yourself, so your own pi extensions and instructions don't affect it.
  An API key in your shell profile, such as `ANTHROPIC_API_KEY`, also works.
- **What the agent knows:** every message you send carries the deck and the slide on screen (and
  the brand), so "make this shorter" means that slide. Pi's footer shows it live
  (`PPTD · deck · slide 3 of 7`). **Claude Code**
  uses your installed `claude`; the first time in a folder, it asks whether you trust it. The
  choice applies to new sessions; press **Restart** to switch a running one.
- **Drop images or video** on the slide (or on a slide in the drawer): the app embeds them
  as a centred, rounded image or a video with controls, on that slide. Photos are scaled to
  2560 px and HEIC is converted to JPEG. Videos over 25 MB ask first. **⌘Z** undoes the last drop.
  Dropping a file on the terminal pastes its path instead.
- Edits made in any editor are picked up too: the app watches the file.

### The agent's context

Agents started from the app load the bundled slide skill `pptd-slides` (for Claude Code, as
the plugin `agent/plugin`; for pi, with `--skill`). It is brand-neutral and maintained in this repo:

- `SKILL.md`: slide structure, layout, diagrams, writing, checks.
- `PPTD.md`: working inside the app (current slide, new decks, branding, media).
- `template.html`: the starting deck. Its brand is one `<style id="pptd-brand">` block.
- `brand-template.md`: the shape of the default brand file.
- `pptd-deck.mjs`: adds, removes and reorders slides, so the agent only writes content.
- `pptd-spec.md`, `pptd-check.mjs`, `pptd-deck.mjs`: copied from `docs/` and `tools/` by
  `npm run sync-skill`, which also runs before every build.

Pi needs nothing installed: the app ships it (`@earendil-works/pi-coding-agent`, pinned in
`vendor/pi`) and runs it on its own Electron runtime. Claude Code must be installed (`claude` on
your login-shell PATH, or set `PPTD_CLAUDE`). Machines without Node still get a `node` for the
skill's checker: the app's runtime, last on the agent's PATH. pi also gets the bundled ripgrep
and fd first on its PATH, so nothing is downloaded at first launch.

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
| In the agent terminal: Shift+Enter | new line in the prompt (Enter sends it) |
| ⌘Z | undo the last dropped image or video, or slide move |
| ⌘R | reload the deck |
| ⌘N | new empty window (each window has its own deck and agent session) |

## How it works

- `main.js`: windows, layout, slideshow modes, file watching, media drops, undo, menu. Each
  window (⌘N) has its own deck, undo history, thumbnails and agent session.
- `deck-preload.js`: runs inside the deck. Catches navigation keys (so the deck's own radio
  group can't wrap from last to first) and dropped files.
- `index.html` / `renderer.js` / `preload.js`: toolbar, slides drawer, terminal (xterm.js).
- `lib/thumbs.js`: renders slide pictures in a hidden offscreen window (one per app window).
- `lib/media.js`: embeds images/video into a slide's `<section>`.
- `tools/pptd-deck.mjs`: adds, removes and reorders slides with all the numbering done
  (`list`, `add --after N [--count K]`, `move FROM TO`, `delete N`). Agents use it from the skill; the
  drawer's drag-to-reorder uses it too. Checks the result and refuses rather than break a deck.
- `lib/agent.js`: starts the chosen agent in a pty (node-pty) with the skill and a system
  prompt. Each message gets the deck, slide and brand added; files it writes are reported, and
  the app opens decks it creates. The app also watches the agent's folder for new decks.
  Claude Code does this with `UserPromptSubmit`/`PostToolUse` hooks; pi with the extension below.
- `agent/pi/pptd-extension.js`: the pi extension that adds the slide note to each prompt,
  reports written files, draws PPTD's startup header and shows the slide on screen in pi's footer.
- `agent/pi/login.mjs` / `lib/pi-login.js`: model sign-in for pi. The helper runs pi's own login
  code and credential store; main relays its prompts to the sign-in panel and opens the browser.
- `vendor/pi`: the bundled pi, pinned by its own lockfile. `vendor/tools/<os>-<arch>`: pinned
  ripgrep and fd for pi (its grep tool and `@` file completion), so pi never downloads them.
  `tools/vendor-pi.mjs` installs both (checking each download's SHA-256) after `npm install` and
  before builds; they ship as `Resources/pi` and `Resources/pi/bin`, with their licences.
- `lib/brand.js`: reads a deck's brand block and finds the default brand.
- Navigation checks the next or previous `input.slide-radio`, which is the switching
  mechanism the skill uses. Other HTML files still open; arrow keys are then left to the page.
- Decks run sandboxed with no Node access. Web links open in your default browser.

## Licence

GPL-3.0-or-later (see `LICENSE`). You may use, change and share PPTD; if you distribute a
modified version, you must share its source under the same licence.
