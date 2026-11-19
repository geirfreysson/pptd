---
title: The agent (Pi)
description: PPTD's built-in agent is Pi, an open-source coding agent by Mario Zechner.
---

# The agent: Pi

The agent that writes your decks is **[Pi](https://github.com/earendil-works/pi)**, an
open-source AI coding agent by Mario Zechner. PPTD ships with Pi built in, so there's nothing
else to install, and runs one Pi session per window in the agent pane.

PPTD adds what Pi needs to make presentations:

- a **slides skill** with the deck format, a template and a checker, so Pi writes decks that
  follow the [file format](./file-format.md);
- a **note with every prompt** saying which deck and which slide are on screen, so "make this
  shorter" means the slide you're looking at;
- **notes about your own edits** (slide moves, media drops, undos), so Pi never works from an
  out-of-date picture of the deck.

## Signing in

Pi talks to the model provider you sign in with. The first time you open the agent, sign in
with your **ChatGPT** account (Plus or Pro), your **Claude** account (Pro or Max), or an
**Anthropic API key**. Your sign-in is kept on your computer, in PPTD's own settings folder,
separate from any Pi you've installed yourself.

## Using Claude Code instead

If you already use **Claude Code**, choose it in **View › Agent**. It gets the same skill and
the same notes, so it works the same way in PPTD.

## Pi's licence

Pi is free software under the MIT licence. PPTD includes Pi's licence in the app, next to the
bundled agent (`pi/LICENSE` in the app's resources).

```text
MIT License

Copyright (c) 2025 Mario Zechner

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

PPTD itself is licensed separately, under GPL-3.0-or-later.
