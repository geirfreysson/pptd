# PPTD v0.3.0

## New decks from the agent open straight away

- When you ask the agent for a new presentation and no deck is open, PPTD now shows it as
  soon as the agent finishes, even if the agent saved it with a script or in a subfolder.
  Before, on a fresh install, the first deck could be saved without appearing, and you had
  to open it yourself.
- Decks the agent saves as plain `.html` (rather than `.pptd.html`) open too.

## Smoother editing

- When a deck changes on disk (the agent edits it), PPTD updates the slide in place
  instead of reloading: no flash of the first slide, you stay on the slide you were on,
  and the agent terminal keeps the keyboard.
- View › Slideshow Plays chooses what ⌘↩ and the ▶ button do: play full screen or in the
  window. ⇧⌘↩ always plays full screen and ⌘⌥↩ always in the window.
