# PPTD — notes for Claude

Electron app (macOS, Apple Silicon) that plays and edits single-file HTML decks
(`*.pptd.html`). Product page: `README.md`. Developer docs: `docs/development.md`. Deck
format: `docs/pptd-spec.md`.

## Keep the docs current

When a change alters behaviour, update the docs in the same change:

- `README.md`: the product page. Features in plain words for people who use the app, and
  the keyboard table. No build steps, file names, env vars, secrets or internals.
- `docs/development.md`: everything for working on the app: running and building, releases
  and their secrets, the agent's wiring, and "How it works" (one line per file).
- `docs/pptd-spec.md`: anything the app requires of or does to a deck (detection, the radio
  protocol, classes it hides, CSS it injects, media markup). Bump nothing for additions that
  old decks still satisfy.
- This file: new conventions, gotchas, or changes to the build and install steps.

## Architecture

- **Multi-window.** All per-window state (window, deck view, file, mode, watchers, undo
  stack, thumbnails, agent session) lives in the object `w` from `newWindowState()` in
  `main.js`. No per-window state at module level. Functions take `w` first.
- **IPC** goes through `handle(channel, fn)`, which looks up the sender's window in
  `byContents`. Both the window's UI webContents and its deck view are registered there, so
  messages from `deck-preload.js` resolve too.
- **The menu** is app-wide and built from `current()` (the focused window). Its click
  handlers re-resolve `current()` when clicked. Call `buildMenu()` whenever the enabled state
  of an item may change.
- **The deck protocol** is radio inputs: the app ticks the n-th `input.slide-radio` and
  never runs deck scripts (decks have none). Its own CSS injections are `HIDE_CONTROLS_CSS` and
  `frameCss()` in `main.js`. Keep them in step with section 6 of the spec.
- **The agent** runs in a pty, one per window: pi (bundled, the default) or Claude Code,
  chosen in View › Agent and stored as `agent` in `userData/settings.json`. Each session has
  its own state and events files in `userData/agent/`. Those are removed when its window
  closes or the app quits. Both agents get the same skill, system prompt, per-prompt note
  and written-file events. Claude gets them through `--settings` hooks, pi through
  `agent/pi/pptd-extension.js` (env `PPTD_STATE_FILE`/`PPTD_EVENTS_FILE`). Change both together.
- **pi is vendored** in `vendor/pi` (own `package.json` + lockfile; `node_modules` is not in
  git). It runs on the app's Electron binary with `ELECTRON_RUN_AS_NODE=1`, so it needs
  Node >= the version pi's `engines` asks for; check `process.versions.node` when bumping
  either. To update pi: change the version in `vendor/pi/package.json`, run
  `npm install --prefix vendor/pi --ignore-scripts`, and commit the new lockfile.
- **pi's config folder** is `appData/PPTD/pi` (`piAgentDir()` in `lib/agent.js`, passed as
  `PI_CODING_AGENT_DIR` to pi and the login helper), not `~/.pi/agent`. `preparePiAgentDir()`
  adds `quietStartup: "header"` to its `settings.json` unless set, which hides pi's list of
  loaded skills and extensions; the extension replaces the header itself (`ctx.ui.setHeader`).
  The footer line reads `<state file>.json`, written next to the state file by `writeState`.
- **User edits reach the agent as notes.** The app's own changes to a deck (slide moves,
  media drops, their undos) call `w.agent?.noteChange(text)`, which appends a
  `<pptd-user-edit>` note to `<state file>.changes`. pi's extension sends it at once (steered
  into a running turn, or held for the next prompt); Claude's UserPromptSubmit hook prints it
  with the next message. Both move the file aside before reading, so nothing is lost or
  repeated. Any new app-side edit to a deck should send a note too.
