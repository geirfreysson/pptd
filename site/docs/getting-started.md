---
title: Getting started
description: Download PPTD, sign in once, and make your first deck.
---

# Getting started

## Download

Get the latest version from the
[Releases page](https://github.com/geirfreysson/pptd/releases/latest), or pick your platform:

| Platform | Download |
|---|---|
| **macOS** (Apple Silicon) | [PPTD-mac-arm64.dmg](https://github.com/geirfreysson/pptd/releases/latest/download/PPTD-mac-arm64.dmg) |
| **Windows** (x64) | [PPTD-windows-x64-setup.exe](https://github.com/geirfreysson/pptd/releases/latest/download/PPTD-windows-x64-setup.exe) |
| **Linux** (x64) | [AppImage](https://github.com/geirfreysson/pptd/releases/latest/download/PPTD-linux-x86_64.AppImage) · [.deb](https://github.com/geirfreysson/pptd/releases/latest/download/PPTD-linux-amd64.deb) |

**macOS:** open the DMG and drag PPTD to Applications. The app is Developer ID signed and
notarized by Apple.

**Windows:** the installer is not signed yet, so Windows may ask you to confirm you trust it.
The release notes explain how.

### New versions

PPTD checks for a new version when it starts and every few hours after. When there is one, a
bar appears under the toolbar:

- **Download** opens the installer for your computer in your browser (the Releases page on
  Linux, where you choose AppImage or .deb). Install it over the old copy as you did the first
  time.
- **What's new** opens the release notes.
- **Later** hides the bar until PPTD next starts.
- **Skip This Version** hides it until a newer version comes out.

PPTD never downloads or installs anything by itself, and the check sends nothing about you or
your decks. **Check for Updates…** in the PPTD menu (the Help menu on Windows and Linux) checks
right away; **Check for Updates Automatically** in the same menu turns the check off.

## Sign in once

PPTD comes with its own agent, [Pi](./pi.md), so there's nothing else to install. The first time you open
the agent, sign in with one of:

- your **ChatGPT** account (Plus or Pro),
- your **Claude** account (Pro or Max), or
- an **Anthropic API key**.

If you already use **Claude Code**, you can choose it in **View › Agent** instead.

## Make your first deck

1. Click **Make a new one** on the start screen, or press **⌘J** (Ctrl+J on Windows and Linux).
2. Ask for what you want: *"Make a 6-slide deck about our Q3 results."*
3. The first time, the agent asks how your decks should look. Answer in plain words
   ("Google colours", your company's hex codes, "black and white, minimal") or say you have
   no preference.

An animation shows the deck being built, and PPTD opens it as soon as it's saved. New
presentations go in `Documents/PPTD`.

Next: [Making decks](./making-decks.md).
