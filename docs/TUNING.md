# Tuning

Every number below lives in `src/config.ts`. One row per knob: what it does, the default, what moving it changes.
Heights and speeds are in "climbs": 1 climb is the distance from a pot's rim to a hanging lid.

## Snakes

| Knob                                | Default                          | Effect                                                                                                               |
| ----------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `snakes.green.rise` / `.sink`       | 0.42 / 0.15                      | Climbs per second charmed / not. 0.42 = 2.4 s from the rim to the vine.                                              |
| `snakes.gold.rise` / `.sink`        | 0.3 / 0.15                       | Gold: 3.3 s to the vine, worth 250.                                                                                  |
| `snakes.sleepy.rise` / `.sink`      | 0.45 / 0.6                       | Sleepy: slips back fast, so it has to be charmed in one go.                                                          |
| `snakes.*.points`                   | 100 / 250 / 150                  | Points for a charm, x combo.                                                                                         |
| `snakes.ruby` / `moon` / `king`     | 0.6/0.35 · 0.38/0.15 · 0.24/0.15 | v0.4 breeds: rise/sink; 300 / 350 / 500 points. Moon and king at sink 0.1 let the demo bot turtle forever (see log). |
| `snakes.guardMin`                   | 0.15                             | How high a head must be to stop a lid. Higher = guarding costs more time.                                            |
| `snakes.riseFactor` / `riseMinMult` | 0.985 / 0.65                     | Snakes climb slower each level, down to 65%.                                                                         |

## Lids (the main difficulty dials)

