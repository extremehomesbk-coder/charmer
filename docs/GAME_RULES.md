# Game rules

As built in v0.1. The code is `src/model/game.ts`; numbers are in `src/config.ts`.

## Board / playfield

5 columns, each a basket with a snake in it and a stack of pots on the snake's head. 10 rows between the basket
rim and the vine. A snake's **lift** (0-4) is how many rows it has raised its stack; pot i of a column sits at
row lift + i.

## Objective

Clear pots by lining up 3 or more of the same colour side by side in one row. Clear the stage target to move
up a stage. Score as much as possible before a basket overflows.

## Player actions

- Hold a basket (anywhere in its column): the flute plays and that snake rises one row every 150 ms, up to lift
  4 and never pushing a pot past the vine.
- Slide the finger to another column to charm that one instead. Only one snake is charmed at a time.
- Let go: every uncharmed snake sinks one row every 1.1 s back to the rim.

## What happens on a timer

- A lid (a new pot of a random colour) falls every 2.2 s at stage 1, x0.88 per stage, never faster than 0.9 s.
- Lids favour emptier columns (weight = free slots³), so gaps refill and rows stay matchable.
- If a lid lands on a raised stack that already touches the vine, the snake is pressed down one row to make room.

## Win, lose, stage clear

- Clear: every run of 3+ same-colour pots in a row clears at once; stacks close up onto their snakes; after a
  0.26 s beat the board checks again and any new runs clear as a cascade (chain x2, x3 ... capped at x5).
- Stage clear: 24 pots at stage 1, +6 per stage; bonus 500; one more colour every 2 stages (3 up to 6).
- Game over: a lid falls into a basket holding 10 pots. Tap to play again (after a 0.6 s guard).

## Power-ups

None yet (see DESIGN.md candidates).

## Controls (touch, desktop fallback)

Touch: press and hold a column; slide to switch. Desktop: mouse the same way, or hold keys 1-5.
URL flags: `?auto=1` demo bot plays (for clips and self-playtest), `?seed=N` replays a deal.

## Assumptions (flag each one; the owner confirms or changes)

Decided by default 2026-10-09; each stands unless the owner says otherwise.

1. Working title Snake Song in the game (the repo and the pipeline card stay "Charmer").
2. Pots clear by horizontal lines of 3; no vertical matches (a vertical line would clear itself without input).
3. One snake charmed at a time; the latest finger wins.
4. Charming only raises; lowering is letting go (snakes sink slowly).
5. Lose = a lid lands in a full basket; raised stacks are pressed down rather than punished.
6. 5 columns x 10 rows, start 4 pots per column, 3 colours at stage 1.
