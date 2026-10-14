import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { botChoice } from './bot';
import {
  createGame,
  gravityFor,
  isNight,
  lidIntervalForLevel,
  maxAirForLevel,
  meanerMs,
  potsForLevel,
  revive,
  riseFor,
  rollKind,
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
  return { id, kind, h, lid: { kind: 'clay', phase: 'hung', y: 1, v: 0, timer: 999_999, bounces: 0 } };
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

  it('a snake that reaches the vine clears its pot, scores and leaves flowers', () => {
    const s = game([pot('gold', 0.98), pot(), null, null, null]);
    setHeld(s, 0);
    run(s, 200);
    expect(s.lanes[0]).toBeNull();
    expect(s.charmed).toBe(1);
    expect(s.charmedByKind).toEqual({ gold: 1 });
    expect(s.score).toBe(cfg.snakes.gold.points);
    expect(s.flowers).toBe(cfg.flowers.gold);
    expect(s.events).toContainEqual(
      expect.objectContaining({ type: 'charm', lane: 0, combo: 1, flowers: cfg.flowers.gold }),
    );
  });

  it('a charm at a high combo leaves an extra flower', () => {
    const lanes = [pot('green', 0.999), pot('green', 0.999), pot('green', 0.999), pot(), pot()];
    const s = game(lanes);
    for (let i = 0; i < 3; i++) {
      setHeld(s, i);
      step(s, DT, cfg);
    }
    const charms = s.events.filter((e) => e.type === 'charm');
    expect(charms.map((e) => (e.type === 'charm' ? e.flowers : -1))).toEqual([
      cfg.flowers.green,
      cfg.flowers.green,
      cfg.flowers.green + cfg.flowers.comboBonus,
    ]);
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

  it('come back meaner after every bounce: shorter rest, shorter wobble, down to a floor', () => {
    const s = game([pot('green', 0.6), null, null, null, null]);
    drop(s, 0);
    while (s.saves === 0) step(s, DT, cfg);
    run(s, 1000);
    const lid = s.lanes[0]!.lid;
    expect(lid.bounces).toBe(1);
    expect(lid.phase).toBe('hung');
    expect(lid.timer).toBeGreaterThan(0);
    expect(lid.timer).toBeLessThan(cfg.lids.restMs * cfg.lids.meaner); // rest started shorter, then counted down
    lid.timer = 0;
    s.lidTimer = 1;
    step(s, DT, cfg);
    expect(s.events.find((e) => e.type === 'wobble')).toMatchObject({
      ms: warnMsForLevel(1, cfg) * cfg.lids.meaner,
    });
    expect(meanerMs(1000, 99, cfg)).toBe(cfg.lids.meanerMinMs);
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
      flowers: cfg.flowers.perfect,
    });
    run(s, cfg.levels.breakMs + 50);
    expect(s.level).toBe(2);
    expect(s.lanes.filter((p) => p !== null)).toHaveLength(potsForLevel(2, cfg));
  });

  it('deal the rarer breeds from their levels on, moon snakes only at night', () => {
    const day = createGame(1, cfg);
    const night = createGame(1, cfg, 1, true);
    expect(isNight(22, cfg)).toBe(true);
    expect(isNight(3, cfg)).toBe(true);
    expect(isNight(12, cfg)).toBe(false);
    const kinds = (s: GameState, level: number) => {
      s.level = level;
      return new Set(Array.from({ length: 200 }, (_, i) => rollKind(s, i / 200, cfg)));
    };
    expect(kinds(day, 1)).toEqual(new Set(['green']));
    expect(kinds(day, 2)).toEqual(new Set(['green', 'gold']));
    expect(kinds(night, 2)).toEqual(new Set(['green', 'gold', 'moon']));
    expect(kinds(day, 5)).toEqual(new Set(['green', 'gold', 'sleepy', 'ruby']));
    expect(kinds(night, 9)).toEqual(new Set(['green', 'gold', 'sleepy', 'ruby', 'moon', 'king']));
  });

  it('a perfect level leaves flowers; a level with a landed lid does not', () => {
    const s = game([pot('green', 0.999), null, null, null, null]);
    setHeld(s, 0);
    step(s, DT, cfg);
    expect(s.events.find((e) => e.type === 'clear')).toMatchObject({ perfect: true, flowers: cfg.flowers.perfect });
    const t = game([pot('green', 0.999), null, null, null, null]);
    t.landedThisLevel = 1;
    setHeld(t, 0);
    step(t, DT, cfg);
    expect(t.events.find((e) => e.type === 'clear')).toMatchObject({ perfect: false, flowers: 0 });
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

describe('continue', () => {
  it('blows away the landed pot and the most threatened one, puts the lids back and plays on, once', () => {
    const s = game([pot(), pot(), pot(), pot(), pot()]);
    s.lanes[1]!.lid.phase = 'fall';
    s.lanes[1]!.lid.y = 0.3;
    drop(s, 4);
    run(s, 1500);
    expect(s.over).toBe(true);
    expect(revive(s, 4, cfg)).toEqual([4, 1]);
    expect(s.over).toBe(false);
    expect(s.revived).toBe(true);
    expect(s.lanes[4]).toBeNull();
    expect(s.lanes[1]).toBeNull();
    expect(s.lanes.filter((p) => p !== null)).toHaveLength(3);
    for (const p of s.lanes) if (p) expect(p.lid).toMatchObject({ phase: 'hung', y: 1 });
    expect(s.events).toContainEqual({ type: 'revive', lanes: [4, 1] });
    expect(s.introTimer).toBe(cfg.levels.introMs);
    run(s, 300);
    expect(s.over).toBe(false);
    // a second continue in the same run is refused
    s.over = true;
    expect(revive(s, 0, cfg)).toBeNull();
  });

  it('does nothing before a game over', () => {
    const s = game([pot(), null, null, null, null]);
    expect(revive(s, 0, cfg)).toBeNull();
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
