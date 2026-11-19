# Developing PPTD

The product description is in the [README](../README.md); the deck format is in
[`pptd-spec.md`](pptd-spec.md). This page is for working on the app itself.

## Run from source

```sh
npm install
npm start                      # then ⌘O, or drop a .html file on the window
npm start -- path/to/deck.pptd.html  # open a file directly
```

`npm start` keeps its settings in `PPTD Dev`, so it can run next to an installed PPTD.app.

### From the command line

```sh
npm link                         # once: puts `pptd` on your PATH
pptd path/to/deck.pptd.html
```

`pptd` (in `bin/`) starts the dev version in this repo, or the installed app if
`node_modules` is missing. If PPTD is already running, the file opens in its front window, or
the window already showing it. Relative paths are resolved from the folder you run it in.

### Check a deck

```sh
npm run check -- path/to/deck.pptd.html
```

## Build the native app

```sh
npm run build   # → dist/mac-arm64/PPTD.app   (fast, no installer)
npm run dist    # → dist/PPTD-<version>-arm64.dmg
```

The app icon is `build/icon.icns`, made from `build/source-icon.png` by `npm run icon`
(white rounded square with macOS padding; needs Python with Pillow).

Local builds are ad-hoc signed, so they run on the Mac that built them.

On macOS the app registers as an *alternate* handler for `.html`, so it appears in Finder's
**Open With** menu without taking over as the default browser. (macOS can't associate a
double extension like `.pptd.html` on its own.) The association is in `build.mac` only: on
Windows and Linux it would make PPTD the handler for every `.html` file.

## Releases

`.github/workflows/release.yml` builds on GitHub Actions, one native runner per platform:

| Platform | Files |
|---|---|
| macOS, Apple Silicon | `PPTD-<version>-mac-arm64.dmg` |
| Linux x64 | `PPTD-<version>-linux-x86_64.AppImage`, `PPTD-<version>-linux-amd64.deb` |
| Windows x64 | `PPTD-<version>-windows-x64-setup.exe` (unsigned, per-user NSIS installer) |

Each comes with a `.sha256`, plus a copy without the version in its name for a stable
"latest" link. Pushing a tag `v<version>` that matches `package.json` publishes one GitHub
release once all three builds pass, with `release-draft.md` (first line exactly
`# PPTD v<version>`) as its notes and `.github/release-install.md` appended.
`npm run release:validate -- v<version>` checks the version, tag and draft before you tag.
Running the workflow by hand builds all three without releasing (the files are kept as
workflow artifacts). Each build runs `tools/verify-release-bundle.mjs` on the packaged app:
pi, this OS's ripgrep and fd (which must run), the skill, and node-pty's native module.

The macOS job requires these repository secrets. It fails before packaging if any is
missing, so every published macOS build is Developer ID signed, notarized and stapled.

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

The certificate and App Store Connect key may be shared with another app released by the
same Apple developer account. GitHub repository secrets are write-only, so copy them from
the original local `.p12` and `.p8` files (or export the Developer ID identity from Keychain
Access); they cannot be read back from another repository.

## Website

The home page and user docs are a Docusaurus site in `site/`, published to GitHub Pages at
<https://geirfreysson.github.io/pptd/>.

```sh
cd site
npm install
npm start          # live preview at http://localhost:3000/pptd/
npm run build      # static site in site/build
```

- `site/src/pages/index.js` is the home page; `site/docs/*.md` are the doc pages (order in
  `site/sidebars.js`).
- `site/static/demo/pptd-demo.pptd.html` is the live deck embedded in the home page. It is a
  real deck made from the skill template, without `autofocus` so it doesn't take focus from
  the page; check it with `npm run check -- site/static/demo/pptd-demo.pptd.html`.
- `.github/workflows/site-pages.yml` builds and deploys on every push to `main` that touches
  `site/`, and can be run by hand. Once, in the repository settings, set Pages › Source to
  "GitHub Actions".
- `npm run serve` redirects `*.html` URLs and drops the `/pptd/` base on the way, so the demo
  deck 404s there. GitHub Pages doesn't do that; to test a build locally, serve a folder
  with `pptd` linked to `site/build` from any plain static server.
- For a custom domain: set `url` and `baseUrl: '/'` in `site/docusaurus.config.js` and add
  `site/static/CNAME`.

## The agent's context

Agents started from the app load the bundled slide skill `pptd-slides` (for Claude Code, as
the plugin `agent/plugin`; for pi, with `--skill`). It is brand-neutral and maintained in this repo:

- `SKILL.md`: slide structure, layout, diagrams, writing, checks.
- `PPTD.md`: working inside the app (current slide, new decks, branding, media).
- `template.html`: the starting deck. Its brand is one `<style id="pptd-brand">` block.
- `brand-template.md`: the shape of the default brand file.
- `pptd-deck.mjs`: adds, removes and reorders slides, so the agent only writes content.
- `pptd-app.mjs`: asks the running app for slide screenshots and the keyboard test, so no
  browser is launched.
- `pptd-spec.md`, `pptd-check.mjs`, `pptd-deck.mjs`: copied from `docs/` and `tools/` by
  `npm run sync-skill`, which also runs before every build.