| Knob                                            | Default           | Effect                                                                                                                                                                                |
| ----------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lids.lidMs` / `lidFactor` / `lidMinMs`         | 2400 / 0.9 / 900  | A lid wobbles this often at level 1 (x0.9 per level, floor), +/- `jitter` 0.3.                                                                                                        |
| `lids.refPots`                                  | 3                 | The interval is scaled by refPots / pots out: more pots, more lids. Without it late levels stall (see log).                                                                           |
| `lids.warnMs` / `warnFactor` / `warnMinMs`      | 1000 / 0.93 / 350 | Wobble before the drop: the reaction window.                                                                                                                                          |
| `lids.gravity` / `gravityFactor` / `gravityMax` | 1.8 / 1.06 / 5    | Fall speed (1.8 = about 1 s from vine to rim).                                                                                                                                        |
| `lids.ironMult`                                 | 1.5               | Iron lids fall and knock this much harder.                                                                                                                                            |
| `lids.knock`                                    | 0.1               | A save knocks the snake's head down this much. Guarding is not free.                                                                                                                  |
| `lids.shakeReach` / `shakeWarnMs`               | 1 / 700           | A charm shakes the lids this many spots either side loose, dropping after 700 ms.                                                                                                     |
| `lids.maxAirEvery` / `maxAirCap`                | 2 / 3             | Lids in the air at once: 1, one more every 2 levels, up to 3.                                                                                                                         |
| `lids.bounceSpeed`                              | 2.2               | How fast a saved lid flies back to the vine.                                                                                                                                          |
| `lids.restMs`                                   | 1400              | A lid hangs at least this long once back on the vine.                                                                                                                                 |
| `lids.meaner` / `meanerMinMs`                   | 0.8 / 160         | Each bounce multiplies that lid's rest and wobble by this (wobble floor). The anti-turtle rule: without it the demo bot guards forever on late levels. 0.7 plays the same in the sim. |
| `lids.sealMs` / `spawnGraceMs`                  | 1500 / 1500       | A landed lid seals its pot this long; the new pot's lid waits this extra.                                                                                                             |

## Levels

| Knob                                         | Default     | Effect                                                          |
| -------------------------------------------- | ----------- | --------------------------------------------------------------- |
| `levels.startPots` / `potsEvery` / `maxPots` | 3 / 2 / 4   | Pots at a level's start. maxPots < 5 keeps one spot free.       |
| `levels.goldFrom` / `goldRate`               | 2 / 0.2     | Gold snakes.                                                    |
| `levels.ironFrom` / `ironRate`               | 3 / 0.25    | Iron lids.                                                      |
| `levels.sleepyFrom` / `sleepyRate`           | 4 / 0.2     | Sleepy snakes.                                                  |
| `levels.rubyFrom` / `rubyRate`               | 3 / 0.1     | Ruby racers.                                                    |
| `levels.moonFrom` / `moonRate`               | 2 / 0.15    | Moon cobras, only when `isNight` (`nightFrom` 19, `nightTo` 6). |
| `levels.kingFrom` / `kingRate`               | 6 / 0.08    | King cobras.                                                    |
| `levels.introMs` / `breakMs`                 | 1200 / 1800 | Calm while pots arrive; pause between levels.                   |
| `board.lanes`                                | 5           | Spots on the rug (the layout is drawn for 5).                   |

## Scoring

`scoring.save` 40, charms per snake (above), both x combo; `comboMs` 3000 window, `comboCap` 5; level bonus
`levelBonus` 200 x level, `perfectBonus` 300 for a level with no landed lid.

## Flowers and the meta game (v0.4)

| Knob                                                        | Default                        | Effect                                                                     |
| ----------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `flowers.<breed>`                                           | 1/2/1/2/3/3                    | Flowers per charm (green, gold, sleepy, ruby, moon, king).                 |
| `flowers.perfect`                                           | 3                              | Extra for a level with no landed lid.                                      |
| `flowers.comboFrom` / `comboBonus`                          | 3 / 1                          | Extra per charm at this combo or higher.                                   |
| `meta.continuePrice` / `continueOfferMs` / `continueClears` | 50 / 5000 / 2                  | One more tune: price, how long the offer stays, pots blown away.           |
| `meta.daily.*`                                              | 10 +5/day, cap 40, 7 days, +50 | The pouch; day 7 also tames a ruby racer.                                  |
| `meta.tame.*`                                               | 10/5/5/3/3/2                   | Charms to tame each breed.                                                 |
| `meta.prices.*`                                             | 40 / 60 / 80 / 120 / 150       | ivory, peacock, ember pungi; monsoon, noon themes. A casual run earns ~75. |
| `skins.pungi.*` / `skins.themes.*`                          | (palettes, scales)             | Looks and sounds of the catalogue; data, not code.                         |

## Feel (animation and sound)

`feel.swayIdle` 3 / `swayCharm` 14 px of body sway at `swayHz` 1.4; `headLerp` 0.3 and `hoodLerp` 0.15 easing;
`floatTextMs` 800, `shakeMs` 160 / `shake` 0.008, `scoreCountMs` 400, `noteEveryMs` 200, `blinkEveryMs` 3200,
`restartGuardMs` 700, `maxFrameMs` 100; the pungi's tonic `noteBaseHz` 294 (each lane a step up), its melody
moving every `noteStepMs` 170 over a double harmonic scale. Layout (`layout.*`) places the vine, lids, rims and
pungi; `layout.headPeek` 15 is how far a resting snake peeks over its rim; `layout.renderScale` 2 renders the
canvas at twice the design size.

## Gate target (what a playtest must show before this build moves forward)

Pipeline gate (Prototype): a playable link that runs on the phone. Self-check before calling it: an idle player
loses inside 30 s (the game never plays itself), a casual bot (notices lids after 650 ms) lasts 2-5 minutes, and
no seeded game stalls at the 15-minute cap, by day or by night. v0.4 adds: a casual run should earn one cheap
skin (40 flowers) or more.

## Playtest log (date, build, what changed, verdict)

`npm run sim`: 12 seeded games each idle, with the casual bot and with the demo bot (`src/model/bot.ts`: climb
the snake nearest the vine, break off to guard when a lid would land first; notices a wobble after
`bot.reactMs` 350 ms). v0.1-v0.2 were a different (match-3) game; their rows stay for the record.

| Date       | Build      | Change                                                                           | Idle      | Bots (secs / level)                              | Verdict                                                                                                                                                                                                                   |
| ---------- | ---------- | -------------------------------------------------------------------------------- | --------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-09 | v0.1 draft | uniform lids, lift counted toward overflow                                       | 95 s      | 75 s                                             | Broken: charming made you lose faster. Overflow now counts pots only.                                                                                                                                                     |
| 2026-10-09 | v0.1 draft | overflow fix, uniform lids                                                       | 68 s / 1  | 105 s / 1 / 25                                   | Bot finds a move 2% of the time: an empty middle column blocks every row.                                                                                                                                                 |
| 2026-10-09 | v0.1       | lids weighted to empty columns (bias 3), 4 start pots, 3 colours, 2.2 s          | 80 s / 5  | 313 s / 5 / 153                                  | Passes the self-check. Headless browser run: no errors, bot at stage 3 by ~2 min.                                                                                                                                         |
| 2026-10-09 | v0.2 draft | gold, wild, fever, lid preview                                                   | 89 s / 10 | 378 s / 6 / 205                                  | Specials make it a little easier; fine. Screenshots: stacked same-colour pots that never pop read as a bug.                                                                                                               |
| 2026-10-09 | v0.2 draft | + vertical matches, lids never complete a line                                   | 72 s / 2  | 652 s / 10 / 447                                 | Cascades everywhere; far too easy for the bot.                                                                                                                                                                            |
| 2026-10-09 | v0.2 draft | + one colour per stage (was every 2)                                             | 72 s / 2  | 441 s / 7 / 258                                  | Back in range. Contact sheets: long dead spells on a sparse board.                                                                                                                                                        |
| 2026-10-09 | v0.2       | + sparse-board rush (0.4 / 0.45)                                                 | 72 s / 2  | 413 s / 7 / 267                                  | Passes the self-check; busier board. Headless frames: pops, sparks, combo words, shake, lid ghost all render.                                                                                                             |
| 2026-10-14 | v0.3 draft | rebuilt as the original's loop: climb to vine, falling lids, landed lid = +1 pot | 12 s      | 900 s / 66 (never loses)                         | Far too easy: guarding costs a 0.3 s tap and never fails.                                                                                                                                                                 |
| 2026-10-14 | v0.3 draft | + steeper ramps, knockback 0.2 on saves                                          | 12 s      | 900 s / 12                                       | Stalemate: the bot guards forever and never charms.                                                                                                                                                                       |
| 2026-10-14 | v0.3 draft | + vine shake on charm, guard 0.15, knock 0.15                                    | 12 s      | casual 263 s / 10, bot 444 s / 10                | In range, but 4 of 24 games stall at 900 s on late levels (712 saves, 1 charm).                                                                                                                                           |
| 2026-10-14 | v0.3       | + lid rate x 3 / pots on the rug, knock 0.1                                      | 16 s      | casual 212 s / 12, bot 247 s / 12                | Passes the self-check, no stalls. Headless frames: drop-in, peeks, wobble, save, seal, hop, bloom, game over render.                                                                                                      |
| 2026-10-14 | v0.4 draft | + ruby / moon / king breeds, flowers, continue                                   | 16 s      | casual 154 s / 8, bot 295 s / 8, night 290 s / 8 | 2 of 12 day and 2 of 12 night demo-bot games stall at 900 s: late levels, 3 pots, 750+ saves and no charms (perfect turtling). Casual bot never stalls.                                                                   |
| 2026-10-14 | v0.4 draft | king and moon sink 0.15 (was 0.08 / 0.1)                                         | 16 s      | bot 273 s, night 332 s                           | Stalls remain: the turtle is a bot property, not a breed one.                                                                                                                                                             |
| 2026-10-14 | v0.4 draft | + meaner lids (0.8 rest and wobble per bounce, floor 160 ms)                     | 16 s      | casual 131 s / 8, bot 129 s / 8, night 190 s / 7 | No day stalls; 1 of 12 at night.                                                                                                                                                                                          |
| 2026-10-14 | v0.4 draft | + knockback growing 50% per bounce                                               | 16 s      | casual 324 s, bot 514 s, night 517 s             | Worse: 6 of 12 stall. A bigger knock just keeps the bot re-guarding the same lane. Reverted.                                                                                                                              |
| 2026-10-14 | v0.4       | meaner 0.8, moon sink 0.15, no knock growth                                      | 16 s      | casual 131 s / 8, bot 129 s / 8, night 133 s / 7 | No stalls in 36 games; ~75 flowers a casual run. Harder than v0.3 (casual 212 s): the breeds and meaner lids. Headless: pouch, bazaar, offer, game-over, share all render; buttons fixed (zones under a modal never hit). |
