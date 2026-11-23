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

**Update check.** Installed copies ask GitHub's API for the latest release
(`lib/updates.js`) and show a banner when it is newer; Download opens the installer by its
versioned name (`PPTD-<version>-mac-arm64.dmg`, `PPTD-<version>-windows-x64-setup.exe`), so
keep those asset names stable, or old copies fall back to the release page. Only
non-prerelease, non-draft releases count. `npm start` doesn't check unless
`PPTD_UPDATE_FEED` points at a JSON file shaped like GitHub's release response (`tag_name`,
`html_url`, `assets[].name`/`browser_download_url`), e.g. a tiny local HTTP server.

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
  real deck made from a skill template, without `autofocus` so it doesn't take focus from
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
- `DESIGN.md`: the design principles every style follows, and how to borrow from the styles.
  When a style teaches something new, add the principle here, not only to its `STYLE.md`.
- `styles/<name>/` (`grid`, `bold`, `folio`, `signal`, `atelier`, `keynote`, `mono`, `sticker`, `playful`, `classic`): one folder per style. `STYLE.md` is its
  design rules, `style.css` its layout CSS (edit this), and `template.html` the starting deck
  in that style, **generated** from `tools/style-deck.html` (the frame and the example slides,
  shared by every style) plus `style.css`. Never edit a `template.html` by hand.
- `brand-template.md`: the shape of the default brand file.
- `pptd-deck.mjs`: adds, removes and reorders slides, so the agent only writes content.
- `pptd-app.mjs`: asks the running app to make a new deck from a style (`new`, which
  shows it), show a deck (`open`), take slide screenshots and run the keyboard test, so no
  browser is launched.
- `pptd-spec.md`, `pptd-check.mjs`, `pptd-deck.mjs`: copied from `docs/` and `tools/` by
  `npm run sync-skill`, which also runs before every build.

`npm run sync-skill` also runs `tools/build-styles.mjs`, which writes each style's
`template.html` and fails if a style hard-codes a colour (hex, `rgb()`, `white`: styles must
take every colour from the brand tokens), uses px for anything but 1px hairlines and 999px
pill radii (SVG `.dg-*` rules excepted), or doesn't draw one of the shared layout classes
(listed in the script and in SKILL.md §1). The template is checked with `pptd-check.mjs`.
The release workflow runs it with `--check`.

**Adding a style:** make `styles/<name>/style.css` (start from a copy of `grid`'s, keep every
class) and `STYLE.md` (look, when to use it, rules, type scale, brand notes, its own
palette), add it to the tables in `SKILL.md` §1 and `brand-template.md`, and to the list in
`tools/verify-release-bundle.mjs`, then run `npm run sync-skill`. Check it with three
brands, including one with a light accent (screenshots through `pptd-app.mjs shot`). A
design from Claude Design or elsewhere is a reference, not something to paste: translate it
into the shared classes, cqw sizes and brand tokens. A style may draw a shared class quite
differently (folio's hero stat, signal's horizontal bars) as long as the markup is the same.
Its display and label fonts are style tokens (`--font-serif`, `--font-mono`); colours always
come from the brand.

**User styles** live in `<appData>/PPTD/styles/<name>/` (`lib/styles.js`; env
`PPTD_USER_STYLES` for the agent; pre-approved for Claude Code as part of the brand folder),
with the same files as a bundled style. A user style may not take a bundled name, so a name
resolves to one style (bundled first). The per-prompt `<pptd-brand>` note lists the user's
styles with their "Use for" line and says where the deck on screen gets its style
(`custom` = made for that deck alone). The agent makes them by `PPTD.md` ("Making a style"):

- `tools/pptd-style.mjs` (synced into the skill with `tools/style-deck.html` as
  `deck-skeleton.html`): `list`, `check` (core layout classes required; the older ones only
  warn, except with `--strict`, which `build-styles.mjs` uses for the bundled styles),
  `build` and `preview --brand`.
- `pptd-app.mjs render <page.html>` (socket command `render`, `renderPage` in
  `lib/shot.js`): renders a downloaded design with its scripts stripped and blocked by CSP,
  in a separate session whose requests are cancelled unless they are `file:`/`data:`, one
  PNG per top-level `<section>`. Never load a design source any other way.

**Previews:** `npm run style-previews` (Electron) writes each bundled style's `preview.jpg`
(nine slides in the palette from its `STYLE.md`) and copies it to `site/static/img/styles/`.
Run it after changing a style or the example slides, and commit the images.

**The base layer** (in the frame of `tools/style-deck.html`) draws the newer layouts once for
every style: photo slots and photo slides, people, agenda, tiers, layers, data tables,
columns and references. It takes each style's voice from optional style variables in the
style's `:root` (`--font-display`, `--font-label`, `--label-case`, `--label-track`,
`--head-weight`, `--radius`, `--photo-radius`, `--hair`, `--rule`); a style may restyle any of
it. New shared layouts should go there, not into every style.

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
  group can't wrap from last to first) and dropped files (with the photo slot they landed on).
