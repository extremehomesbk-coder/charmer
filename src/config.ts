/**
 * Every tunable number lives here: layout, colours, speeds, scoring, levels.
 * docs/TUNING.md explains each knob; docs/GAME_RULES.md explains the rules they drive.
 */
export const CONFIG = {
  title: 'Snake Song',
  version: '0.4.0',

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
    ruby: [0xd8324a, 0xffd2d8, 0x7a0f22],
    moon: [0xcfd6f5, 0xffffff, 0x6f78c8],
    king: [0x3d4a2a, 0xe8d79a, 0xd4a017],
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
    ruby: { rise: 0.6, sink: 0.35, points: 300 }, // quick and jumpy
    moon: { rise: 0.38, sink: 0.15, points: 350 }, // calm; only comes out after dark (the phone's clock)
    king: { rise: 0.24, sink: 0.15, points: 500 }, // slow to charm; worth the most
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
    meaner: 0.8, // each bounce shortens that lid's rest and wobble by this much (guarding is not a plan) ...
    meanerMinMs: 160, // ... down to this wobble; charming the snake is the only reset
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
    rubyFrom: 3,
    rubyRate: 0.1,
    moonFrom: 2, // moon snakes only at night: 19:00-06:00 on the phone (or ?night=1)
    moonRate: 0.15,
    nightFrom: 19, // hour the night starts ...
    nightTo: 6, // ... and ends
    kingFrom: 6,
    kingRate: 0.08,
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

  // Flowers: the currency. A charmed snake leaves flowers on the vine; they are banked when the run ends.
  flowers: {
    green: 1,
    gold: 2,
    sleepy: 1,
    ruby: 2,
    moon: 3,
    king: 3,
    perfect: 3, // a level with no lid landed
    comboFrom: 3, // a charm at this combo or higher ...
    comboBonus: 1, // ... gives this many extra
  },

  // The meta game: continue, daily pouch, taming, the bazaar.
  meta: {
    continuePrice: 50, // flowers for one more tune (once per run)
    continueOfferMs: 5000, // how long the offer stays up
    continueClears: 2, // pots blown away by a continue
    daily: { base: 10, step: 5, cap: 40, streakDays: 7, streakBonus: 50 }, // day 7 also tames a ruby snake
    tame: { green: 10, gold: 5, sleepy: 5, ruby: 3, moon: 3, king: 2 }, // charms to tame a breed
    prices: { ivory: 40, peacock: 60, ember: 80, monsoon: 120, noon: 150 }, // pungi skins and themes
  },

  // Looks and sounds that can be bought. Colours are art, scales are music; all of it is data, not code.
  skins: {
    pungi: {
      classic: {
        name: 'Gourd pungi',
        blurb: "the charmer's own, double harmonic",
        wood: ['#3d200d', '#9a5a2a', '#2e1608'],
        gourd: ['#ffd98a', '#d18a32', '#6e3a10'],
        band: '#b8302a',
        dots: '#1f8f8a',
        tassel: '#e2304a',
        scale: [0, 1, 4, 5, 7, 8, 11, 12, 13, 16, 17, 19],
        waves: ['sawtooth', 'square'],
        filter: 2200,
        nasal: 1400,
        vibrato: 6,
      },
      ivory: {
        name: 'Ivory flute',
        blurb: 'soft and airy, a pentatonic lullaby',
        wood: ['#9c8f74', '#fff6e0', '#8a7a5c'],
        gourd: ['#ffffff', '#efe3c8', '#8a7a5c'],
        band: '#4fa3c7',
        dots: '#c0392b',
        tassel: '#4fa3c7',
        scale: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24],
        waves: ['triangle', 'sine'],
        filter: 1800,
        nasal: 900,
        vibrato: 4.5,
      },
      peacock: {
        name: 'Peacock pungi',
        blurb: 'bright and strange, an eastern pentatonic',
        wood: ['#0d3a3d', '#1fa39a', '#082a2c'],
        gourd: ['#b8ffe8', '#1f8f8a', '#0b3b4a'],
        band: '#f5c542',
        dots: '#7a2cff',
        tassel: '#7a2cff',
        scale: [0, 2, 3, 7, 8, 12, 14, 15, 19, 20, 24],
        waves: ['square', 'triangle'],
        filter: 2600,
        nasal: 1800,
        vibrato: 7,
      },
      ember: {
        name: 'Ember pungi',
        blurb: 'dark and growling, harmonic minor',
        wood: ['#1a0a0a', '#5a1f14', '#0d0505'],
        gourd: ['#ff9a5c', '#b8302a', '#3a0a08'],
        band: '#f5c542',
        dots: '#ffd27a',
        tassel: '#ffd27a',
        scale: [0, 2, 3, 5, 7, 8, 11, 12, 14, 15, 17, 19],
        waves: ['sawtooth', 'sawtooth'],
        filter: 1600,
        nasal: 1100,
        vibrato: 5,
      },
    },
    themes: {
      dusk: {
        name: 'Dusk bazaar',
        blurb: 'lanterns, a full moon, a red rug',
        sky: ['#120a30', '#2a1660', '#5e2a85', '#b8497f', '#ff9f6b'],
        stars: true,
        light: 'moon',
        skyline: ['#3b1d63', '#26103f'],
        palm: '#2a1248',
        wall: ['#c98656', '#7e4430'],
        cap: ['#ffd29a', '#b8703f'],
        rug: ['#7a1828', '#5a0f1f'],
        bands: ['#e2a640', '#1f6f72'],
        haze: 'rgba(255,150,120,0.18)',
        weather: 'fireflies',
      },
      monsoon: {
        name: 'Monsoon night',
        blurb: 'rain on the terrace, lamps in the mist',
        sky: ['#050a1a', '#0b1a3a', '#133a4a', '#1f5a5c', '#3d7a6a'],
        stars: false,
        light: 'cloud',
        skyline: ['#0e2238', '#0a1626'],
        palm: '#07131f',
        wall: ['#6c7f8a', '#33434e'],
        cap: ['#b7c7cf', '#5a6e78'],
        rug: ['#0f3d33', '#082a24'],
        bands: ['#e2a640', '#b8302a'],
        haze: 'rgba(120,200,200,0.16)',
        weather: 'rain',
      },
      noon: {
        name: 'Desert noon',
        blurb: 'white sun, hot sand, striped awnings',
        sky: ['#1e6fd6', '#4aa3ea', '#9ad6f3', '#f3e2b0', '#ffd27a'],
        stars: false,
        light: 'sun',
        skyline: ['#d9a86a', '#b8803f'],
        palm: '#6b4a1e',
        wall: ['#f3d3a0', '#c98e58'],
        cap: ['#fff1d0', '#d8a060'],
        rug: ['#d9541e', '#a63a12'],
        bands: ['#1f8f8a', '#f5c542'],
        haze: 'rgba(255,220,150,0.25)',
        weather: 'dust',
      },
    },
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
