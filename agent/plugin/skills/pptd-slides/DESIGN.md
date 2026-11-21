# What makes a good presentation

The styles in `styles/` (grid, bold, folio, signal, atelier, classic) look nothing alike, yet they
agree on almost everything below. These principles are what make them work; the styles are
worked examples. Follow them on every slide, and design from them when no layout fits or the
user asks for a look none of the styles has.

## 1. Each slide makes one point

- **The headline is the conclusion,** a sentence the audience could repeat: "Growth is
  accelerating, not levelling off", not "Revenue". Two lines at most.
- Everything on the slide supports that sentence. What doesn't goes in the footer, the
  appendix or the bin.
- The **eyebrow** gives the context (topic, period, source, "Customer research · 38
  interviews") so the headline is free to make the claim.
- The **footer** carries the source, sample size and caveats, so the body doesn't.
- Test: read only the headlines in order. They should tell the whole argument.

## 2. One thing to look at first

- Each slide has exactly one focal element: the hero number, the current step, the winning
  column, the current bar, the key phrase. Mark it (`.hl`, `.win`, `.key`); leave the rest
  quiet.
- **Colour roles** (every style uses them the same way):
  - ink for content; ink-2 and muted for what supports it;
  - the **accent** is "the answer": the focal element and the structure that leads to it.
    Use it for one thing per slide;
  - the **highlight** is the editor's pen: one underline, one "now" marker, one annotation
    on a chart. Never a large fill, never long text, at most once per slide;
  - **status colours** only for status (green ready, ink proven, amber in progress).
    Status tags are not decoration: don't use them as category labels.
  - Never put the accent and the highlight on the same element.
- **Size beats colour.** A hero number two to four times the size of its neighbours (folio's
  140px figure beside a column of 36px ones) needs no other emphasis.
- **Few colours.** Paper, ink, the accent and the highlight, plus tints of the accent: four
  colours on a slide is plenty (atelier's rule, true of all of them).

## 3. Few sizes, clear steps

- One type scale per deck, five to seven sizes: display, slide title, lead, heading, body,
  label, footer. Neighbouring levels differ clearly (at least ×1.25); never two sizes that
  are almost the same.
- Two or three weights. Headlines are either quiet (grid 500, folio 400) or loud (bold 800):
  that is the style's voice. Don't mix the two.
- At most two families: a display voice (folio's serif, signal's mono, bold's heavy sans)
  and a reading voice (sans) for sentences. Labels get a contrasting treatment: mono, or
  small tracked capitals.
- A big number's unit is smaller and quieter: "41 days", "9 ms", "$18.4M".
- Body lines under about 60 characters. Balance headlines so the last line isn't one word.

## 4. A frame that repeats

What makes a deck feel designed, more than any one slide, is chrome that sits in exactly
the same place on every slide:

- the context marker: grid's mono eyebrow, bold's pill, folio's rail with the section at
  the top and an italic page numeral at the bottom, signal's header bar;
- the footer, with the source and the slide number;
- fixed margins, and content that starts at the same height on every content slide.

Title, section and closing slides break the frame on purpose (a full-bleed colour, a huge
numeral), which gives the deck its rhythm. A flooded slide (atelier's yellow quote slide,
bold's accent section slide) is a pause; one per section is enough.

## 5. One structural device

Pick one way to separate things and use it everywhere in the deck:

- **rules and whitespace** (grid, folio): a 2px rule opens a block, 1px hairlines divide it;
- **tinted surfaces** with rounded corners (bold);
- **panels sharing 1px dividers**, butted together (signal);
- **flat shapes and colour panels** from a small kit, bleeding off the edge (atelier);
- white cards with a border (classic).

Don't mix boxes, rules and tints on one slide, don't put boxes inside boxes, and no
drop shadows.

## 6. Use the space on purpose

- **Density is part of the register:** editorial 50–60% of the content area (folio),
  reviews 55–65% (grid), pitches 65–75% (bold), dashboards 70–80% (signal). The style's
  `STYLE.md` gives its number.
- Whitespace should look placed, not left over: one block anchored to the grid (centred in
  the free height, or set on a baseline), with the empty space in one piece. A small block at
  the top over an empty half-slide looks unfinished.
- **A slide that looks empty:** make the focal element bigger (a hero number, a
  `.statement`), choose a layout that fills (cards that stretch, a dashboard of stats), or
  merge it with its neighbour. Never pad it with decoration or extra words.
- **A slide that looks crowded:** split it, or move detail to the footer or an appendix.
  Never shrink the type.

## 7. Number things one way

- One numbering system per deck, used for sections, cards, steps and asks alike: `01 02`
  (grid), `i. ii. iii.` (folio), `[01]` (signal), "Step 1" and round badges (bold), plain
  numerals inside shapes (atelier).
- In decks over about 8 slides, add a section divider every three to six slides. It tells
  the audience where they are ("Part 2 of 4").

## 8. Data

- Show the comparison that proves the headline. Emphasise one series (this quarter, our
  column, the winning option) and mute the rest.
- Label directly: the value on the bar, the name at the end of the line. No legend if it
  can be avoided; minimal axes; no gridlines heavier than a hairline.
- Annotate the event that explains the change ("waitlist auto-fill launched", folio) with
  the highlight.
- Make estimates and forecasts look different: dashed or hatched.
- Put the takeaway beside the chart (`.split` + `.takeaway`): what it means, and one fact
  that backs it.
- Tables: six rows or fewer, five columns or fewer; the first column names the rows; the
  recommended column tinted; hairlines only; no zebra stripes.
- Dashboards (signal): a few numbers, each with a label and a delta. A good delta is in the
  accent; the highlight is only for what needs watching.
- **Data can be a shape** (atelier): a number inside a circle, arches for steps, a schedule
  as time blocks whose width is the duration. A shape earns its place only if it carries a
  value or a structure; never put shapes behind text as decoration.

## 9. Words

- At most about 40 words of body text per slide. A card is a heading and one sentence;
  sibling cards say parallel things in parallel form.
- Concrete beats adjectives: "re-plans in 30 seconds", not "fast"; names and numbers, not
  "significant".
- Quotes: a real person, their role and context, trimmed to the line that matters, with one
  phrase marked.
- The **title slide** states the deck's message as its title; the occasion goes in the
  eyebrow, the presenters and date in the footer.
- The **closing slide** says what you need from the audience: the decisions, as numbered
  asks, or the next step. Not "Thank you" or "Questions?".

## 10. Alignment

- Left-align text. Centring blocks of text is the quickest way to make a slide look like a
  template.
- Edges line up on the grid: sibling cards are equally high with aligned tops, gaps are
  equal, and the same element sits in the same place on every slide.

## Using the styles for inspiration

Each `styles/<name>/STYLE.md` lists that style's devices. Borrow a device when a slide
needs it (folio's hero number beside a column of smaller ones, for a results slide in a grid
deck, say), but rebuild it in the deck's own voice: its fonts, rules or tints, corners and
colour roles. Never mix two styles' voices in one deck (serif headlines in a signal deck,
rounded tinted cards in a grid deck).

| Style | Devices worth knowing |
|---|---|
| grid | mono eyebrow on every slide; a 12-column grid; the accent on exactly one number; rules instead of boxes |
| bold | one solid accent card among tinted ones; a marker stroke under the key words; section slides in full accent; cards that stretch to fill |
| folio | a margin rail (section label, italic page numeral); serif for what is said, sans for what is explained; italic roman numerals; one underline as the editor's pen; numbered rows for a process |
| signal | a header bar; panels sharing dividers; code-like tags (`[01]`, `//`, `>`); horizontal bars; a vertical release log; dark-first |
| atelier | a four-shape kit (circle, square, arch, quarter); numbers inside shapes; arches for steps; time blocks; a takeaway panel bleeding off the edge; a flooded quote slide |
| classic | white cards on paper; a gradient bar on top; centred flow nodes |

When the user asks for a look none of them has ("like a newspaper", "playful", "like our
annual report"), start from the closest style and change its style block by these
principles: one voice, one structural device, one numbering system, clear colour roles.
Say what you changed.

## Before you hand over

Look at every screenshot and ask:

1. Reading only the headlines, is there an argument?
2. Where does the eye land first on each slide? Is it the right thing, and is it the only one?
3. Is the chrome (eyebrow, footer, margins) in the same place on every slide?
4. Is the space used on purpose, at the style's density?
5. Is anything a one-off: a size, a colour, a box, a number format?
6. Is the numbering the same everywhere?
7. Does the closing slide ask for something?
