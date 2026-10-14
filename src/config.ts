/**
 * Every tunable number lives here: layout, colours, speeds, scoring, levels.
 * docs/TUNING.md explains each knob; docs/GAME_RULES.md explains the rules they drive.
 */
export const CONFIG = {
  title: 'Snake Song',
  version: '0.3.0',

  layout: {
    width: 390, // portrait iPhone design resolution; Phaser FIT scales it to any screen
    height: 844,
    safeTop: 24,
    safeBottom: 24,
    sidePad: 6, // margin left and right of the five lanes
    vineY: 138, // centre line of the vine
    lidTop: 150, // top of a lid hanging on the vine
    rimY: 676, // top of the pot rims; snakes rise from here to the hanging lids
    potWidth: 66,
    potHeight: 84,
    lidHeight: 30,
    headPeek: 15, // px of head that peeks over the rim while a snake rests
    fluteY: 790, // the pungi rests here, under the charmed pot
    renderScale: 2, // the canvas renders at this multiple of the design size so art and text stay crisp
  },

  art: {
    bodyWidth: 24, // snake body thickness
    bodyLength: 640, // longest body texture (rim to vine plus the part inside the pot)
    headWidth: 40,
    headHeight: 36,
    hoodWidth: 62,
    hoodHeight: 50,
  },

  colors: {
    background: 0x1a1240,
    text: '#fff8ec',
    charm: 0xffd36b, // lane glow and notes while charming
    save: 0x8cf0ff,
    // snake skins: [back, belly, pattern]
    green: [0x4cc25a, 0xf6e9a2, 0x23743a],
    goldSkin: [0xf2b52a, 0xfff2b8, 0xa8620c],
    sleepy: [0x6d8cf2, 0xe3ecff, 0x34459e],
  },

  board: {
    lanes: 5, // pots stand side by side on the rug, one per lane
  },

  snakes: {
    guardMin: 0.15, // a snake blocks a falling lid once its head is at least this high (fraction of the climb)
    riseFactor: 0.985, // every snake rises this much slower each level ...
    riseMinMult: 0.65, // ... down to this share of its level-1 speed
    // rise / sink: fraction of the climb per second while charmed / not charmed; points when charmed to the vine
    green: { rise: 0.42, sink: 0.15, points: 100 },
    gold: { rise: 0.3, sink: 0.15, points: 250 }, // slow and valuable
    sleepy: { rise: 0.45, sink: 0.6, points: 150 }, // slips back fast: charm it in one go
  },

  lids: {
    lidMs: 2400, // a lid starts to wobble this often at level 1 with refPots pots out (+/- jitter) ...
    refPots: 3, // ... more pots, more often; fewer pots, less often (so a level can always be finished)
    lidFactor: 0.9, // interval multiplier per level
    lidMinMs: 900,
    jitter: 0.3,
    warnMs: 1000, // wobble on the vine before it drops
    warnFactor: 0.93,
    warnMinMs: 350,
    gravity: 1.8, // climbs per second^2: about 1 s from the vine to the rim at level 1
    gravityFactor: 1.06, // per level
    gravityMax: 5,
    ironMult: 1.5, // iron lids fall this much faster and knock harder
    knock: 0.1, // a lid that hits a snake knocks its head down this much (iron: x ironMult)
    bounceSpeed: 2.2, // climbs per second a bounced lid flies back up to the vine
    shakeReach: 1, // charming a snake shakes the vine: lids this many lanes either side start to wobble ...
    shakeWarnMs: 700, // ... and drop after this long
    restMs: 1400, // a lid hangs at least this long after it gets back to the vine
    sealMs: 1500, // a landed lid seals its pot this long, then pops back up
    spawnGraceMs: 1500, // a new pot's lid waits this extra time before it can fall
    maxAirEvery: 2, // one more lid may be wobbling or falling at once every N levels ...
    maxAirCap: 3, // ... up to this many
  },

  levels: {
    startPots: 3,
    potsEvery: 2, // one more pot at the start of a level every N levels ...
    maxPots: 4, // ... up to this many, so there is always room for one mistake
    goldFrom: 2, // gold snakes appear from this level
    goldRate: 0.2,
    sleepyFrom: 4,
    sleepyRate: 0.2,
    ironFrom: 3, // iron lids from this level
    ironRate: 0.25,
    introMs: 1200, // no lids fall for this long while a level's pots arrive
    breakMs: 1800, // pause between levels
  },

  scoring: {
    save: 40, // a lid bounced back to the vine
    comboMs: 3000, // charms and saves inside this window of each other build the combo
    comboCap: 5, // points are multiplied by the combo, up to this
    levelBonus: 200, // x level number
    perfectBonus: 300, // a level with no lid landed
  },

  feel: {
    swayIdle: 3, // px of body sway at rest
    swayCharm: 14, // px of body sway while charmed
    swayHz: 1.4,
    headLerp: 0.3, // per-frame easing of the drawn height toward the model height
    hoodLerp: 0.15,
    floatTextMs: 800,
    shakeMs: 160,
    shake: 0.008,
    scoreCountMs: 400, // the score display counts up to the real score over about this long
    noteEveryMs: 200, // a music note floats up from the pungi this often while charming
    blinkEveryMs: 3200,
    restartGuardMs: 700, // after game over, ignore taps this long so a held finger does not restart
    maxFrameMs: 100, // longest frame step; a background tab must not fast-forward the game
    noteBaseHz: 294, // the pungi's tonic for lane 0; each lane a step up the scale
    noteStepMs: 170, // the pungi melody changes note this often
  },

  bot: {
    thinkMs: 120, // demo bot (?auto=1) re-plans this often
    reactMs: 350, // ... and only notices a wobbling lid this long after it starts
    slackS: 0.35, // it leaves its charm to guard a lane when a lid would land within this much slack
  },
};

export type GameConfig = typeof CONFIG;
