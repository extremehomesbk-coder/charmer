/**
 * Rules of the game as pure TypeScript: no Phaser, no DOM. The scene calls setHeld() from input and step()
 * every frame, then draws the state and plays the events. docs/GAME_RULES.md describes these rules in words.
 *
 * Heights are fractions of the climb: 0 is the pot rim, 1 is the bottom of a lid hanging on the vine.
 */
import type { GameConfig } from '../config';
import { nextRandom, randomInt } from './rng';

export type RulesConfig = Pick<GameConfig, 'board' | 'snakes' | 'lids' | 'levels' | 'scoring' | 'flowers' | 'meta'>;

/**
 * green: the plain snake; gold: slow to charm, worth more; sleepy: slips back fast when the flute stops;
 * ruby: quick and jumpy; moon: calm, only out after dark; king: slow and heavy, worth the most.
 */
export type SnakeKind = 'green' | 'gold' | 'sleepy' | 'ruby' | 'moon' | 'king';
export const SNAKE_KINDS: SnakeKind[] = ['green', 'gold', 'sleepy', 'ruby', 'moon', 'king'];
export type LidKind = 'clay' | 'iron';
/** hung: on the vine; wobble: about to drop; fall; bounce: flying back up; sealed: sitting on its pot. */
export type LidPhase = 'hung' | 'wobble' | 'fall' | 'bounce' | 'sealed';

export interface Lid {
  kind: LidKind;
  phase: LidPhase;
  y: number; // height of the lid's bottom
  v: number; // falling speed, climbs per second
  timer: number; // ms left: rest while hung, wobble, or sealed
  bounces: number; // times a snake has knocked it back: each makes it rest less and drop with less warning
}

export interface Pot {
  id: number; // stable identity, so the view can animate each pot
  kind: SnakeKind;
  h: number; // height of the snake's head
  lid: Lid;
}

export type GameEvent =
  | { type: 'level'; level: number } // a level starts; its pots arrive as spawn events
  | { type: 'spawn'; lane: number; pot: Pot; from: number | null } // from: the lane whose landed lid made it
  | { type: 'wobble'; lane: number; ms: number }
  | { type: 'fall'; lane: number }
  | { type: 'save'; lane: number; y: number; points: number; combo: number }
  | { type: 'seal'; lane: number }
  | { type: 'reopen'; lane: number }
  | { type: 'charm'; lane: number; pot: Pot; points: number; combo: number; flowers: number }
  | { type: 'clear'; level: number; bonus: number; perfect: boolean; flowers: number }
  | { type: 'over'; lane: number }
  | { type: 'revive'; lanes: number[] }; // a continue blew these pots away

export interface GameState {
  lanes: (Pot | null)[];
  held: number | null;
  score: number;
  level: number;
  combo: number; // charms and saves in a row, each inside comboMs of the last
  comboTimer: number;
  lidTimer: number; // ms until the next lid starts to wobble
  introTimer: number; // ms of calm while a level's pots arrive
  breakTimer: number; // ms of pause after a level is cleared
  landedThisLevel: number;
  charmed: number;
  saves: number;
  landed: number;
  flowers: number; // earned this run, banked when it ends
  charmedByKind: Partial<Record<SnakeKind, number>>;
  revived: boolean; // the one continue per run is spent
  night: boolean; // moon snakes are out
  elapsed: number;
  over: boolean;
  rng: number;
  nextId: number;
  events: GameEvent[];
}

/** Night by the phone's clock: moon snakes come out between nightFrom and nightTo. */
export function isNight(hour: number, cfg: RulesConfig): boolean {
  return hour >= cfg.levels.nightFrom || hour < cfg.levels.nightTo;
}

const pow = (base: number, level: number) => Math.pow(base, level - 1);

export function lidIntervalForLevel(level: number, cfg: RulesConfig): number {
  return Math.max(cfg.lids.lidMinMs, cfg.lids.lidMs * pow(cfg.lids.lidFactor, level));
}

export function warnMsForLevel(level: number, cfg: RulesConfig): number {
  return Math.max(cfg.lids.warnMinMs, cfg.lids.warnMs * pow(cfg.lids.warnFactor, level));
}

export function gravityFor(level: number, kind: LidKind, cfg: RulesConfig): number {
  const g = Math.min(cfg.lids.gravityMax, cfg.lids.gravity * pow(cfg.lids.gravityFactor, level));
  return kind === 'iron' ? g * cfg.lids.ironMult : g;
}

/** How fast a snake climbs while charmed: every level a little slower, down to riseMinMult. */
export function riseFor(level: number, kind: SnakeKind, cfg: RulesConfig): number {
  const mult = Math.max(cfg.snakes.riseMinMult, pow(cfg.snakes.riseFactor, level));
  return cfg.snakes[kind].rise * mult;
}

