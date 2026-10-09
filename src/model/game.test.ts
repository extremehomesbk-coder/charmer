import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { botChoice } from './bot';
import {
  bestLift,
  colorAt,
  createGame,
  dropIntervalForStage,
  findMatches,
  setHeld,
  stageTarget,
  step,
  type Column,
  type GameState,
} from './game';

const cfg = CONFIG;

function board(state: GameState, cols: Column[]): GameState {
  state.cols = cols.map((c) => ({ lift: c.lift, pots: [...c.pots] }));
  state.events = [];
  return state;
}

/** A state that never drops a lid unless the test asks for it. */
function quiet(seed = 1): GameState {
  const s = createGame(seed, cfg);
  s.dropAcc = -1e9;
  return s;
}

describe('createGame', () => {
  it('deals startPots per column with no ready-made match', () => {
    for (let seed = 1; seed < 50; seed++) {
      const s = createGame(seed, cfg);
      expect(s.cols).toHaveLength(cfg.board.cols);
      for (const c of s.cols) expect(c.pots).toHaveLength(cfg.board.startPots);
      expect(findMatches(s.cols, cfg)).toEqual([]);
    }
  });

  it('is deterministic for a seed', () => {
    expect(createGame(7, cfg).cols).toEqual(createGame(7, cfg).cols);
  });
});

describe('findMatches', () => {
  it('finds a run of three at the same absolute row, honouring lift', () => {
    const cols: Column[] = [
      { lift: 0, pots: [0, 1] },
      { lift: 1, pots: [1] },
      { lift: 0, pots: [2, 1] },
      { lift: 0, pots: [3] },
      { lift: 0, pots: [] },
    ];
    expect(colorAt(cols[1], 1)).toBe(1);
    const m = findMatches(cols, cfg);
    expect(m.map((x) => x.col)).toEqual([0, 1, 2]);
    expect(m.every((x) => x.row === 1 && x.color === 1)).toBe(true);
  });

  it('ignores runs of two and empty slots', () => {
    const cols: Column[] = [
      { lift: 0, pots: [0] },
      { lift: 0, pots: [0] },
      { lift: 0, pots: [] },
      { lift: 0, pots: [0] },
      { lift: 0, pots: [0] },
    ];
    expect(findMatches(cols, cfg)).toEqual([]);
  });
});

describe('charming', () => {
  it('a held column rises one row per riseMs, stops at maxLift, and sinks when released', () => {
    const s = board(quiet(), [
      { lift: 0, pots: [0] },
      { lift: 0, pots: [1] },
      { lift: 0, pots: [2] },
      { lift: 0, pots: [3] },
      { lift: 0, pots: [0] },
    ]);
    setHeld(s, 2);
    step(s, cfg.pace.riseMs, cfg);
    expect(s.cols[2].lift).toBe(1);
    for (let i = 0; i < 20; i++) step(s, cfg.pace.riseMs, cfg);
    expect(s.cols[2].lift).toBe(cfg.board.maxLift);
    setHeld(s, null);
    step(s, cfg.pace.sinkMs, cfg);
    expect(s.cols[2].lift).toBe(cfg.board.maxLift - 1);
  });

  it('a stack cannot be raised into the vine', () => {
    const tall = Array.from({ length: cfg.board.rows - 1 }, (_, i) => i % 2);
    const s = board(quiet(), [
      { lift: 0, pots: [] },
      { lift: 0, pots: tall },
      { lift: 0, pots: [] },
      { lift: 0, pots: [] },
      { lift: 0, pots: [] },
    ]);
    setHeld(s, 1);
    for (let i = 0; i < 10; i++) step(s, cfg.pace.riseMs, cfg);
    expect(s.cols[1].lift).toBe(1);
  });

  it('lifting a pot level with two same-colour neighbours clears all three and scores', () => {
    const s = board(quiet(), [
      { lift: 0, pots: [1, 2] },
      { lift: 0, pots: [2] },
      { lift: 0, pots: [3, 2] },
      { lift: 0, pots: [0] },
      { lift: 0, pots: [1] },
    ]);
    setHeld(s, 1);
    step(s, cfg.pace.riseMs, cfg);
    const clear = s.events.find((e) => e.type === 'clear');
    expect(clear).toBeDefined();
    expect(s.cols[0].pots).toEqual([1]);
    expect(s.cols[1].pots).toEqual([]);
    expect(s.cols[2].pots).toEqual([3]);
    expect(s.score).toBe(3 * cfg.scoring.perPot);
  });
});

