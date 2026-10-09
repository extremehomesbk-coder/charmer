# Design

Original game inspired by the snake-charming puzzle in a 1997 puzzle collection (pipeline card "Charmer remake").
No third-party names, art or sound: the in-game title is **Snake Song** (working title), all art is drawn in code,
all sound is synthesized.

## One-line pitch

Hold a basket to play the flute: its snake rises and lifts a stack of pots, and lining up three of a colour
pops them before the lids fill every basket.

## The 9-second clip (what a muted vertical video of this game shows)

Five baskets, five stacks of glossy pots. A thumb holds the middle basket; a yellow snake sways up out of it,
lifting its stack one row, two rows; a red pot slides level with two reds beside it and all three burst; the
pots above drop and a second line bursts ("x2"). Lids keep dropping from the vine.

## Core loop

Lids fall into baskets → read the rows → hold a basket to lift its stack to the row where a colour lines up →
pots clear, stacks close up, cascades chain → the lifted snake sinks back unless you keep playing.

## The decision the player makes every few seconds

Which snake to charm and how high: one lift can line up a colour now, or set up a column so a second lift
finishes a line (a raised snake sinks slowly, about a row per second, so two-lift combos are possible).

## Session shape (how long, what ends it, why play again)

2-5 minutes. It ends when a lid lands on a basket already full to the vine. Stages speed up the lids and add
a colour, so a run is a climb; best score is saved on the phone.

## Progression

Stage N needs 24 + 6(N-1) pots cleared. Each stage: lids about 12% faster, a stage bonus, one more colour every
two stages (3 → 6).

## Power-ups and modifiers

None in v0.1. Candidates once the core is proven: a golden lid that clears its whole row, a "long note" that
holds a snake's height for 5 s, a clay lid that only breaks in a cascade.

## Feel: animations that must read without sound

Snake neck sways while charmed and turns gold; pots ease up and down with the lift; new lids fall from the vine;
clears ring out in the pot's colour with a floating "+30 x2"; a basket one pot from full pulses red.

## Theme and art direction

Night market: dark board, woven baskets, a green vine across the top, glossy rounded pots in strong colours
with a glyph each (circle, triangle, square, diamond, cross, bar) so colour is never the only cue.

## Open questions

- Is the top third of the board too empty early on? (rows 10; stacks sit at 2-5 for the first two stages)
- Does a one-snake-at-a-time flute feel right, or should two fingers charm two snakes?
- App Store wrapper: the card says this game also tests the web-to-store pipeline (no Mac; needs a cloud build).