/** A bounced lid gets meaner: its wobble (and its rest on the vine) shrink by lids.meaner per bounce. */
export function meanerMs(ms: number, bounces: number, cfg: RulesConfig): number {
  return Math.max(cfg.lids.meanerMinMs, ms * Math.pow(cfg.lids.meaner, bounces));
}

export function maxAirForLevel(level: number, cfg: RulesConfig): number {
  return Math.min(cfg.lids.maxAirCap, 1 + Math.floor((level - 1) / cfg.lids.maxAirEvery));
}

export function potsForLevel(level: number, cfg: RulesConfig): number {
  const n = cfg.levels.startPots + Math.floor((level - 1) / cfg.levels.potsEvery);
  return Math.min(cfg.levels.maxPots, cfg.board.lanes, n);
}

export function lidsInAir(state: GameState): number {
  return state.lanes.filter((p) => p && (p.lid.phase === 'wobble' || p.lid.phase === 'fall')).length;
}

function nextLidMs(state: GameState, cfg: RulesConfig): number {
  const j = cfg.lids.jitter;
  const pots = Math.max(1, state.lanes.filter((p) => p !== null).length);
  const crowd = cfg.lids.refPots / pots;
  return lidIntervalForLevel(state.level, cfg) * crowd * (1 - j + 2 * j * nextRandom(state));
}

/** Which breed a new pot holds: the rarer breeds are rolled first, each only from its level on. */
export function rollKind(state: GameState, roll: number, cfg: RulesConfig): SnakeKind {
  const lv = cfg.levels;
  const table: [SnakeKind, number, number, boolean][] = [
    ['king', lv.kingFrom, lv.kingRate, true],
    ['moon', lv.moonFrom, lv.moonRate, state.night],
    ['ruby', lv.rubyFrom, lv.rubyRate, true],
    ['sleepy', lv.sleepyFrom, lv.sleepyRate, true],
    ['gold', lv.goldFrom, lv.goldRate, true],
  ];
  let edge = 0;
  for (const [kind, from, rate, allowed] of table) {
    if (!allowed || state.level < from) continue;
    edge += rate;
    if (roll < edge) return kind;
  }
  return 'green';
}

function newPot(state: GameState, cfg: RulesConfig, restMs: number): Pot {
  const lv = cfg.levels;
  const kind = rollKind(state, nextRandom(state), cfg);
  const iron = state.level >= lv.ironFrom && nextRandom(state) < lv.ironRate;
  return {
    id: state.nextId++,
    kind,
    h: 0,
    lid: { kind: iron ? 'iron' : 'clay', phase: 'hung', y: 1, v: 0, timer: restMs, bounces: 0 },
  };
}

function startLevel(state: GameState, level: number, cfg: RulesConfig): void {
  state.level = level;
  state.landedThisLevel = 0;
  state.introTimer = cfg.levels.introMs;
  state.lidTimer = cfg.levels.introMs + nextLidMs(state, cfg);
  state.events.push({ type: 'level', level });
  // Pick which lanes get a pot, at random.
  const free = state.lanes.map((_, i) => i);
  for (let n = potsForLevel(level, cfg); n > 0 && free.length; n--) {
    const lane = free.splice(randomInt(state, free.length), 1)[0];
    const pot = newPot(state, cfg, 0);
    state.lanes[lane] = pot;
    state.events.push({ type: 'spawn', lane, pot, from: null });
  }
}

/**
 * A new game. firstLevel > 1 starts further in (the ?level=N flag, for playtesting later levels); night lets
 * moon snakes out.
 */
export function createGame(seed: number, cfg: RulesConfig, firstLevel = 1, night = false): GameState {
  const state: GameState = {
    lanes: Array.from({ length: cfg.board.lanes }, () => null),
    held: null,
    score: 0,
    level: 0,
    combo: 0,
    comboTimer: 0,
    lidTimer: 0,
    introTimer: 0,
    breakTimer: 0,
    landedThisLevel: 0,
    charmed: 0,
    saves: 0,
    landed: 0,
    flowers: 0,
    charmedByKind: {},
    revived: false,
    night,
    elapsed: 0,
    over: false,
    rng: seed | 0,
    nextId: 1,
    events: [],
  };
  startLevel(state, Math.max(1, Math.floor(firstLevel)), cfg);
  return state;
}

/** Which lane the flute is playing for (null = nobody). Only one snake is charmed at a time. */
export function setHeld(state: GameState, lane: number | null): void {
  state.held = lane;
}

function bumpCombo(state: GameState, cfg: RulesConfig): number {
  state.combo = Math.min(cfg.scoring.comboCap, state.combo + 1);
  state.comboTimer = cfg.scoring.comboMs;
  return state.combo;
}