Pi needs nothing installed: the app ships it (`@earendil-works/pi-coding-agent`, pinned in
`vendor/pi`) and runs it on its own Electron runtime. Claude Code must be installed (`claude` on
your login-shell PATH, or set `PPTD_CLAUDE`). Machines without Node still get a `node` for the
skill's checker: the app's runtime, last on the agent's PATH. pi also gets the bundled ripgrep
and fd first on its PATH, so nothing is downloaded at first launch.

PPTD's pi keeps its sign-ins, settings and sessions in `PPTD/pi` in the application-data
folder (e.g. `~/Library/Application Support/PPTD/pi`), apart from any pi you run yourself.

With every message the agent is told the deck and slide on screen, whether the deck has its
own brand, and where the default brand is (or that there isn't one yet).

The prompt history keeps its snapshots in `history/` in the same data folder, up to 1 GB with
the oldest removed first; `historyMaxMB` in `settings.json` changes the cap.

View › Appearance is stored as `appearance` (`system`, `light`, `dark`) in `settings.json` and
applied with `nativeTheme.themeSource`, so `index.html` switches its colour tokens with
`prefers-color-scheme`.

## How it works

- `main.js`: windows, layout, slideshow modes, file watching, media drops, undo, menu. Each
  window (⌘N) has its own deck, undo history, thumbnails and agent session. When the deck
  changes on disk, `refreshFromDisk` patches the open page in place (`PATCH_JS` morphs the
  DOM, keeping unchanged nodes) instead of reloading it; ⌘R and non-radio pages reload.
- `deck-preload.js`: runs inside the deck. Catches navigation keys (so the deck's own radio
  group can't wrap from last to first) and dropped files.
- `index.html` / `renderer.js` / `preload.js`: toolbar, slides drawer, terminal (xterm.js).
- `building.js`: the canvas animation on the empty stage while the agent runs a prompt
  (`agent-busy` IPC from `setBusy` in main, body class `agent-busy`).
- `lib/thumbs.js`: renders slide pictures in a hidden offscreen window (one per app window).
- `lib/shot.js`: full-size slide screenshots and the keyboard-navigation test, in a hidden
  offscreen window (Copy Slide as Image, Export Slides as Images, and the agent's tool).
- `lib/app-socket.js`: a local socket (`PPTD_SOCKET`, owner-only) through which the skill's
  `pptd-app.mjs` asks the running app for screenshots and the key test.
- `lib/media.js`: embeds images/video into a slide's `<section>`.
- `lib/history.js`: the prompt history: reads and writes the deck's
  `<template id="pptd-prompts">`, hashes decks without it, and keeps snapshots in
  `userData/history/<hash>.html.gz`. The agent reports each prompt and the end of each run;
  main records the run in the decks it changed.
- `tools/pptd-deck.mjs`: adds, removes and reorders slides with all the numbering done
  (`list`, `add --after N [--count K]`, `move FROM TO`, `delete N`). Agents use it from the skill; the
  drawer's drag-to-reorder uses it too. Checks the result and refuses rather than break a deck.
- `lib/agent.js`: starts the chosen agent in a pty (node-pty) with the skill and a system
  prompt. Each message gets the deck, slide and brand added; files it writes are reported, and
  the app opens decks it creates (`*.pptd.html`, or `.html` with the PPTD meta). The app
  also watches the agent's folder for new decks, and when a run ends with no deck on screen it
  opens the newest deck the run wrote in that folder or two levels below.
  It also reports each prompt and the end of each run, for the prompt history. Claude Code
  does this with `UserPromptSubmit`/`PostToolUse`/`Stop` hooks; pi with the extension below.
- `agent/pi/pptd-extension.js`: the pi extension that adds the slide note to each prompt,
  reports written files, prompts, messages sent mid-run and run ends, draws PPTD's startup
  header and shows the slide on screen in pi's footer.
- `agent/pi/login.mjs` / `lib/pi-login.js`: model sign-in for pi. The helper runs pi's own login
  code and credential store; main relays its prompts to the sign-in panel and opens the browser.
- `vendor/pi`: the bundled pi, pinned by its own lockfile, with its MIT notice in `vendor/pi/LICENSE` (pi's npm packages have none), shipped as `pi/LICENSE`. `vendor/tools/<os>-<arch>`: pinned
  ripgrep and fd for pi (its grep tool and `@` file completion), so pi never downloads them.
  `tools/vendor-pi.mjs` installs both (checking each download's SHA-256) after `npm install` and
  before builds; they ship as `Resources/pi` and `Resources/pi/bin`, with their licences.
- `lib/brand.js`: reads a deck's brand block and finds the default brand.
- `tools/validate-release.mjs` / `tools/verify-release-bundle.mjs`: release gates: version,
  tag and `release-draft.md` agree; a packaged app has pi, rg, fd, the skill and node-pty.
- `.github/workflows/release.yml`: builds macOS, Linux and Windows and publishes tagged releases.
- Navigation checks the next or previous `input.slide-radio`, which is the switching
  mechanism the skill uses. Other HTML files still open; arrow keys are then left to the page.
- Decks run sandboxed with no Node access. Web links open in your default browser.