- `index.html` / `renderer.js` / `preload.js`: toolbar, slides drawer, terminal (xterm.js).
- `toast.html` / `toast.js` / `toast-preload.js`: notifications, in a transparent view of
  their own laid over the top centre of the window (above the deck view). main's
  `toast(w, text, kind, { undo })` shows one; the page reports its size and main fits the view to it.
- `building.js`: the canvas animation on the empty stage while the agent runs a prompt
  (`agent-busy` IPC from `setBusy` in main, body class `agent-busy`).
- `lib/thumbs.js`: renders slide pictures in a hidden offscreen window (one per app window).
- `lib/shot.js`: full-size slide screenshots and the keyboard-navigation test, in a hidden
  offscreen window (Copy Slide as Image, Export Slides as Images, and the agent's tool).
- `lib/app-socket.js`: a local socket (`PPTD_SOCKET`, owner-only) through which the skill's
  `pptd-app.mjs` asks the running app to open a deck, for screenshots and the key test, and
  (end of a run) whether to remind the agent. Requests carry `PPTD_SESSION`, so main knows
  which window's agent is asking.
- `lib/styles.js`: the user's own styles folder; lists them and resolves a style name.
- `lib/extract.js`: turns a dropped .docx/.xlsx/.pptx/.txt/.md/.csv/.tsv/.json into Markdown
  (with the pictures copied out) in the agent session's drops folder, for `handleDocuments`
  in main to point the agent at. Node built-ins only: a small zip reader over `zlib` and
  regex scanning of the XML, with caps on sizes, rows and pictures.
- `lib/media.js`: embeds images/video into a slide's `<section>`, or fills a photo slot
  (`figure.photo`, spec "Photo slots") with an image.
- `lib/history.js`: the prompt history: reads and writes the deck's
  `<template id="pptd-prompts">`, hashes decks without it, and keeps snapshots in
  `userData/history/<hash>.html.gz`. The agent reports each prompt and the end of each run;
  main records the run in the decks it changed.
- `tools/pptd-deck.mjs`: adds, removes and reorders slides with all the numbering done
  (`list`, `add --after N [--count K]`, `move FROM TO`, `delete N`). Agents use it from the skill; the
  drawer's drag-to-reorder uses it too. Checks the result and refuses rather than break a deck.
  `list` also names each slide's layout (its first layout class from the skill's table) and
  flags a layout the deck leans on (`layoutRepeats`), which the skill asks agents to fix.
- `lib/agent.js`: starts the chosen agent in a pty (node-pty) with the skill and a system
  prompt. Each message gets the deck, slide and brand added; files it writes are reported, and
  the app shows decks it writes (`*.pptd.html`, or `.html` with the PPTD meta), opens with
  `pptd-app.mjs open`/`new`, or checks with `shot`/`keys`, always in that agent's own window
  and never by watching a folder. A run that wrote files but left no deck on screen gets one
  reminder before it ends. It also reports each prompt and the end of each run, for the
  prompt history. Claude Code does this with `UserPromptSubmit`/`PostToolUse`/`Stop` hooks;
  pi with the extension below.
- `agent/pi/pptd-extension.js`: the pi extension that adds the slide note to each prompt,
  reports written files, bash runs, prompts, messages sent mid-run and run ends, asks the app
  before a run settles whether to remind the agent (`agent_before_settle`), draws PPTD's
  startup header and shows the slide on screen in pi's footer.
- `agent/pi/login.mjs` / `lib/pi-login.js`: model sign-in for pi. The helper runs pi's own login
  code and credential store; main relays its prompts to the sign-in panel and opens the browser.
- `vendor/pi`: the bundled pi, pinned by its own lockfile, with its MIT notice in `vendor/pi/LICENSE` (pi's npm packages have none), shipped as `pi/LICENSE`. `vendor/tools/<os>-<arch>`: pinned
  ripgrep and fd for pi (its grep tool and `@` file completion), so pi never downloads them.
  `tools/vendor-pi.mjs` installs both (checking each download's SHA-256) after `npm install` and
  before builds; they ship as `Resources/pi` and `Resources/pi/bin`, with their licences.
- `lib/brand.js`: reads a deck's brand block and finds the default brand.
- `lib/updates.js`: the update check: fetches the latest GitHub release and compares versions.
  Main checks 8 s after launch and every 6 h (setting `checkUpdates`; `skippedVersion` for
  Skip This Version) and sends `update` to every window; the banner (`#update`) is a grid row
  under the toolbar, so the deck view moves down rather than covering it.
- `tools/validate-release.mjs` / `tools/verify-release-bundle.mjs`: release gates: version,
  tag and `release-draft.md` agree; a packaged app has pi, rg, fd, the skill and node-pty.
- `.github/workflows/release.yml`: builds macOS, Linux and Windows and publishes tagged releases.
- Navigation checks the next or previous `input.slide-radio`, which is the switching
  mechanism the skill uses. Other HTML files still open; arrow keys are then left to the page.
- Decks run sandboxed with no Node access. Web links open in your default browser.
