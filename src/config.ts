/**
 * Every tunable number lives here: layout, colours, speeds, scoring, levels.
 * docs/TUNING.md explains each knob; docs/GAME_RULES.md explains the rules they drive.
 */
export const CONFIG = {
  title: 'Game',
  version: '0.1.0',

  layout: {
    width: 390, // portrait iPhone design resolution; Phaser FIT scales it to any screen
    height: 844,
    safeTop: 24,
    safeBottom: 24,
  },

  colors: {
    background: 0x12141c,
    panel: 0x1a1d28,
    accent: 0x3cc8ff,
    danger: 0xff4d4d,
    text: '#f1f3f8',
    textDim: '#8d93a8',
  },

  // Replace with the real rules. Kept here only so the starter scene has something to tune.
  example: {
    targetRadius: 28,
    moveStep: 60, // px per arrow key / swipe step
    pointsPerHit: 10,
  },
};

export type GameConfig = typeof CONFIG;
