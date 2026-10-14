import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { botChoice } from './bot';
import {
  createGame,
  gravityFor,
  lidIntervalForLevel,
  maxAirForLevel,
  potsForLevel,
  riseFor,
  secondsToReach,
  setHeld,
  step,
  warnMsForLevel,
  type GameState,
  type Pot,
  type SnakeKind,
} from './game';

const cfg = CONFIG;
const DT = 1000 / 60;

function pot(kind: SnakeKind = 'green', h = 0, id = 100): Pot {
  return { id, kind, h, lid: { kind: 'clay', phase: 'hung', y: 1, v: 0, timer: 999_999 } };
}

/** A game past its intro with the given pots (null = empty lane) and no lid due for a long time. */
function game(lanes: (Pot | null)[]): GameState {
  const s = createGame(1, cfg);
  s.lanes = lanes.map((p, i) => (p ? { ...p, id: i + 1, lid: { ...p.lid } } : null));
  s.introTimer = 0;
  s.lidTimer = 999_999;
  s.events = [];
  return s;
}

function run(s: GameState, ms: number): void {
  for (let t = 0; t < ms; t += DT) step(s, DT, cfg);
}

function drop(s: GameState, lane: number): void {
  const lid = (s.lanes[lane] as Pot).lid;
  lid.phase = 'fall';
  lid.y = 1;
  lid.v = 0;
}

describe('start', () => {
  it('puts the level-1 pots in their lanes with lids on the vine', () => {
    const s = createGame(7, cfg);
    const pots = s.lanes.filter((p) => p !== null);
    expect(s.lanes).toHaveLength(cfg.board.lanes);
    expect(pots).toHaveLength(cfg.levels.startPots);
    for (const p of pots) expect(p?.lid).toMatchObject({ phase: 'hung', y: 1 });
    expect(s.events[0]).toEqual({ type: 'level', level: 1 });
    expect(s.events.filter((e) => e.type === 'spawn')).toHaveLength(cfg.levels.startPots);
  });

  it('is deterministic for a seed', () => {
    const a = createGame(42, cfg);
    const b = createGame(42, cfg);
    for (let i = 0; i < 600; i++) {
      step(a, DT, cfg);
      step(b, DT, cfg);
    }
    expect(a.lanes).toEqual(b.lanes);
    expect(a.landed).toBe(b.landed);
  });

  it('drops no lid during the intro', () => {
    const s = createGame(3, cfg);
    run(s, cfg.levels.introMs - 50);
    expect(s.lanes.every((p) => !p || p.lid.phase === 'hung')).toBe(true);
  });
});

describe('charming', () => {
  it('raises the held snake and lets the others sink', () => {
    const s = game([pot('green', 0.5), pot('green', 0.5), null, null, null]);
    setHeld(s, 0);
    run(s, 500);
    expect(s.lanes[0]?.h).toBeCloseTo(0.5 + riseFor(1, 'green', cfg) * 0.5, 1);
    expect(s.lanes[1]?.h).toBeCloseTo(0.5 - cfg.snakes.green.sink * 0.5, 1);
  });

  it('a sleepy snake slips back faster than a green one', () => {
    const s = game([pot('green', 0.6), pot('sleepy', 0.6), null, null, null]);
    run(s, 500);
    expect(s.lanes[1]?.h ?? 1).toBeLessThan(s.lanes[0]?.h ?? 0);
  });

  it('a snake that reaches the vine clears its pot and scores', () => {
    const s = game([pot('gold', 0.98), pot(), null, null, null]);
    setHeld(s, 0);
    run(s, 200);
    expect(s.lanes[0]).toBeNull();
    expect(s.charmed).toBe(1);
    expect(s.score).toBe(cfg.snakes.gold.points);
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'charm', lane: 0, combo: 1 }));
  });

  it('shakes the lids of the neighbouring pots loose', () => {
    const s = game([pot(), pot('green', 0.999), pot(), pot(), null]);
    setHeld(s, 1);
    step(s, DT, cfg);
    expect(s.lanes[0]?.lid.phase).toBe('wobble');
    expect(s.lanes[2]?.lid.phase).toBe('wobble');
    expect(s.lanes[3]?.lid.phase).toBe('hung');
  });

  it('charms in a row build the combo, which runs out', () => {
    const s = game([pot('green', 0.999), null, null, pot('green', 0.999), pot()]);
    setHeld(s, 0);
    step(s, DT, cfg);
    setHeld(s, 3);
    step(s, DT, cfg);
    expect(s.combo).toBe(2);
    expect(s.score).toBe(cfg.snakes.green.points * 3);
    setHeld(s, null);
    run(s, cfg.scoring.comboMs + 100);
    expect(s.combo).toBe(0);
  });
});