function charm(state: GameState, lane: number, cfg: RulesConfig): void {
  const pot = state.lanes[lane];
  if (!pot) return;
  const combo = bumpCombo(state, cfg);
  const points = cfg.snakes[pot.kind].points * combo;
  const flowers = cfg.flowers[pot.kind] + (combo >= cfg.flowers.comboFrom ? cfg.flowers.comboBonus : 0);
  state.score += points;
  state.flowers += flowers;
  state.charmed++;
  state.charmedByKind[pot.kind] = (state.charmedByKind[pot.kind] ?? 0) + 1;
  state.lanes[lane] = null;
  state.events.push({ type: 'charm', lane, pot, points, combo, flowers });
  // The snake tugs the vine as it climbs into it: nearby hanging lids shake loose.
  const reach = cfg.lids.shakeReach;
  for (let i = Math.max(0, lane - reach); i <= Math.min(state.lanes.length - 1, lane + reach); i++) {
    const lid = state.lanes[i]?.lid;
    if (!lid || lid.phase !== 'hung') continue;
    lid.phase = 'wobble';
    lid.timer = cfg.lids.shakeWarnMs;
    state.events.push({ type: 'wobble', lane: i, ms: cfg.lids.shakeWarnMs });
  }
  if (state.lanes.every((p) => p === null)) {
    const perfect = state.landedThisLevel === 0;
    const bonus = cfg.scoring.levelBonus * state.level + (perfect ? cfg.scoring.perfectBonus : 0);
    const flowers = perfect ? cfg.flowers.perfect : 0;
    state.score += bonus;
    state.flowers += flowers;
    state.breakTimer = cfg.levels.breakMs;
    state.events.push({ type: 'clear', level: state.level, bonus, perfect, flowers });
  }
}

/** A landed lid seals its pot and stirs up another pot in the nearest free lane; no free lane ends the game. */
function seal(state: GameState, lane: number, cfg: RulesConfig): void {
  const pot = state.lanes[lane];
  if (!pot) return;
  pot.h = 0;
  pot.lid.phase = 'sealed';
  pot.lid.y = 0;
  pot.lid.v = 0;
  pot.lid.timer = cfg.lids.sealMs;
  state.landed++;
  state.landedThisLevel++;
  state.combo = 0;
  state.events.push({ type: 'seal', lane });
  let best: number[] = [];
  let bestDist = Infinity;
  state.lanes.forEach((p, i) => {
    if (p) return;
    const d = Math.abs(i - lane);
    if (d < bestDist) [best, bestDist] = [[i], d];
    else if (d === bestDist) best.push(i);
  });
  if (!best.length) {
    state.over = true;
    state.held = null;
    state.events.push({ type: 'over', lane });
    return;
  }
  const target = best[randomInt(state, best.length)];
  const fresh = newPot(state, cfg, cfg.lids.restMs + cfg.lids.spawnGraceMs);
  state.lanes[target] = fresh;
  state.events.push({ type: 'spawn', lane: target, pot: fresh, from: lane });
}

function releaseLid(state: GameState, cfg: RulesConfig): boolean {
  if (lidsInAir(state) >= maxAirForLevel(state.level, cfg)) return false;
  const ready = state.lanes.flatMap((p, i) => (p && p.lid.phase === 'hung' && p.lid.timer <= 0 ? [i] : []));
  if (!ready.length) return false;
  const lane = ready[randomInt(state, ready.length)];
  const lid = (state.lanes[lane] as Pot).lid;
  const ms = meanerMs(warnMsForLevel(state.level, cfg), lid.bounces, cfg);
  lid.phase = 'wobble';
  lid.timer = ms;
  state.events.push({ type: 'wobble', lane, ms });
  return true;
}

function stepLid(state: GameState, lane: number, pot: Pot, dt: number, cfg: RulesConfig): void {
  const lid = pot.lid;
  const sec = dt / 1000;
  switch (lid.phase) {
    case 'hung':
      lid.timer = Math.max(0, lid.timer - dt);
      break;
    case 'wobble':
      lid.timer -= dt;
      if (lid.timer <= 0) {
        lid.phase = 'fall';
        lid.v = 0;
        state.events.push({ type: 'fall', lane });
      }
      break;
    case 'fall':
      lid.v += gravityFor(state.level, lid.kind, cfg) * sec;
      lid.y -= lid.v * sec;
      if (pot.h >= cfg.snakes.guardMin && lid.y <= pot.h) {
        lid.y = pot.h;
        pot.h = Math.max(0, pot.h - cfg.lids.knock * (lid.kind === 'iron' ? cfg.lids.ironMult : 1));
        lid.phase = 'bounce';
        lid.v = 0;
        lid.bounces++;
        const combo = bumpCombo(state, cfg);
        const points = cfg.scoring.save * combo;
        state.score += points;
        state.saves++;
        state.events.push({ type: 'save', lane, y: lid.y, points, combo });
      } else if (lid.y <= 0) {
        seal(state, lane, cfg);
      }
      break;
    case 'bounce':
      lid.y += cfg.lids.bounceSpeed * sec;
      if (lid.y >= 1) {
        lid.y = 1;
        lid.phase = 'hung';
        lid.timer = meanerMs(cfg.lids.restMs, lid.bounces, cfg);
      }
      break;
    case 'sealed':
      lid.timer -= dt;
      if (lid.timer <= 0) {
        lid.phase = 'bounce';
        state.events.push({ type: 'reopen', lane });
      }
      break;
  }
}

