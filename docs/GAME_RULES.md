# Game rules

As built in v0.3. The code is `src/model/game.ts`; numbers are in `src/config.ts`.

## Board / playfield

5 spots on a rug, each empty or holding a pot with a snake in it. Over each pot a lid hangs from the vine.
Heights are fractions of the climb: 0 is the pot rim, 1 is the bottom of the hanging lid.

## Objective

Charm every snake up to the vine to clear the level. Score as much as possible before the rug runs out of room.

## Player actions

- Hold a pot's lane (anywhere from the vine to the bottom of the screen): the pungi plays and that snake climbs
  (green 0.42 of the climb per second at level 1, gold 0.3, sleepy 0.45; 1.5% slower each level, down to 65%).
- Slide the finger to another lane to charm that one instead. Only one snake is charmed at a time; with two
  fingers down, the one that touched or moved last wins, and lifting it hands the flute back.
- Let go: snakes sink (green and gold 0.15 per second, sleepy 0.6).

## What happens on a timer

- A lid starts to wobble about every 2.4 s at level 1 with 3 pots out (+/- 30%), x0.9 per level, floor 0.9 s.
  The interval is scaled by 3 / pots on the rug: more pots, more lids.
- A wobbling lid drops after 1 s (x0.93 per level, floor 0.35 s) and falls under gravity (about 1 s to the rim
  at level 1, 6% faster per level, capped). Iron lids fall 1.5x faster.
- At most 1 lid wobbles or falls at a time at level 1, one more every 2 levels, up to 3 (shaken lids are extra).
- A lid that got back to the vine hangs at least 1.4 s before it can drop again.
- No lid drops in the first 1.2 s of a level.

## Lids and snakes

- Save: a falling lid that meets a snake whose head is at least 0.15 up bounces back to the vine. The snake is
  knocked down 0.1 (iron 0.15).
- Landed: a lid that reaches the rim seals that pot for 1.5 s (its snake cannot climb) and a new pot hops into
  the nearest free spot (its lid waits an extra 1.5 s). Then the lid pops back up to the vine.
- Charmed: a snake that reaches 1 climbs into the vine. Its pot and lid are gone, a flower blooms, and the vine
  shakes: the hanging lids of the pots right beside it start to wobble and drop 0.7 s later.

## Win, lose, level clear

- Level clear: no pots left. Bonus 200 x level, +300 if no lid landed this level. After 1.8 s the next level's
  pots drop in.
- Game over: a lid lands and there is no free spot for the extra pot. Tap to play again (after a 0.7 s guard).

## Scoring

Charm: green 100, gold 250, sleepy 150. Save: 40. Both multiplied by the combo: each charm or save within 3 s
of the last adds 1 (cap x5); a landed lid resets it.

## Levels

Level N starts with 3 + floor((N-1)/2) pots, capped at 4 (so one mistake is always survivable). Gold snakes
(20% of pots) from level 2, iron lids (25%) from level 3, sleepy snakes (20%) from level 4.

## Controls (touch, desktop fallback)

Touch: press and hold a lane; slide to switch; a second thumb works. Desktop: mouse the same way, or hold keys
1-5. URL flags: `?auto=1` demo bot plays (also "watch a demo" on the title), `?seed=N` replays a deal,
`?level=N` starts at level N (playtesting).

## Assumptions (flag each one; the owner confirms or changes)

Decided by default 2026-10-14 for v0.3; each stands unless the owner says otherwise.

1. Working title Snake Song in the game (the repo and the pipeline card stay "Charmer").
2. The original's loop is the target (pots, flute, vine, falling lids, a landed lid makes another pot). Where
   the details of the original were unclear (lives, flute types), the rules above fill them in.
3. One flute: one snake charmed at a time.
4. A landed lid costs a spot on the rug, not a life; the game ends when the rug is full and another lands.
5. 5 spots, at most 4 pots at a level's start.
6. Charming a snake shakes the neighbours' lids loose (our twist, to make the order of charms matter).