describe('cascade scoring', () => {
  it('pots that fall into a new match after the pause clear as chain 2 at double points', () => {
    // Column 3 sinks: row 0 = 2,2,2 in columns 1-3 clears; the 1s of columns 1 and 2 fall to row 0 beside
    // column 0's 1 and clear on the cascade.
    const s = board(quiet(), [
      { lift: 0, pots: [1] },
      { lift: 0, pots: [2, 1] },
      { lift: 0, pots: [2, 1] },
      { lift: 1, pots: [2] },
      { lift: 0, pots: [0] },
    ]);
    step(s, cfg.pace.sinkMs, cfg);
    expect(s.chain).toBe(1);
    step(s, cfg.pace.chainPauseMs, cfg);
    const clears = s.events.filter((e) => e.type === 'clear');
    expect(clears).toHaveLength(2);
    expect(clears[1]).toMatchObject({ chain: 2, points: 3 * cfg.scoring.perPot * 2 });
    expect(s.cols.map((c) => c.pots.length)).toEqual([0, 0, 0, 0, 1]);
    step(s, cfg.pace.chainPauseMs, cfg);
    expect(s.chain).toBe(0);
  });

  it('a lid on a raised stack at the vine presses the snake down instead of ending the game', () => {
    const s = board(createGame(1, cfg), [
      { lift: 2, pots: Array.from({ length: cfg.board.rows - 2 }, (_, i) => i % 2) },
      { lift: 2, pots: Array.from({ length: cfg.board.rows - 2 }, (_, i) => i % 2) },
      { lift: 2, pots: Array.from({ length: cfg.board.rows - 2 }, (_, i) => i % 2) },
      { lift: 2, pots: Array.from({ length: cfg.board.rows - 2 }, (_, i) => i % 2) },
      { lift: 2, pots: Array.from({ length: cfg.board.rows - 2 }, (_, i) => i % 2) },
    ]);
    s.held = 0;
    s.dropAcc = dropIntervalForStage(1, cfg);
    s.riseAcc = -1e9;
    step(s, 0, cfg);
    expect(s.over).toBe(false);
    const drop = s.events.find((e) => e.type === 'drop');
    expect(drop).toBeDefined();
    if (drop?.type === 'drop') expect(s.cols[drop.col].lift).toBe(1);
  });
});

describe('lids, stages and game over', () => {
  it('drops a lid every interval', () => {
    const s = createGame(3, cfg);
    const before = s.cols.reduce((n, c) => n + c.pots.length, 0);
    step(s, dropIntervalForStage(1, cfg), cfg);
    const drops = s.events.filter((e) => e.type === 'drop');
    expect(drops).toHaveLength(1);
    const cleared = s.totalCleared;
    expect(s.cols.reduce((n, c) => n + c.pots.length, 0)).toBe(before + 1 - cleared);
  });

  it('ends the game when a lid lands on a full column', () => {
    const full = Array.from({ length: cfg.board.rows }, (_, i) => i % 2);
    const s = createGame(3, cfg);
    s.cols = s.cols.map(() => ({ lift: 0, pots: [...full] }));
    step(s, dropIntervalForStage(1, cfg), cfg);
    expect(s.over).toBe(true);
    expect(s.events.some((e) => e.type === 'over')).toBe(true);
  });

  it('moves to the next stage after stageTarget pots and speeds up the lids', () => {
    const s = board(quiet(), [
      { lift: 0, pots: [1, 2] },
      { lift: 0, pots: [2] },
      { lift: 0, pots: [3, 2] },
      { lift: 0, pots: [0] },
      { lift: 0, pots: [1] },
    ]);
    s.stageCleared = stageTarget(1, cfg) - 1;
    setHeld(s, 1);
    step(s, cfg.pace.riseMs, cfg);
    expect(s.stage).toBe(2);
    expect(s.events.some((e) => e.type === 'stage')).toBe(true);
    expect(dropIntervalForStage(2, cfg)).toBeLessThan(dropIntervalForStage(1, cfg));
  });
});

describe('bestLift and the demo bot', () => {
  it('finds the lift that makes a match', () => {
    const s = board(quiet(), [
      { lift: 0, pots: [1, 2] },
      { lift: 0, pots: [2] },
      { lift: 0, pots: [3, 2] },
      { lift: 0, pots: [0] },
      { lift: 0, pots: [1] },
    ]);
    expect(bestLift(s, cfg)).toEqual({ col: 1, lift: 1, gain: 3 });
    expect(botChoice(s, cfg)).toBe(1);
  });

  function play(seed: number, useBot: boolean): GameState {
    const s = createGame(seed, cfg);
    const dt = 1000 / 60;
    let think = 0;
    while (!s.over && s.elapsed < 600_000) {
      think += dt;
      if (useBot && think >= cfg.bot.thinkMs) {
        think = 0;
        setHeld(s, botChoice(s, cfg));
      }
      step(s, dt, cfg);
      s.events = [];
    }
    return s;
  }

  it('balance: the bot outlasts and outscores an idle player', () => {
    const seeds = [1, 2, 3, 4, 5, 6];
    const idle = seeds.map((x) => play(x, false));
    const bot = seeds.map((x) => play(x, true));
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(bot.map((s) => s.elapsed))).toBeGreaterThan(avg(idle.map((s) => s.elapsed)) * 1.5);
    expect(avg(bot.map((s) => s.score))).toBeGreaterThan(avg(idle.map((s) => s.score)));
  });
});
