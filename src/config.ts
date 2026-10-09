/**
 * Every tunable number lives here: layout, colours, speeds, scoring, levels.
 * docs/TUNING.md explains each knob; docs/GAME_RULES.md explains the rules they drive.
 */
export const CONFIG = {
  title: 'Snake Song',
  version: '0.1.0',

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
    snake: 0x6fbf73,
    snakeHeld: 0xffd54f,
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
    chainPauseMs: 260, // pause between a clear and the cascade check that follows it
  },

  levels: {
    startColors: 3,
    maxColors: 6,
    colorEveryStages: 2, // one more pot colour every N stages
    stageTarget: 24, // pots to clear in stage 1
    stageTargetStep: 6, // extra pots per later stage
  },

  scoring: {
    perPot: 10,
    chainCap: 5, // cascade multiplier cap
    stageBonus: 500,
  },

  feel: {
    liftLerp: 0.35, // per-frame easing of the drawn lift toward the model lift
    dropFallMs: 220,
    popMs: 260,
    floatTextMs: 700,
    restartGuardMs: 600, // after game over, ignore taps this long so a held finger does not restart
    maxFrameMs: 100, // longest frame step; a background tab must not fast-forward the board
    noteBaseHz: 330, // flute note for column 0; each column a step up the scale
  },

  bot: {
    thinkMs: 120, // demo bot (?auto=1) re-plans this often
  },
};

export type GameConfig = typeof CONFIG;
