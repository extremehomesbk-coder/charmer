# Design

Original game inspired by the snake-charming puzzle in a 1997 puzzle collection (pipeline card "Charmer remake").
No third-party names, art or sound: the in-game title is **Snake Song** (working title), all art is drawn in code,
all sound is synthesized.

## One-line pitch

Hold a basket to play the flute: its snake rises and lifts a stack of glossy pots; line up three of a colour to
pop them, chain cascades, blast rows with gold pots and hit Fever before the lids fill every basket.

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

v0.2: gold pots (clear their whole row when matched), rainbow wild pots (match any colour), Fever (a meter
filled by clears and cascades; full = 6 s with no lids and double points), 4- and 5-in-a-row bonuses. Still on
the list: a "long note" that holds a snake's height for 5 s, a clay lid that only breaks in a cascade.

## Feel: animations that must read without sound

Snake neck sways while charmed, its hood flares and it turns gold; music notes float up from the charmed
basket and a warm beam lights its lane; pots fall under gravity and squash with a dust puff on landing; a ghost
of the next lid pulses over its column; clears flash white, burst into shards, sparks and a ring in the pot's
colour with "+30"; cascades and big runs throw a tilted combo word (NICE! x2, GREAT!, GOLDEN!) and shake the
screen; gold pots sweep a beam across their row; Fever tints the screen and turns the snakes rainbow; a basket
one pot from full trembles and its lane pulses red.

## Theme and art direction

Night market: indigo sky with stars and a crescent moon, domed skyline with glowing lanterns, a red rug,
woven baskets, a leafy flowering vine, glossy glazed pots with a zigzag band and a cream badge holding a glyph
(circle, triangle, square, diamond, cross, star) so colour is never the only cue. All painted in code with
canvas gradients (src/art.ts) and rendered at 2x for a sharp phone screen.

## Open questions

- Is the top third of the board too empty early on? (rows 10; the sparse-board rush in v0.2 helps)
- Does a one-snake-at-a-time flute feel right, or should two fingers charm two snakes?
- App Store wrapper: the card says this game also tests the web-to-store pipeline (no Mac; needs a cloud build).
