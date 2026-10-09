import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { botChoice } from './bot';
import {
  bestLift,
  createGame,
  currentDropInterval,
  dropIntervalForStage,
  findMatches,
  msToDrop,
  potAt,
  setHeld,
  stageTarget,
  step,
  type GameState,
  type Pot,
} from './game';

const cfg = CONFIG;
let ids = 1000;

/** Pot shorthand: 2 = plain colour 2, 'w' = wild, 'g2' = gold colour 2. */
type Spec = number | 'w' | `g${number}`;
function pot(s: Spec): Pot {
  if (s === 'w') return { id: ids++, color: 0, kind: 'wild' };
  if (typeof s === 'string') return { id: ids++, color: Number(s.slice(1)), kind: 'gold' };
  return { id: ids++, color: s, kind: 'plain' };
}

function board(state: GameState, cols: [number, Spec[]][]): GameState {
  state.cols = cols.map(([lift, pots]) => ({ lift, pots: pots.map(pot) }));
  state.events = [];
  return state;
}

const colours = (s: GameState) => s.cols.map((c) => c.pots.map((p) => p.color));

/** A state that never drops a lid unless the test asks for it. */
function quiet(seed = 1): GameState {
  const s = createGame(seed, cfg);
  s.dropAcc = -1e9;
  return s;
}

