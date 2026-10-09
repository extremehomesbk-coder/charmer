/**
 * Every tunable number lives here: layout, colours, speeds, scoring, levels.
 * docs/TUNING.md explains each knob; docs/GAME_RULES.md explains the rules they drive.
 */
export const CONFIG = {
  title: 'Snake Song',
  version: '0.2.0',

  layout: {
    width: 390, // portrait iPhone design resolution; Phaser FIT scales it to any screen
    height: 844,
    safeTop: 24,
    safeBottom: 24,
    sidePad: 20, // margin left and right of the board
    vineY: 150, // y of the vine (top of the playfield)
    cell: 54, // px per pot row and column pitch
    potWidth: 58,
    potHeight: 46,
    basketHeight: 54,
    renderScale: 2, // the canvas renders at this multiple of the design size so art and text stay crisp
  },

  art: {
    segment: 16, // snake body segment diameter
    segmentSpacing: 6, // px between segments along the neck
    headWidth: 40,
    headHeight: 34,
    vineHeight: 44,
  },

  colors: {
    background: 0x12141c,
    panel: 0x1a1d28,
    accent: 0x3cc8ff,
    danger: 0xff4d4d,
    text: '#f1f3f8',
    textDim: '#8d93a8',
    vine: 0x4caf50,
    leaf: 0x7ed957,
    basket: 0xb07a3c,
    basketRim: 0xd9a35f,
    snake: 0x63c95a,
    snakeHeld: 0xffcf4a,
    gold: 0xffc93c,
    fever: 0xd36bff,
    column: 0x1f2333,
    columnHeld: 0x2a3150,
    // one per pot colour; each pot also carries a glyph so colour is never the only cue
    pots: [0xe5534b, 0x3cc8ff, 0xffc93c, 0xb26ef0, 0x5ad17a, 0xff8ad8],
  },

  board: {
    cols: 5,
    rows: 10, // pot slots between the basket rim and the vine
    maxLift: 4, // how many rows a charmed snake can raise its stack
    startPots: 4, // pots per column at the start of a game
    matchLength: 3, // same-colour pots side by side in one row that clear
  },

  pace: {
    riseMs: 150, // while held, the snake rises one row this often
    sinkMs: 1100, // when not held, the snake sinks one row this often
    dropMs: 2200, // a lid falls into a column this often at stage 1
    dropFactor: 0.88, // drop interval multiplier per stage
    dropMinMs: 900,
    dropBias: 3, // lids favour emptier columns: weight = free slots ^ dropBias (0 = uniform)
    sparseFill: 0.4, // below this share of slots filled, lids come faster ...
    sparseFactor: 0.45, // ... down to this share of the interval on an empty board
    warnMs: 900, // the view shows where the next lid lands this long before it falls
    chainPauseMs: 260, // pause between a clear and the cascade check that follows it
  },

  levels: {
    startColors: 3,
    maxColors: 6,
    colorEveryStages: 1, // one more pot colour every N stages
    stageTarget: 24, // pots to clear in stage 1
    stageTargetStep: 6, // extra pots per later stage
  },

  scoring: {
    perPot: 10,
    chainCap: 5, // cascade multiplier cap
    stageBonus: 500,
    fourBonus: 30, // added before multipliers when a run is 4 long
    fiveBonus: 80, // ... or 5 long
  },

  specials: {
    wildRate: 0.05, // share of lids that are rainbow pots (match any colour)
    goldRate: 0.05, // share of lids that are gold pots (clear their whole row when matched)
  },

  fever: {
    perPot: 0.055, // meter gained per pot cleared (meter full at 1)
    chainBoost: 0.5, // each cascade step adds this much extra meter per pot
    decayPerSec: 0.035, // meter drains this much per second outside fever
    durationMs: 6000, // fever length: lids paused, points multiplied
    pointsMult: 2,
  },

  feel: {
    liftLerp: 0.35, // per-frame easing of the drawn lift toward the model lift
    dropFallMs: 220,
    popMs: 260,
    floatTextMs: 700,
    gravity: 0.0045, // px per ms^2 for falling pots
    squashMs: 160, // landing squash
    shakeMs: 140, // camera shake on big clears
    shake: 0.006, // camera shake intensity (chain 2); scales with chain
    scoreCountMs: 400, // the score display counts up to the real score over about this long
    noteEveryMs: 220, // a music note floats up from a charmed basket this often
    tongueEveryMs: 1400, // an idle snake flicks its tongue this often
    restartGuardMs: 600, // after game over, ignore taps this long so a held finger does not restart
    maxFrameMs: 100, // longest frame step; a background tab must not fast-forward the board
    noteBaseHz: 330, // flute note for column 0; each column a step up the scale
  },

  bot: {
    thinkMs: 120, // demo bot (?auto=1) re-plans this often
  },
};

export type GameConfig = typeof CONFIG;
