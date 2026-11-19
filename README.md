# PPTD — PowerPoint is dead

**Presentations you make by asking.** Tell PPTD what you want to say and an AI agent builds the
slides while you watch. Then keep going: "make the headline shorter", "turn this into a
chart", "add a slide about pricing". Every change appears straight away.

Each presentation is a single HTML file. It opens in any browser, previews in Microsoft Teams
and needs nothing installed to view, so you can send it the way you'd send a PDF.

**Website and docs:** <https://geirfreysson.github.io/pptd/>

## Download

Get the latest version from the
[Releases page](https://github.com/geirfreysson/pptd/releases/latest):

| | |
|---|---|
| **macOS** (Apple Silicon) | [PPTD-mac-arm64.dmg](https://github.com/geirfreysson/pptd/releases/latest/download/PPTD-mac-arm64.dmg) |
| **Windows** (x64) | [PPTD-windows-x64-setup.exe](https://github.com/geirfreysson/pptd/releases/latest/download/PPTD-windows-x64-setup.exe) |
| **Linux** (x64) | [AppImage](https://github.com/geirfreysson/pptd/releases/latest/download/PPTD-linux-x86_64.AppImage) · [.deb](https://github.com/geirfreysson/pptd/releases/latest/download/PPTD-linux-amd64.deb) |

The macOS app is Developer ID signed and notarized by Apple. The Windows installer is not
signed yet, so Windows may ask you to confirm you trust it; the release notes explain how.

## Make a presentation

Click **Make a new one** on the start screen (or press **⌘J**) and ask: *"Make a 6-slide deck about our Q3 results."* The agent writes the
deck, and PPTD opens it as soon as it's saved; until then an animation shows it's being
built. New presentations go in `Documents/PPTD`.

Then just talk about what you see. Every message carries the slide on screen, so "make this
shorter" means *this* slide unless you name another. Changes appear in place as the agent
saves them: you stay on the slide you're looking at, and you can keep typing while it works.

**Sign in once.** PPTD comes with its own agent, [Pi](https://github.com/earendil-works/pi)
(MIT licence, by Mario Zechner), so there's nothing else to install. The first
time, sign in with your **ChatGPT** (Plus/Pro) or **Claude** (Pro/Max) account, or paste an
**Anthropic API key**. If you already use **Claude Code**, choose it in View › Agent instead.

## Edit by hand, too

- **Slides drawer** (⌥⌘S): a picture of every slide. Click one to show it, and **drag** it to
  reorder.
- **Drop images or video** onto a slide, or onto a slide in the drawer. Photos are resized
  and iPhone photos converted for you.
- **Copy a slide as an image** (⇧⌘C) to paste into an email or chat, or export every slide as
  a PNG (File › Export Slides as Images…).
- **Undo** (⌘Z) takes back the last move, drop or revert.
- Edit the file in any other editor and PPTD picks up the change.

The agent hears about your changes, so it never works from an out-of-date picture of the deck.

## Your brand, on every deck

The first time you make a presentation, the agent asks how your decks should look: "Google
colours", your company's hex codes, "black and white, minimal", or no preference. That becomes
your default brand.

Every deck keeps its own copy of its brand, so it looks the same wherever it's opened, and
changing your default later doesn't restyle old decks. Want something different for one
deck? Just ask: *"use red and grey for this one."* To change the default: *"make this my
default brand."*

## Go back to any prompt

Turn on **View › Save Prompts in Decks** and every prompt that changes a deck is kept with it.
Open the drawer's **Prompts** tab to see how a deck was built, prompt by prompt, and press
**↺** on any of them to put the deck back as it was at that point. Nothing is lost when you
go back: later prompts stay in the list, so you can jump forward again.

The prompts are saved inside the file, so anyone you send it to can read them. That's why
this is off until you turn it on. File › Remove Prompt History clears them from a deck.

## Present

Press **⌘↩** to start the slideshow. It plays full screen unless you choose
**View › Slideshow Plays › In Window**. **⇧⌘↩** always plays full screen and **⌘⌥↩** always fills
the window. Arrow keys, Space and Enter move through the slides, and Esc ends the show.

## Light or dark

PPTD follows your Mac's light or dark appearance. To pick one for PPTD alone, choose
**View › Appearance › Light** or **Dark** (**System** goes back to following the Mac). The agent
pane switches with it.

## Keyboard

| | |
|---|---|
| ← → ↑ ↓, PageUp / PageDown | previous / next slide |
| Home / End | first / last slide |
| ⌘↩ | slideshow, in the mode chosen in View › Slideshow Plays |
| ⇧⌘↩ | full-screen slideshow |
| ⌘⌥↩ | slideshow in the window |
| In a slideshow: Enter / Space | next slide (Shift+Enter, Backspace: previous) |
| In a slideshow: Esc | end the slideshow |
| ⌥⌘S | slides drawer |
| ⌘J | agent |
| In the agent: Shift+Enter | new line (Enter sends) |
| ⌘Z | undo the last move, drop or revert |
| ⇧⌘C | copy the current slide as an image |
| ⌘R | reload the deck |
| ⌘N | new window, with its own deck and agent |

On Windows and Linux, use Ctrl in place of ⌘.

## The file format

Decks are saved as `<name>.pptd.html`: one self-contained file with every image and video
inside it and no scripts, so it's safe to open anywhere. The format is open and documented in
[`docs/pptd-spec.md`](docs/pptd-spec.md).

## Building from source

See [`docs/development.md`](docs/development.md).

## Licence

GPL-3.0-or-later (see `LICENSE`). You may use, change and share PPTD; if you distribute a
modified version, you must share its source under the same licence.

PPTD includes [Pi](https://github.com/earendil-works/pi), © 2025 Mario Zechner, under the MIT
licence; its notice ships in the app as `pi/LICENSE`. The bundled ripgrep and fd keep their
own licences in `pi/bin/licenses`.
