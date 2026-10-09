# Tuning

Every number below lives in `src/config.ts`. One row per knob: what it does, the default, what moving it changes.

## Pace

| Knob                | Default | Effect                                                                                                   |
| ------------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| `pace.riseMs`       | 150     | ms per row a charmed snake rises. Lower = snappier, harder to stop on the right row.                     |
| `pace.sinkMs`       | 1100    | ms per row an uncharmed snake sinks. Higher = easier two-lift combos.                                    |
| `pace.dropMs`       | 2200    | ms between lids at stage 1. The main difficulty dial.                                                    |
| `pace.dropFactor`   | 0.88    | Lid interval multiplier per stage.                                                                       |
| `pace.dropMinMs`    | 900     | Fastest lid interval.                                                                                    |
| `pace.dropBias`     | 3       | Lids favour emptier columns (weight = free slots ^ bias). 0 = uniform, which leaves dead gaps (see log). |
| `pace.chainPauseMs` | 260     | Beat between a clear and the cascade check.                                                              |

## Difficulty curve (levels and stages)

| Knob                                     | Default | Effect                                                                |
| ---------------------------------------- | ------- | --------------------------------------------------------------------- |
| `board.cols` / `board.rows`              | 5 / 10  | Board size.                                                           |
| `board.maxLift`                          | 4       | Highest lift.                                                         |
| `board.startPots`                        | 4       | Pots per column at the start.                                         |
| `board.matchLength`                      | 3       | Run length that clears.                                               |
| `levels.startColors`                     | 3       | Colours at stage 1. 4 makes stage 1 much harder (bot 246 s vs 313 s). |
| `levels.colorEveryStages`                | 2       | One more colour every N stages, up to `maxColors` 6.                  |
| `levels.stageTarget` / `stageTargetStep` | 24 / 6  | Pots to clear for stage 1, extra per stage.                           |

## Scoring

`scoring.perPot` 10 x chain multiplier (cap `chainCap` 5); `stageBonus` 500.

## Power-up rates

None yet.

## Feel (animation durations)

`feel.liftLerp` 0.35, `dropFallMs` 220 (a full-height fall), `popMs` 260, `floatTextMs` 700, `restartGuardMs` 600,
`noteBaseHz` 330 (column 0's flute note; columns climb a pentatonic scale).

## Gate target (what a playtest must show before this build moves forward)

Pipeline gate (Prototype): a playable link that runs on the phone. Self-check before calling it: an idle player
loses inside 90 s with almost no clears (the game never plays itself), and the demo bot clears stage 1 and
survives at least 3x as long as idle.

## Playtest log (date, build, what changed, verdict)

`npm run sim`: 12 seeded games idle and 12 with the demo bot (`src/model/bot.ts`: best single lift, else a
two-lift setup).

| Date       | Build      | Change                                                                  | Idle (secs / pots) | Bot (secs / stage / pots) | Verdict                                                                           |
| ---------- | ---------- | ----------------------------------------------------------------------- | ------------------ | ------------------------- | --------------------------------------------------------------------------------- |
| 2026-10-09 | v0.1 draft | uniform lids, lift counted toward overflow                              | 95 s               | 75 s                      | Broken: charming made you lose faster. Overflow now counts pots only.             |
| 2026-10-09 | v0.1 draft | overflow fix, uniform lids                                              | 68 s / 1           | 105 s / 1 / 25            | Bot finds a move 2% of the time: an empty middle column blocks every row.         |
| 2026-10-09 | v0.1       | lids weighted to empty columns (bias 3), 4 start pots, 3 colours, 2.2 s | 80 s / 5           | 313 s / 5 / 153           | Passes the self-check. Headless browser run: no errors, bot at stage 3 by ~2 min. |