describe('lids', () => {
  it('wobble, then fall', () => {
    const s = game([pot(), null, null, null, null]);
    s.lanes[0]!.lid.timer = 0;
    s.lidTimer = 1;
    step(s, DT, cfg);
    expect(s.lanes[0]?.lid.phase).toBe('wobble');
    expect(s.events).toContainEqual({ type: 'wobble', lane: 0, ms: warnMsForLevel(1, cfg) });
    run(s, warnMsForLevel(1, cfg));
    expect(s.lanes[0]?.lid.phase).toBe('fall');
  });

  it('bounce off a raised snake back to the vine, knocking it down a little', () => {
    const s = game([pot('green', 0.5), null, null, null, null]);
    drop(s, 0);
    while (s.saves === 0) step(s, DT, cfg);
    const save = s.events.find((e) => e.type === 'save');
    expect(save).toMatchObject({ lane: 0, points: cfg.scoring.save, combo: 1 });
    expect(s.lanes[0]?.h).toBeCloseTo((save?.type === 'save' ? save.y : 0) - cfg.lids.knock, 5);
    run(s, 1000);
    expect(s.lanes[0]?.lid.phase).toBe('hung');
    expect(s.landed).toBe(0);
  });

  it('land on a snake below guard height: the pot is sealed and a new pot appears next door', () => {
    const s = game([null, null, pot('green', cfg.snakes.guardMin / 2), null, pot()]);
    drop(s, 2);
    run(s, 1500);
    expect(s.landed).toBe(1);
    expect(s.lanes[2]?.lid.phase).toBe('sealed');
    const spawn = s.events.find((e) => e.type === 'spawn');
    expect(spawn).toMatchObject({ from: 2 });
    expect([1, 3]).toContain(spawn?.type === 'spawn' ? spawn.lane : -1);
    expect(s.lanes.filter((p) => p !== null)).toHaveLength(3);
  });

  it('a sealed snake cannot be charmed until the lid pops off', () => {
    const s = game([pot(), null, null, null, null]);
    drop(s, 0);
    run(s, 1500);
    expect(s.lanes[0]?.lid.phase).toBe('sealed');
    setHeld(s, 0);
    run(s, 300);
    expect(s.lanes[0]?.h).toBe(0);
    run(s, cfg.lids.sealMs);
    expect(s.events).toContainEqual({ type: 'reopen', lane: 0 });
    expect(s.lanes[0]?.h ?? 0).toBeGreaterThan(0);
  });

  it('a lid that lands with no free lane ends the game', () => {
    const s = game([pot(), pot(), pot(), pot(), pot()]);
    drop(s, 4);
    run(s, 1500);
    expect(s.over).toBe(true);
    expect(s.events).toContainEqual({ type: 'over', lane: 4 });
  });

  it('never has more lids in the air than the level allows', () => {
    const s = createGame(5, cfg);
    let most = 0;
    for (let i = 0; i < 60 * 20 && !s.over; i++) {
      step(s, DT, cfg);
      // shaken lids (from a charm) are exempt; with no input nothing is charmed
      const air = s.lanes.filter((p) => p && (p.lid.phase === 'wobble' || p.lid.phase === 'fall')).length;
      most = Math.max(most, air);
    }
    expect(most).toBeLessThanOrEqual(maxAirForLevel(1, cfg));
  });

  it('secondsToReach covers the wobble and the fall', () => {
    const s = game([pot(), null, null, null, null]);
    const lid = s.lanes[0]!.lid;
    lid.phase = 'wobble';
    lid.timer = 500;
    const g = gravityFor(1, 'clay', cfg);
    expect(secondsToReach(s, 0, 0, cfg)).toBeCloseTo(0.5 + Math.sqrt(2 / g), 5);
  });
});

describe('levels', () => {
  it('clearing every pot ends the level with a bonus, then the next level deals its pots', () => {
    const s = game([pot('green', 0.999), null, null, null, null]);
    s.score = 0;
    setHeld(s, 0);
    step(s, DT, cfg);
    const clear = s.events.find((e) => e.type === 'clear');
    expect(clear).toEqual({
      type: 'clear',
      level: 1,
      bonus: cfg.scoring.levelBonus + cfg.scoring.perfectBonus,
      perfect: true,
    });
    run(s, cfg.levels.breakMs + 50);
    expect(s.level).toBe(2);
    expect(s.lanes.filter((p) => p !== null)).toHaveLength(potsForLevel(2, cfg));
  });

  it('get harder and level off', () => {
    expect(lidIntervalForLevel(5, cfg)).toBeLessThan(lidIntervalForLevel(1, cfg));
    expect(lidIntervalForLevel(99, cfg)).toBe(cfg.lids.lidMinMs);
    expect(warnMsForLevel(99, cfg)).toBe(cfg.lids.warnMinMs);
    expect(gravityFor(99, 'clay', cfg)).toBe(cfg.lids.gravityMax);
    expect(gravityFor(1, 'iron', cfg)).toBeGreaterThan(gravityFor(1, 'clay', cfg));
    expect(potsForLevel(99, cfg)).toBe(cfg.levels.maxPots);
    expect(potsForLevel(99, cfg)).toBeLessThan(cfg.board.lanes); // always room for one mistake
    expect(riseFor(99, 'green', cfg)).toBeCloseTo(cfg.snakes.green.rise * cfg.snakes.riseMinMult);
  });
});

describe('bot', () => {
  it('charms the snake closest to the vine when nothing threatens', () => {
    const s = game([pot('green', 0.2), pot('green', 0.6), null, pot('gold', 0.65), null]);
    expect(botChoice(s, cfg)).toBe(1);
  });

  it('breaks off to guard a pot whose lid is about to land', () => {
    const s = game([pot('green', 0.9), null, pot('green', 0), null, null]);
    drop(s, 2);
    s.lanes[2]!.lid.y = 0.6;
    s.lanes[2]!.lid.v = 1.4;
    expect(botChoice(s, cfg)).toBe(2);
  });

  it('beats doing nothing', () => {
    const play = (bot: boolean) => {
      const s = createGame(11, cfg);
      while (!s.over && s.elapsed < 120_000) {
        if (bot) setHeld(s, botChoice(s, cfg));
        step(s, DT, cfg);
        s.events = [];
      }
      return s.elapsed;
    };
    expect(play(false)).toBeLessThan(30_000);
    expect(play(true)).toBeGreaterThan(play(false) * 3);
  });
});