export function step(state: GameState, dt: number, cfg: RulesConfig): void {
  if (state.over) return;
  state.elapsed += dt;
  if (state.combo > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }
  if (state.breakTimer > 0) {
    state.breakTimer -= dt;
    if (state.breakTimer <= 0) startLevel(state, state.level + 1, cfg);
    return;
  }
  if (state.introTimer > 0) state.introTimer -= dt;

  const sec = dt / 1000;
  for (let lane = 0; lane < state.lanes.length; lane++) {
    const pot = state.lanes[lane];
    if (!pot) continue;
    if (pot.lid.phase === 'sealed') pot.h = 0;
    else if (state.held === lane) pot.h = Math.min(1, pot.h + riseFor(state.level, pot.kind, cfg) * sec);
    else pot.h = Math.max(0, pot.h - cfg.snakes[pot.kind].sink * sec);
    if (pot.h >= 1) {
      charm(state, lane, cfg);
      if (state.breakTimer > 0) return;
      continue;
    }
    stepLid(state, lane, pot, dt, cfg);
    if (state.over) return;
  }

  if (state.introTimer > 0) return;
  state.lidTimer -= dt;
  if (state.lidTimer <= 0) {
    // When no lid can go yet (all resting, or too many in the air), try again shortly.
    state.lidTimer = releaseLid(state, cfg) ? nextLidMs(state, cfg) : 150;
  }
}

/**
 * One more tune: after a game over, blow away the pot the lid landed on and the next most threatened pots
 * (meta.continueClears in all), put every lid back on the vine, and play on from the same level. Once per
 * run; the caller charges the flowers. Returns the lanes cleared, or null when no continue is possible.
 */
export function revive(state: GameState, lane: number, cfg: RulesConfig): number[] | null {
  if (!state.over || state.revived) return null;
  const threat = (i: number): number => {
    const p = state.lanes[i];
    if (!p) return -Infinity;
    if (i === lane) return Infinity;
    if (p.lid.phase === 'sealed') return 3;
    if (p.lid.phase === 'fall') return 2 - p.lid.y;
    if (p.lid.phase === 'wobble') return 1;
    return 0;
  };
  const order = state.lanes
    .map((_, i) => i)
    .filter((i) => state.lanes[i] !== null)
    .sort((a, b) => threat(b) - threat(a));
  const cleared = order.slice(0, cfg.meta.continueClears);
  for (const i of cleared) state.lanes[i] = null;
  for (const p of state.lanes) {
    if (!p) continue;
    p.h = 0;
    p.lid = { ...p.lid, phase: 'hung', y: 1, v: 0, timer: cfg.lids.restMs + cfg.lids.spawnGraceMs, bounces: 0 };
  }
  state.over = false;
  state.revived = true;
  state.combo = 0;
  state.introTimer = cfg.levels.introMs;
  state.lidTimer = cfg.levels.introMs + nextLidMs(state, cfg);
  state.events.push({ type: 'revive', lanes: cleared });
  // Clearing the rug this way does not finish a level by itself; the next charm does.
  return cleared;
}

/** Seconds until a lid reaches height y (null if it is not wobbling or falling). Used by the bot and the view. */
export function secondsToReach(state: GameState, lane: number, y: number, cfg: RulesConfig): number | null {
  const pot = state.lanes[lane];
  if (!pot) return null;
  const lid = pot.lid;
  if (lid.phase !== 'wobble' && lid.phase !== 'fall') return null;
  const g = gravityFor(state.level, lid.kind, cfg);
  const drop = Math.max(0, lid.y - y);
  const v = lid.phase === 'fall' ? lid.v : 0;
  // drop = v t + g t^2 / 2
  const t = (-v + Math.sqrt(v * v + 2 * g * drop)) / g;
  return t + (lid.phase === 'wobble' ? lid.timer / 1000 : 0);
}
