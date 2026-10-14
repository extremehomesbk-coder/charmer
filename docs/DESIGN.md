# Design

Original game inspired by the snake-charming game in a 1997 puzzle collection (pipeline card "Charmer remake").
No third-party names, art or sound: the in-game title is **Snake Song** (working title), all art is drawn in code,
all sound is synthesized.

v0.1-v0.2 drifted into a match-3 (stacks of coloured pots lifted by snakes) and did not play like the original
at all. v0.3 rebuilt the rules around the original's loop and repainted everything.

## One-line pitch

Hold under a pot to play the pungi: its snake sways up to the vine and the pot is gone. Meanwhile lids drop
off the vine: get a snake's head up in time and it knocks the lid back; let one land and another pot appears.
Clear the rug before it fills.

## What we kept from the original, and what is ours

Kept (the genre loop, which is what the owner remembers): pots holding snakes, a flute that charms one snake at
a time up toward a vine, the snake reaching the vine clears its pot, lids falling from the vine, a raised snake
pushing a lid back up, a landed lid creating another pot, a level ends when every pot is gone.

Ours (so the game stands on its own): the dusk-bazaar look, cute cobras that peek, duck, blink and flare their
hoods, the pungi that slides under the charmed pot, touch and two-thumb play, the vine shake (charming a snake
shakes its neighbours' lids loose), knockback on saves, three snake breeds (green, slow-but-valuable gold,
slips-back sleepy), iron lids, combos, flowers left on the vine, the full-rug rule, the melody, the scoring.

## The 9-second clip (what a muted vertical video of this game shows)

Four painted pots on a red rug at dusk. A thumb holds the middle pot; a green cobra sways up out of it, hood
flaring, notes floating off the pungi. A lid on the left starts to rattle; the thumb slides over, the left snake
pops up and the lid bounces off its head ("+40"). Back to the middle: the snake touches the vine, the pot pops,
a pink flower blooms on the vine, and the vine's shake rattles the next lids loose.

## Core loop

Hold a pot → its snake climbs (and sinks when you let go) → lids wobble and drop → slide to a threatened pot to
raise its snake into the lid's path → back to the climb → the snake touches the vine: pot cleared, vine shakes
the neighbours' lids loose → clear the rug → next level, faster.

## The decision the player makes every second

Keep climbing this snake, or leave it (it sinks) to guard a pot whose lid is about to drop? And: before
finishing a climb, raise the neighbours, because the vine's shake will drop their lids.

## Session shape (how long, what ends it, why play again)

2-5 minutes (sim: a casual bot averages 3.5 min / level 12). It ends when a lid lands and there is no free spot
on the rug for the extra pot. Levels are 10-30 s, so there is a "LEVEL CLEAR" every few breaths; best score is
saved on the phone.

## Progression

Level 1: 3 pots, slow lids. One more starting pot every 2 levels (max 4 of 5 spots, so one mistake is always
survivable). Each level: lids come more often, wobble shorter and fall faster, snakes climb a little slower;
gold snakes from level 2, iron lids from level 3, sleepy snakes from level 4. More pots on the rug also means
more lids, so mistakes snowball, and fewer pots means fewer lids, so a level can always be finished.

## Feel: animations that must read without sound

Pots drop in and bounce at a level's start; resting snakes peek over their rims and blink, look up at a
rattling lid and duck as it falls; a lid wobbles faster and faster with a red "!" before it drops, and its
shadow grows on the pot; a charmed snake's lane glows warm, its hood flares, its body sways in an S and its
tongue flicks; a save squashes the head and throws stars; a landed lid slams with dust and shake, the pot
rattles, and a new pot hops over to a free spot ("+1 POT"); a charmed snake zips up into the vine, the pot
pops into shards and a flower blooms; the vine jolts; a full rug pulses red at the edges.

## Theme and art direction

Dusk over a bazaar: indigo-to-peach sky, a big full moon, two layers of domed skyline and minarets with lit
windows, strings of paper lanterns, palms, a sandstone terrace wall with arches, a red rug with gold and teal
bands. Glossy hand-painted pots (terracotta with a teal zigzag band, brass with a ruby, indigo with moons),
domed clay and iron lids hanging from vine curls, a leafy vine with jasmine. Snakes are front-facing cartoon
cobras: big eyes, blush, a smile, a patterned hood, belly scales down a bending body (a Phaser Rope). All of
it is painted in code with canvas gradients (src/art.ts) at 2x for a sharp phone screen.

## Open questions

- Does a one-flute game feel right on a phone, or should two thumbs charm two snakes at once? (Today the
  latest finger wins; the other finger takes the flute back when lifted.)
- Should iron lids need a higher snake to stop them, rather than just falling faster and knocking harder?
- App Store wrapper: the card says this game also tests the web-to-store pipeline (no Mac; needs a cloud build).