- **Prompt history** (`lib/history.js`, spec "Prompt history", off unless `savePrompts` is
  true in settings). The events file carries JSON lines besides `"file_path"` ones:
  `{"type":"prompt"}` (pi: `before_agent_start`; Claude: the UserPromptSubmit hook, as
  `{"type":"prompt","hook":<its stdin>}`), `{"type":"steer"}` (pi `input` while running) and
  `{"type":"end"}` (pi `agent_settled`, not `agent_end`, which comes before retries; Claude:
  the Stop hook, which doesn't run on interrupt, so a new prompt closes an open run).
  `w.turn` holds the run; at its end `recordRun` rewrites the block from the history read
  *before* the run, so an agent that drops it can't lose it. Hashes exclude the block.
  Snapshots are content-addressed in `userData/history`; a row can revert only if its
  snapshot is there. A revert never truncates the list.
- **Opening the agent's new decks** has three paths in `main.js`: write events
  (`watchAgentEvents`), the agent-folder watcher (`watchAgentFolder`, top level only), and
  `openDeckFromRun` at the end of a run with no deck on screen (scans two levels down, for
  shell-written decks in subfolders). A deck is `*.pptd.html` or an `.html` with the PPTD
  meta (`isDeckFile`).
- **Structural edits** (`tools/pptd-deck.mjs`: list, add, move, delete) move slide content
  and leave positional parts in place (ids, aria-label numbers, `.controls`, `.progress`,
  switching CSS); see the spec section on reordering. Agents run it from the skill folder;
  the app's drawer uses `moveSlide` + `verify`. Undo entries carry `what` (menu label),
  `undone` (toast) and `note` (for the agent). To test changes to it, run every add, delete
  and move on the template and a real deck and check the checker results, the ‹ ›/counter/
  progress of every position, and that add-then-delete and move-and-back are byte-identical.
- **Sign-in gate:** `startAgent` asks `agent/pi/login.mjs` (`{"cmd":"status"}`) whether pi has
  a usable model; if not, it shows the sign-in panel (`login-*` IPC, `#login` in the agent pane)
  and starts pi when a login finishes. The panel lives in the agent pane on purpose: the deck
  is a native view over `#stage`, so an HTML overlay there would be hidden behind it. The
  helper imports pi's unbundled `dist/` modules (`ModelRuntime`, `SettingsManager`), so check
  those paths when bumping pi. Offered providers: `PROVIDERS` in `lib/pi-login.js`.
- **ripgrep and fd are vendored** for pi by `tools/vendor-pi.mjs` into
  `vendor/tools/<os>-<arch>` (electron-builder's names: mac/linux/win, x64/arm64), pinned
  by version and SHA-256 in that script. Only the host target is fetched unless
  `PPTD_TOOL_TARGETS=all` (or a list) is set, which a cross-build needs. `lib/agent.js` puts
  them first on pi's PATH; without them pi downloads the latest release into `~/.pi/agent/bin`.
- **Cross-platform:** the pi resources are declared per platform (`mac`/`linux`/`win`
  `extraResources` in `package.json`), each keeping only that OS's pi-tui native addon. Keep
  build tooling in Node (`tools/*.mjs`), not `sh`, and use `path.delimiter` and the PATH
  helpers in `lib/agent.js` (Windows spells it `Path`). Releases build all three
  (see Releases); the Linux and Windows apps are less exercised than macOS.
- **The spec, checker and deck tool are duplicated.** The source copies are
  `docs/pptd-spec.md`, `tools/pptd-check.mjs` and `tools/pptd-deck.mjs`. `npm run sync-skill`
  (it also runs before every build) copies them into `agent/plugin/skills/pptd-slides/`. Edit
  the source copies, never the skill copies. The two `.mjs` files also ship in the app (main
  imports `tools/pptd-deck.mjs` for drag-to-reorder), so keep them dependency-free.

- **Screenshots come from the app, never Chrome.** `lib/shot.js` renders slides and runs the
  key test in an offscreen window; the menu uses it directly and agents reach it through
  `lib/app-socket.js` (env `PPTD_SOCKET`, JSON line protocol) with the skill's
  `pptd-app.mjs`. Don't bring back a headless-Chrome script: Chrome launched under PPTD tries
  to modify its own bundle, and macOS blames PPTD ("prevented from modifying apps").

## Gotchas

- **Don't reload the deck view on file changes.** A reload repaints slide 1 before jumping
  back (a visible flash) and takes keyboard focus from the agent terminal. Disk changes go
  through `refreshFromDisk` (in-place DOM morph); anything that must reload or `loadFile`
  without focusing the deck calls `keepUiFocus(w)` first.
- `index.html` CSS: `.main` is the layout grid under the toolbar. Don't reuse generic class
  names like `main` on components (a Play button that did got squashed to zero width).
- **Keyboard focus:** the deck is a separate WebContentsView and usually holds keyboard focus,
  so `term.focus()` alone does nothing. The renderer calls `viewer.focusUi()` (main:
  `w.win.webContents.focus()`) before focusing the terminal or the sign-in panel. Decks the
  agent opens use `openFile(w, f, { focus: false })` so they don't take the keyboard from the
  agent; keys typed while a session starts are queued in the renderer and sent on `pty-start`.
- The skill's `SKILL.md` frontmatter must be strict YAML (quote a description that contains
  `: `). Claude Code tolerates bad YAML; pi drops the skill without saying so.
- The agent terminal is xterm.js, which sends a bare `\r` for Shift+Enter and supports neither
  the Kitty keyboard protocol nor modifyOtherKeys. `renderer.js` remaps Shift+Enter itself
  (`attachCustomKeyEventHandler`): `ESC[13;2u` to pi, `ESC CR` to Claude Code.
- To test pi without a real model, point `PI_CODING_AGENT_DIR` at a scratch folder with a
  `models.json` for a local fake OpenAI-compatible server, and run pi with `-p … </dev/null`
  (pi waits for piped stdin otherwise).
- A standalone Electron test script that destroys its only window quits the app (Electron's
  default without a `window-all-closed` handler), so the next load fails with `ERR_FAILED (-2)`.
  Add `app.on('window-all-closed', () => {})` to such scripts; main.js already has one.
- Running `npx @electron/asar extract-file` writes into the current directory. Run it from
  the scratchpad, not the repo, or it overwrites repo files.

## Run, test, install

- `npm start` (dev; settings in `PPTD Dev`, so it can run beside the installed app).
- There is no test suite. To smoke-test, write a script that `require`s `main.js`, waits for
  `app.whenReady()`, drives menu items via `Menu.getApplicationMenu()`, runs
  `executeJavaScript` in windows, and prints results. Run it with `npx electron <script>`.
- `npm run check -- deck.pptd.html` validates a deck against the spec.
- Install locally: `npm run build` → `dist/mac-arm64/PPTD.app`. Then quit the installed app
  (`osascript -e 'quit app "PPTD"'`), but first check that it has no running agent session
  (a `claude` or `pi` child of the PPTD process). For the ad-hoc signed local build that
  AppleScript can fail with "Application isn't running" (-600) while it is; then send it
  `kill -TERM <pid>` instead, which Electron handles as a normal quit. Then
  `rm -rf /Applications/PPTD.app && ditto dist/mac-arm64/PPTD.app /Applications/PPTD.app`
  and relaunch. Local builds are ad-hoc signed.

## Releases

`.github/workflows/release.yml` builds macOS arm64 (DMG), Linux x64 (AppImage, deb) and
Windows x64 (NSIS, unsigned) on native runners and, for a `v*` tag, publishes one GitHub
release after all three pass. The macOS job requires the Apple secrets
(`docs/development.md`) and always signs, notarizes and staples its release. The `.html` file association is in `build.mac` on purpose:
on Windows and Linux it would make PPTD the handler for every `.html` file.

When the user says "create a new release" (or similar), run the whole procedure, but don't
tag until they have confirmed the exact version:

1. Check the worktree. If unrelated uncommitted changes make the release risky, stop and ask.
2. Read the version in `package.json` and recommend the next minor (`0.3.0` → `v0.4.0`)
   unless they gave one. Wait for confirmation.
3. Set it with `npm version <x.y.z> --no-git-tag-version` (updates `package.json` and
   `package-lock.json` together).
4. Write `release-draft.md`: first line exactly `# PPTD v<x.y.z>`, then notes derived from
   the diff since the previous tag (`git describe --tags --abbrev=0`; the whole history for
   the first release). Describe what users get from the app; leave out docs-only, CI-only
   and repo-housekeeping changes.
5. Run `npm run release:validate -- v<x.y.z>`, the smoke checks in the workflow's "Checks"
   step, and `npm run build` with `node tools/verify-release-bundle.mjs
   dist/mac-arm64/PPTD.app/Contents/Resources`.
6. Commit the version and notes (`Release v<x.y.z>`), create an annotated tag `v<x.y.z>` on
   that commit with the notes as its message, push the branch to `main` on origin, then push
   the tag.
7. Report the commit and tag, then watch the run (`gh run watch`) and report its result
   rather than assuming it worked.
