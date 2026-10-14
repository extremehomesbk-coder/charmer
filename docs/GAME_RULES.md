# Game rules

As built in v0.4. The code is `src/model/game.ts`; numbers are in `src/config.ts`.

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
- Let go: snakes sink (green, gold, moon and king 0.15 per second, ruby 0.35, sleepy 0.6).
- One more tune (once per run): when the rug overflows, spend 50 flowers within 5 s to blow away the pot the
  lid landed on and the next most threatened pot, put every lid back on the vine, and play on at the same level
  and score.

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
  knocked down 0.1 (iron 0.15). A bounced lid comes back meaner: each bounce cuts its rest on the vine and its
  wobble warning to 80% (wobble floor 0.16 s), so guarding one pot forever is not a plan; charming the snake
  is the only reset.
- Landed: a lid that reaches the rim seals that pot for 1.5 s (its snake cannot climb) and a new pot hops into
  the nearest free spot (its lid waits an extra 1.5 s). Then the lid pops back up to the vine.
- Charmed: a snake that reaches 1 climbs into the vine. Its pot and lid are gone, a flower blooms, and the vine
  shakes: the hanging lids of the pots right beside it start to wobble and drop 0.7 s later.

## Win, lose, level clear

- Level clear: no pots left. Bonus 200 x level, +300 if no lid landed this level. After 1.8 s the next level's
  pots drop in.
- Game over: a lid lands and there is no free spot for the extra pot. Tap to play again (after a 0.7 s guard).

## Scoring

Charm: green 100, gold 250, sleepy 150, ruby 300, moon 350, king 500. Save: 40. Both multiplied by the combo: each charm or save within 3 s
of the last adds 1 (cap x5); a landed lid resets it.

## Levels

Level N starts with 3 + floor((N-1)/2) pots, capped at 4 (so one mistake is always survivable). Breeds by
level (a new pot rolls the rarest first): gold (20%) from level 2, moon (15%, only at night) from level 2,
ruby (10%) from level 3, sleepy (20%) from level 4, king (8%) from level 6. Iron lids (25%) from level 3.

| Breed  | Rise / sink (climbs per s) | Points | Flowers | Tamed after |
| ------ | -------------------------- | ------ | ------- | ----------- |
| green  | 0.42 / 0.15                | 100    | 1       | 10 charms   |
| gold   | 0.3 / 0.15                 | 250    | 2       | 5           |
| sleepy | 0.45 / 0.6                 | 150    | 1       | 5           |
| ruby   | 0.6 / 0.35                 | 300    | 2       | 3           |
| moon   | 0.38 / 0.15                | 350    | 3       | 3           |
| king   | 0.24 / 0.15                | 500    | 3       | 2           |

Night is 19:00-06:00 on the phone's clock (`?night=1` / `?night=0` force it).

## Flowers, the pouch and the bazaar

- Every charm leaves flowers (table above), +1 at combo x3 or more; a level with no landed lid leaves 3 more.
  They are banked in the wallet when the run ends (or when the player leaves the game screen). The demo earns
  none.
- Daily pouch: once a day on the title screen, 10 flowers, +5 per day in a row (cap 40). Day 7 of a streak adds
  50 and tames a ruby racer outright. A missed day restarts the streak at 1.
- Taming: charms per breed are counted across runs; at the threshold the breed is tamed and sways on the title
  screen (up to five). Progress shows on the game-over card and in the bazaar's SNAKES tab.
- Bazaar: pungi skins ivory 40, peacock 60, ember 80 (each its own scale and timbre); themes monsoon 120, noon 150. Bought items are owned for good and can be swapped any time. Nothing is for money: the web build has no
  way to pay, so the prototype measures intent instead (continue offers shown / taken, bazaar visits; local
  counters only, shown with `?stats=1`).
- Share: the game-over card can hand a 720x1280 picture of the run (score, level, tamed snakes) to the phone's
  share sheet, or save it where there is no sheet. It leaves the phone only if the player sends it.

## Controls (touch, desktop fallback)

Touch: press and hold a lane; slide to switch; a second thumb works. Desktop: mouse the same way, or hold keys
1-5. URL flags: `?auto=1` demo bot plays (also "watch a demo" on the title), `?seed=N` replays a deal,
`?level=N` starts at level N, `?night=1|0` forces night, `?stats=1` shows the local intent counters.

## Assumptions (flag each one; the owner confirms or changes)

Decided by default 2026-10-14 for v0.3 and v0.4; each stands unless the owner says otherwise.

1. Working title Snake Song in the game (the repo and the pipeline card stay "Charmer").
2. The original's loop is the target (pots, flute, vine, falling lids, a landed lid makes another pot). Where
   the details of the original were unclear (lives, flute types), the rules above fill them in.
3. One flute: one snake charmed at a time.
4. A landed lid costs a spot on the rug, not a life; the game ends when the rug is full and another lands.
5. 5 spots, at most 4 pots at a level's start.
6. Charming a snake shakes the neighbours' lids loose (our twist, to make the order of charms matter).
7. (v0.4) Flowers are the only currency and nothing costs money yet; real purchases wait for the store wrapper or
   Stripe, and will be direct buys only (no real-money loot boxes).
8. (v0.4) A continue costs 50 flowers, once per run, and clears two pots.
9. (v0.4) Moon snakes follow the phone's clock (19:00-06:00); the collection says "not now" by day.
10. (v0.4) A bounced lid gets meaner (80% rest and warning per bounce) so that guarding cannot replace charming.
11. (v0.4) Day 7 of a daily streak tames a ruby racer outright (the one shortcut past play).