describe('createGame', () => {
  it('deals startPots plain pots per column with no ready-made match', () => {
    for (let seed = 1; seed < 50; seed++) {
      const s = createGame(seed, cfg);
      expect(s.cols).toHaveLength(cfg.board.cols);
      for (const c of s.cols) {
        expect(c.pots).toHaveLength(cfg.board.startPots);
        expect(c.pots.every((p) => p.kind === 'plain')).toBe(true);
      }
      expect(findMatches(s.cols, cfg)).toEqual([]);
    }
  });

  it('is deterministic for a seed and gives every pot a unique id', () => {
    expect(colours(createGame(7, cfg))).toEqual(colours(createGame(7, cfg)));
    const all = createGame(7, cfg).cols.flatMap((c) => c.pots.map((p) => p.id));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('findMatches', () => {
  it('finds a run of three at the same absolute row, honouring lift', () => {
    const s = board(quiet(), [
      [0, [0, 1]],
      [1, [1]],
      [0, [2, 1]],
      [0, [3]],
      [0, []],
    ]);
    expect(potAt(s.cols[1], 1)?.color).toBe(1);
    const m = findMatches(s.cols, cfg);
    expect(m.map((x) => x.col)).toEqual([0, 1, 2]);
    expect(m.every((x) => x.row === 1)).toBe(true);
  });

  it('ignores runs of two and empty slots', () => {
    const s = board(quiet(), [
      [0, [0]],
      [0, [0]],
      [0, []],
      [0, [0]],
      [0, [0]],
    ]);
    expect(findMatches(s.cols, cfg)).toEqual([]);
  });

  it('three of a colour stacked in one column match too', () => {
    const s = board(quiet(), [
      [0, [1, 2, 2, 2]],
      [0, [0]],
      [0, []],
      [0, []],
      [0, []],
    ]);
    expect(findMatches(s.cols, cfg).map((x) => x.row)).toEqual([1, 2, 3]);
  });

  it('a wild pot completes a run of any colour', () => {
    const s = board(quiet(), [
      [0, [2]],
      [0, ['w']],
      [0, [2]],
      [0, [1]],
      [0, [1]],
    ]);
    expect(findMatches(s.cols, cfg).map((x) => x.col)).toEqual([0, 1, 2]);
  });

  it('a wild pot between two colours can serve both runs', () => {
    const s = board(quiet(), [
      [0, [2]],
      [0, [2]],
      [0, ['w']],
      [0, [1]],
      [0, [1]],
    ]);
    expect(findMatches(s.cols, cfg).map((x) => x.col)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('charming', () => {
  it('a held column rises one row per riseMs, stops at maxLift, and sinks when released', () => {
    const s = board(quiet(), [
      [0, [0]],
      [0, [1]],
      [0, [2]],
      [0, [3]],
      [0, [0]],
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
      [0, []],
      [0, tall],
      [0, []],
      [0, []],
      [0, []],
    ]);
    setHeld(s, 1);
    for (let i = 0; i < 10; i++) step(s, cfg.pace.riseMs, cfg);
    expect(s.cols[1].lift).toBe(1);
  });

  it('lifting a pot level with two same-colour neighbours clears all three and scores', () => {
    const s = board(quiet(), [
      [0, [1, 2]],
      [0, [2]],
      [0, [3, 2]],
      [0, [0]],
      [0, [1]],
    ]);
    setHeld(s, 1);
    step(s, cfg.pace.riseMs, cfg);
    expect(s.events.find((e) => e.type === 'clear')).toBeDefined();
    expect(colours(s)).toEqual([[1], [], [3], [0], [1]]);
    expect(s.score).toBe(3 * cfg.scoring.perPot);
  });
});

describe('cascades, specials and bonuses', () => {
  it('pots that fall into a new match after the pause clear as chain 2 at double points', () => {
    // Column 3 sinks: row 0 = 2,2,2 in columns 1-3 clears; the 1s above fall beside column 0's 1 and cascade.
    const s = board(quiet(), [
      [0, [1]],
      [0, [2, 1]],
      [0, [2, 1]],
      [1, [2]],
      [0, [0]],
    ]);
    step(s, cfg.pace.sinkMs, cfg);
    expect(s.chain).toBe(1);
    step(s, cfg.pace.chainPauseMs, cfg);
    const clears = s.events.filter((e) => e.type === 'clear');
    expect(clears).toHaveLength(2);
    expect(clears[1]).toMatchObject({ chain: 2, points: 3 * cfg.scoring.perPot * 2 });
    expect(s.cols.map((c) => c.pots.length)).toEqual([0, 0, 0, 0, 1]);
    expect(s.bestChain).toBe(2);
    step(s, cfg.pace.chainPauseMs, cfg);
    expect(s.chain).toBe(0);
  });

  it('a matched gold pot blasts every pot in its row', () => {
    const s = board(quiet(), [
      [0, [3]],
      [0, [1]],
      [0, ['g1']],
      [1, [1]],
      [0, [4]],
    ]);
    // Column 3 sinks to row 0: 1, g1, 1 match in columns 1-3; gold takes columns 0 and 4 of row 0 too.
    step(s, cfg.pace.sinkMs, cfg);
    const clear = s.events.find((e) => e.type === 'clear');
    expect(clear).toMatchObject({ blastRows: [0] });
    expect(s.cols.every((c) => c.pots.length === 0)).toBe(true);
  });

  it('a run of five scores the five bonus', () => {
    const s = board(quiet(), [
      [0, [2]],
      [0, [2]],
      [1, [2]],
      [0, [2]],
      [0, [2]],
    ]);
    step(s, cfg.pace.sinkMs, cfg);
    expect(s.score).toBe(5 * cfg.scoring.perPot + cfg.scoring.fiveBonus);
  });
});

describe('fever', () => {
  it('fills from clears, then pauses lids and doubles points', () => {
    const s = board(quiet(), [
      [0, [1, 2]],
      [0, [2]],
      [0, [3, 2]],
      [0, [0]],
      [0, [1]],
    ]);
    s.fever = 0.99;
    s.dropAcc = 0;
    setHeld(s, 1);
    step(s, cfg.pace.riseMs, cfg);
    expect(s.events.some((e) => e.type === 'fever' && e.on)).toBe(true);
    expect(s.feverTime).toBe(cfg.fever.durationMs);
    expect(msToDrop(s, cfg)).toBe(Infinity);
    const before = s.cols.reduce((n, c) => n + c.pots.length, 0);
    setHeld(s, null);
    for (let t = 0; t < cfg.fever.durationMs - 100; t += 50) step(s, 50, cfg);
    expect(s.events.some((e) => e.type === 'drop')).toBe(false);
    expect(s.cols.reduce((n, c) => n + c.pots.length, 0)).toBe(before);
    step(s, 200, cfg);
    expect(s.events.some((e) => e.type === 'fever' && !e.on)).toBe(true);
  });

  it('a clear during fever scores at the fever multiplier', () => {
    const s = board(quiet(), [
      [0, [1, 2]],
      [0, [2]],
      [0, [3, 2]],
      [0, [0]],
      [0, [1]],
    ]);
    s.feverTime = 1000;
    setHeld(s, 1);
    step(s, cfg.pace.riseMs, cfg);
    expect(s.score).toBe(3 * cfg.scoring.perPot * cfg.fever.pointsMult);
  });

  it('the meter drains outside fever', () => {
    const s = quiet();
    s.fever = 0.5;
    step(s, 1000, cfg);
    expect(s.fever).toBeCloseTo(0.5 - cfg.fever.decayPerSec);
  });
});

describe('lids, stages and game over', () => {
  it('drops the announced lid into the announced column', () => {
    const s = createGame(3, cfg);
    const { col, pot: lid } = s.nextDrop;
    expect(msToDrop(s, cfg)).toBe(dropIntervalForStage(1, cfg));
    step(s, dropIntervalForStage(1, cfg), cfg);
    const drop = s.events.find((e) => e.type === 'drop');
    expect(drop).toMatchObject({ col, pot: { id: lid.id } });
    expect(s.nextDrop.pot.id).not.toBe(lid.id);
  });

  it('a plain or gold lid almost never completes a line by itself when it lands', () => {
    // Only when every colour would complete a line is there no safe colour to deal.
    let drops = 0;
    let gifts = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = createGame(seed, cfg);
      for (let i = 0; i < 400 && !s.over; i++) {
        step(s, 100, cfg);
        const drop = s.events.find((e) => e.type === 'drop');
        const clear = s.events.find((e) => e.type === 'clear');
        if (drop?.type === 'drop' && drop.pot.kind !== 'wild') {
          drops++;
          if (clear?.type === 'clear' && clear.cells.some((c) => c.pot.id === drop.pot.id)) gifts++;
        }
        s.events = [];
      }
    }
    expect(drops).toBeGreaterThan(500);
    expect(gifts / drops).toBeLessThan(0.02);
  });

  it('lids come faster on a sparse board', () => {
    const s = board(quiet(), [
      [0, []],
      [0, []],
      [0, []],
      [0, []],
      [0, []],
    ]);
    expect(currentDropInterval(s, cfg)).toBeCloseTo(dropIntervalForStage(1, cfg) * cfg.pace.sparseFactor);
    board(s, [
      [0, [0, 1, 0, 1]],
      [0, [1, 0, 1, 0]],
      [0, [0, 1, 0, 1]],
      [0, [1, 0, 1, 0]],
      [0, [0, 1, 0, 1]],
    ]);
    expect(currentDropInterval(s, cfg)).toBe(dropIntervalForStage(1, cfg));
  });

  it('ends the game when a lid lands on a full column', () => {
    const full = Array.from({ length: cfg.board.rows }, (_, i) => i % 2);
    const s = createGame(3, cfg);
    board(s, [
      [0, full],
      [0, full],
      [0, full],
      [0, full],
      [0, full],
    ]);
    step(s, dropIntervalForStage(1, cfg), cfg);
    expect(s.over).toBe(true);
    expect(s.events.some((e) => e.type === 'over')).toBe(true);
  });

  it('a lid on a raised stack at the vine presses the snake down instead of ending the game', () => {
    const tall = Array.from({ length: cfg.board.rows - 2 }, (_, i) => i % 2);
    const s = board(createGame(1, cfg), [
      [2, tall],
      [2, tall],
      [2, tall],
      [2, tall],
      [2, tall],
    ]);
    s.held = 0;
    s.riseAcc = -1e9;
    s.dropAcc = dropIntervalForStage(1, cfg);
    const target = s.nextDrop.col;
    step(s, 0, cfg);
    expect(s.over).toBe(false);
    expect(s.cols[target].lift).toBe(1);
  });

  it('moves to the next stage after stageTarget pots and speeds up the lids', () => {
    const s = board(quiet(), [
      [0, [1, 2]],
      [0, [2]],
      [0, [3, 2]],
      [0, [0]],
      [0, [1]],
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
      [0, [1, 2]],
      [0, [2]],
      [0, [3, 2]],
      [0, [0]],
      [0, [1]],
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

  it('balance: the bot outlasts and outscores an idle player', { timeout: 60_000 }, () => {
    const seeds = [1, 2, 3, 4, 5, 6];
    const idle = seeds.map((x) => play(x, false));
    const bot = seeds.map((x) => play(x, true));
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(bot.map((s) => s.elapsed))).toBeGreaterThan(avg(idle.map((s) => s.elapsed)) * 2);
    expect(avg(bot.map((s) => s.score))).toBeGreaterThan(avg(idle.map((s) => s.score)) * 5);
  });
});
