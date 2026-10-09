/**
 * Rules of the game as pure TypeScript: no Phaser, no DOM. The scene calls setHeld() from input and step()
 * every frame, then draws the state and plays the events. docs/GAME_RULES.md describes these rules in words.
 */
import type { GameConfig } from '../config';
import { nextRandom, randomInt } from './rng';

export type RulesConfig = Pick<GameConfig, 'board' | 'pace' | 'levels' | 'scoring'>;

export interface Column {
  lift: number; // rows the snake has raised the stack off the basket rim
  pots: number[]; // pot colours, bottom first; pot i sits at row lift + i
}

export interface Cell {
  col: number;
  row: number;
  color: number;
}

export type GameEvent =
  | { type: 'move'; col: number; lift: number }
  | { type: 'drop'; col: number; row: number; color: number }
  | { type: 'clear'; cells: Cell[]; chain: number; points: number }
  | { type: 'stage'; stage: number; bonus: number }
  | { type: 'over'; col: number };

export interface GameState {
  cols: Column[];
  held: number | null;
  score: number;
  stage: number;
  stageCleared: number;
  totalCleared: number;
  colors: number;
  chain: number; // cascade depth of the clear in progress (0 = none)
  chainTimer: number; // ms left before the cascade check; everything else waits
  riseAcc: number;
  sinkAcc: number[];
  dropAcc: number;
  elapsed: number;
  over: boolean;
  rng: number;
  events: GameEvent[];
}

export function colorsForStage(stage: number, cfg: RulesConfig): number {
  const extra = Math.floor((stage - 1) / cfg.levels.colorEveryStages);
  return Math.min(cfg.levels.maxColors, cfg.levels.startColors + extra);
}

export function dropIntervalForStage(stage: number, cfg: RulesConfig): number {
  return Math.max(cfg.pace.dropMinMs, cfg.pace.dropMs * Math.pow(cfg.pace.dropFactor, stage - 1));
}

export function stageTarget(stage: number, cfg: RulesConfig): number {
  return cfg.levels.stageTarget + (stage - 1) * cfg.levels.stageTargetStep;
}

export function createGame(seed: number, cfg: RulesConfig): GameState {
  const { cols, startPots } = cfg.board;
  const state: GameState = {
    cols: [],
    held: null,
    score: 0,
    stage: 1,
    stageCleared: 0,
    totalCleared: 0,
    colors: colorsForStage(1, cfg),
    chain: 0,
    chainTimer: 0,
    riseAcc: 0,
    sinkAcc: new Array<number>(cols).fill(0),
    dropAcc: 0,
    elapsed: 0,
    over: false,
    rng: seed | 0,
    events: [],
  };
  // Deal the opening stacks without any ready-made match, so the first clear is the player's.
  do {
    state.cols = Array.from({ length: cols }, () => ({
      lift: 0,
      pots: Array.from({ length: startPots }, () => randomInt(state, state.colors)),
    }));
  } while (findMatches(state.cols, cfg).length > 0);
  return state;
}

/** Colour at an absolute row of a column, or -1 when that slot is empty. */
export function colorAt(col: Column, row: number): number {
  const i = row - col.lift;
  return i >= 0 && i < col.pots.length ? col.pots[i] : -1;
}

export function topRow(col: Column): number {
  return col.lift + col.pots.length - 1;
}

/** Every pot that is part of a horizontal run of matchLength or more same-colour pots. */
export function findMatches(cols: Column[], cfg: RulesConfig): Cell[] {
  const { rows, matchLength } = cfg.board;
  const found: Cell[] = [];
  for (let row = 0; row < rows; row++) {
    let start = 0;
    for (let c = 1; c <= cols.length; c++) {
      const prev = colorAt(cols[c - 1], row);
      const cur = c < cols.length ? colorAt(cols[c], row) : -2;
      if (cur === prev) continue;
      if (prev >= 0 && c - start >= matchLength) {
        for (let k = start; k < c; k++) found.push({ col: k, row, color: prev });
      }
      start = c;
    }
  }
  return found;
}

export function canRise(col: Column, cfg: RulesConfig): boolean {
  return col.lift < cfg.board.maxLift && topRow(col) < cfg.board.rows - 1;
}

export function setHeld(state: GameState, col: number | null): void {
  if (state.over) return;
  if (col !== state.held) state.riseAcc = 0;
  state.held = col;
}

/** Remove matched pots; stacks close up onto the snake. Returns how many pots cleared. */
function resolveMatches(state: GameState, cfg: RulesConfig): number {
  const cells = findMatches(state.cols, cfg);
  if (cells.length === 0) return 0;
  state.chain += 1;
  const mult = Math.min(state.chain, cfg.scoring.chainCap);
  const points = cells.length * cfg.scoring.perPot * mult;
  for (let c = 0; c < state.cols.length; c++) {
    const col = state.cols[c];
    const gone = new Set(cells.filter((x) => x.col === c).map((x) => x.row - col.lift));
    if (gone.size) col.pots = col.pots.filter((_, i) => !gone.has(i));
  }
  state.score += points;
  state.stageCleared += cells.length;
  state.totalCleared += cells.length;
  state.chainTimer = cfg.pace.chainPauseMs;
  state.events.push({ type: 'clear', cells, chain: state.chain, points });
  const target = stageTarget(state.stage, cfg);
  if (state.stageCleared >= target) {
    state.stageCleared -= target;
    state.stage += 1;
    state.colors = colorsForStage(state.stage, cfg);
    state.score += cfg.scoring.stageBonus;
    state.events.push({ type: 'stage', stage: state.stage, bonus: cfg.scoring.stageBonus });
  }
  return cells.length;
}

/** Lids favour the emptier columns (weight = free slots ^ dropBias), so gaps refill and rows stay matchable. */
export function pickDropColumn(state: GameState, cfg: RulesConfig): number {
  const weights = state.cols.map((col) => Math.pow(Math.max(0, cfg.board.rows - col.pots.length), cfg.pace.dropBias));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return randomInt(state, state.cols.length);
  let r = nextRandom(state) * total;
  for (let c = 0; c < weights.length; c++) {
    r -= weights[c];
    if (r < 0) return c;
  }
  return weights.length - 1;
}

function dropLid(state: GameState, cfg: RulesConfig): void {
  const c = pickDropColumn(state, cfg);
  const col = state.cols[c];
  if (col.pots.length >= cfg.board.rows) {
    state.over = true;
    state.held = null;
    state.events.push({ type: 'over', col: c });
    return;
  }
  // A raised stack is never punished for being raised: the lid presses the snake down to make room.
  if (col.lift + col.pots.length >= cfg.board.rows) {
    col.lift -= 1;
    state.events.push({ type: 'move', col: c, lift: col.lift });
  }
  const row = col.lift + col.pots.length;
  const color = randomInt(state, state.colors);
  col.pots.push(color);
  state.events.push({ type: 'drop', col: c, row, color });
}

/** Advance the game by dt milliseconds. Events since the last call are in state.events (caller clears them). */
export function step(state: GameState, dt: number, cfg: RulesConfig): void {
  if (state.over) return;
  state.elapsed += dt;

  // A clear is in progress: the board holds still for a beat, then cascades or ends the chain.
  if (state.chainTimer > 0) {
    state.chainTimer -= dt;
    if (state.chainTimer > 0) return;
    state.chainTimer = 0;
    if (resolveMatches(state, cfg) === 0) state.chain = 0;
    return;
  }

  const { riseMs, sinkMs } = cfg.pace;
  let moved = false;
  for (let c = 0; c < state.cols.length; c++) {
    const col = state.cols[c];
    if (c === state.held) {
      state.sinkAcc[c] = 0;
      state.riseAcc += dt;
      while (state.riseAcc >= riseMs) {
        state.riseAcc -= riseMs;
        if (!canRise(col, cfg)) {
          state.riseAcc = 0;
          break;
        }
        col.lift += 1;
        moved = true;
        state.events.push({ type: 'move', col: c, lift: col.lift });
        if (findMatches(state.cols, cfg).length) break;
      }
    } else if (col.lift > 0) {
      state.sinkAcc[c] += dt;
      if (state.sinkAcc[c] >= sinkMs) {
        state.sinkAcc[c] -= sinkMs;
        col.lift -= 1;
        moved = true;
        state.events.push({ type: 'move', col: c, lift: col.lift });
      }
    } else {
      state.sinkAcc[c] = 0;
    }
  }
  if (moved && resolveMatches(state, cfg) > 0) return;

  state.dropAcc += dt;
  const interval = dropIntervalForStage(state.stage, cfg);
  if (state.dropAcc >= interval) {
    state.dropAcc -= interval;
    dropLid(state, cfg);
    if (!state.over) resolveMatches(state, cfg);
  }
}

export interface LiftPlan {
  col: number;
  lift: number;
  gain: number;
}

/**
 * The lift that clears the most pots if one column moved there and the rest stayed put. Used by the demo bot
 * (and a future hint); null when no single lift clears anything.
 */
export function bestLift(state: GameState, cfg: RulesConfig): LiftPlan | null {
  let best: LiftPlan | null = null;
  for (let c = 0; c < state.cols.length; c++) {
    const col = state.cols[c];
    const highest = Math.min(cfg.board.maxLift, cfg.board.rows - col.pots.length);
    for (let lift = 0; lift <= highest; lift++) {
      if (lift === col.lift || col.pots.length === 0) continue;
      const trial = state.cols.map((x, i) => (i === c ? { lift, pots: x.pots } : x));
      const gain = findMatches(trial, cfg).length;
      if (gain === 0) continue;
      const better =
        !best || gain > best.gain || (gain === best.gain && Math.abs(lift - col.lift) < Math.abs(best.lift - col.lift));
      if (better) best = { col: c, lift, gain };
    }
  }
  return best;
}
