/**
 * Rules of the game as pure TypeScript: no Phaser, no DOM. The scene calls setHeld() from input and step()
 * every frame, then draws the state and plays the events. docs/GAME_RULES.md describes these rules in words.
 */
import type { GameConfig } from '../config';
import { nextRandom, randomInt } from './rng';

export type RulesConfig = Pick<GameConfig, 'board' | 'pace' | 'levels' | 'scoring' | 'specials' | 'fever'>;

/** plain: matches its colour; gold: matches its colour and blasts its whole row when cleared; wild: matches any. */
export type PotKind = 'plain' | 'gold' | 'wild';

export interface Pot {
  id: number; // stable identity, so the view can animate each pot
  color: number;
  kind: PotKind;
}

export interface Column {
  lift: number; // rows the snake has raised the stack off the basket rim
  pots: Pot[]; // bottom first; pot i sits at row lift + i
}

export interface Cell {
  col: number;
  row: number;
  pot: Pot;
}

export type GameEvent =
  | { type: 'move'; col: number; lift: number }
  | { type: 'drop'; col: number; row: number; pot: Pot }
  | { type: 'clear'; cells: Cell[]; chain: number; points: number; longest: number; blastRows: number[] }
  | { type: 'stage'; stage: number; bonus: number }
  | { type: 'fever'; on: boolean }
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
  nextDrop: { col: number; pot: Pot }; // the lid already chosen, so the view can warn where it lands
  fever: number; // meter 0..1; full starts fever
  feverTime: number; // ms of fever left (lids paused, points multiplied)
  bestChain: number;
  elapsed: number;
  over: boolean;
  rng: number;
  nextId: number;
  events: GameEvent[];
}

export function colorsForStage(stage: number, cfg: RulesConfig): number {
  const extra = Math.floor((stage - 1) / cfg.levels.colorEveryStages);
  return Math.min(cfg.levels.maxColors, cfg.levels.startColors + extra);
}

export function dropIntervalForStage(stage: number, cfg: RulesConfig): number {
  return Math.max(cfg.pace.dropMinMs, cfg.pace.dropMs * Math.pow(cfg.pace.dropFactor, stage - 1));
}

/**
 * The lid interval right now: the stage's interval, shortened while the board is sparse (fewer than
 * sparseFill of all slots filled) so there is always something to line up; full speed down to sparseFactor.
 */
export function currentDropInterval(state: GameState, cfg: RulesConfig): number {
  const base = dropIntervalForStage(state.stage, cfg);
  const filled = state.cols.reduce((n, c) => n + c.pots.length, 0) / (cfg.board.cols * cfg.board.rows);
  const k = Math.min(1, filled / cfg.pace.sparseFill);
  return base * (cfg.pace.sparseFactor + (1 - cfg.pace.sparseFactor) * k);
}

export function stageTarget(stage: number, cfg: RulesConfig): number {
  return cfg.levels.stageTarget + (stage - 1) * cfg.levels.stageTargetStep;
}

function makePot(state: GameState, color: number, kind: PotKind = 'plain'): Pot {
  return { id: state.nextId++, color, kind };
}

/** True when this pot, landing on column c, would complete a line by itself. */
function completesLine(state: GameState, c: number, pot: Pot, cfg: RulesConfig): boolean {
  const trial = state.cols.map((x, i) => (i === c ? { lift: x.lift, pots: [...x.pots, pot] } : x));
  return findMatches(trial, cfg).some((m) => m.pot === pot);
}

/**
 * Deal a plain or gold pot's colour so that landing on column c does not complete a line by itself: every
 * clear starts with the player. Wild pots are a gift and may. Called when the lid is planned and again as it
 * lands (the board may have changed in between).
 */
function dealColor(state: GameState, c: number, pot: Pot, cfg: RulesConfig): void {
  if (pot.kind === 'wild' || state.cols[c].pots.length >= cfg.board.rows) return;
  const start = pot.color;
  for (let k = 0; k < state.colors; k++) {
    pot.color = (start + k) % state.colors;
    if (!completesLine(state, c, pot, cfg)) return;
  }
  pot.color = start;
}

/** A new lid for column c: mostly plain, sometimes gold or wild (rates in CONFIG.specials). */
function rollLid(state: GameState, c: number, cfg: RulesConfig): Pot {
  const r = nextRandom(state);
  const kind: PotKind =
    r < cfg.specials.wildRate ? 'wild' : r < cfg.specials.wildRate + cfg.specials.goldRate ? 'gold' : 'plain';
  const pot = makePot(state, randomInt(state, state.colors), kind);
  dealColor(state, c, pot, cfg);
  return pot;
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
    nextDrop: { col: 0, pot: { id: -1, color: 0, kind: 'plain' } },
    fever: 0,
    feverTime: 0,
    bestChain: 0,
    elapsed: 0,
    over: false,
    rng: seed | 0,
    nextId: 1,
    events: [],
  };
  // Deal the opening stacks without any ready-made match, so the first clear is the player's.
  do {
    state.cols = Array.from({ length: cols }, () => ({
      lift: 0,
      pots: Array.from({ length: startPots }, () => makePot(state, randomInt(state, state.colors))),
    }));
  } while (findMatches(state.cols, cfg).length > 0);
  planNextDrop(state, cfg);
  return state;
}

/** The pot at an absolute row of a column, or null when that slot is empty. */
export function potAt(col: Column, row: number): Pot | null {
  const i = row - col.lift;
  return i >= 0 && i < col.pots.length ? col.pots[i] : null;
}

export function topRow(col: Column): number {
  return col.lift + col.pots.length - 1;
}

/** True when the pots qualify as one run: no gaps, and every non-wild pot shares a colour. */
function sameRun(line: (Pot | null)[]): boolean {
  let color = -1;
  for (const p of line) {
    if (!p) return false;
    if (p.kind === 'wild') continue;
    if (color === -1) color = p.color;
    else if (p.color !== color) return false;
  }
  return true;
}

/** Indices covered by runs of matchLength or more in a line (wild pots count as any colour). */
function runsIn(line: (Pot | null)[], matchLength: number): Set<number> {
  const hit = new Set<number>();
  for (let i = 0; i + matchLength <= line.length; i++) {
    if (!sameRun(line.slice(i, i + matchLength))) continue;
    for (let k = i; k < i + matchLength; k++) hit.add(k);
  }
  return hit;
}

/**
 * Every pot in a run of matchLength or more pots of one colour, side by side in a row or stacked in a column,
 * wild pots counting as any colour. Each pot appears once even when runs overlap or cross.
 */
export function findMatches(cols: Column[], cfg: RulesConfig): Cell[] {
  const { rows, matchLength } = cfg.board;
  const found = new Map<number, Cell>();
  for (let row = 0; row < rows; row++) {
    const line = cols.map((c) => potAt(c, row));
    for (const c of runsIn(line, matchLength)) {
      const p = line[c] as Pot;
      found.set(p.id, { col: c, row, pot: p });
    }
  }
  cols.forEach((col, c) => {
    for (const i of runsIn(col.pots, matchLength)) {
      const p = col.pots[i];
      if (!found.has(p.id)) found.set(p.id, { col: c, row: col.lift + i, pot: p });
    }
  });
  return [...found.values()];
}

/** Longest straight run among the matched cells, across rows and columns (for the 4- and 5-in-a-row bonus). */
function longestRun(cells: Cell[]): number {
  const key = (c: number, r: number) => `${c},${r}`;
  const set = new Set(cells.map((x) => key(x.col, x.row)));
  let best = 0;
  for (const x of cells) {
    for (const [dc, dr] of [
      [1, 0],
      [0, 1],
    ]) {
      if (set.has(key(x.col - dc, x.row - dr))) continue; // count each run from its start
      let n = 1;
      while (set.has(key(x.col + dc * n, x.row + dr * n))) n++;
      best = Math.max(best, n);
    }
  }
  return best;
}

export function canRise(col: Column, cfg: RulesConfig): boolean {
  return col.lift < cfg.board.maxLift && topRow(col) < cfg.board.rows - 1;
}

export function setHeld(state: GameState, col: number | null): void {
  if (state.over) return;
  if (col !== state.held) state.riseAcc = 0;
  state.held = col;
}

/** Remove matched pots (gold pots take their whole row with them); stacks close up. Returns pots cleared. */
function resolveMatches(state: GameState, cfg: RulesConfig): number {
  const matched = findMatches(state.cols, cfg);
  if (matched.length === 0) return 0;
  const blastRows = [...new Set(matched.filter((c) => c.pot.kind === 'gold').map((c) => c.row))];
  const cells = [...matched];
  const seen = new Set(cells.map((c) => c.pot.id));
  for (const row of blastRows) {
    state.cols.forEach((col, c) => {
      const p = potAt(col, row);
      if (p && !seen.has(p.id)) {
        seen.add(p.id);
        cells.push({ col: c, row, pot: p });
      }
    });
  }

  state.chain += 1;
  state.bestChain = Math.max(state.bestChain, state.chain);
  const longest = longestRun(matched);
  const s = cfg.scoring;
  const mult = Math.min(state.chain, s.chainCap) * (state.feverTime > 0 ? cfg.fever.pointsMult : 1);
  const bonus = longest >= 5 ? s.fiveBonus : longest >= 4 ? s.fourBonus : 0;
  const points = (cells.length * s.perPot + bonus) * mult;

  for (const col of state.cols) col.pots = col.pots.filter((p) => !seen.has(p.id));
  state.score += points;
  state.stageCleared += cells.length;
  state.totalCleared += cells.length;
  state.chainTimer = cfg.pace.chainPauseMs;
  state.events.push({ type: 'clear', cells, chain: state.chain, points, longest, blastRows });

  if (state.feverTime <= 0) {
    state.fever += cells.length * cfg.fever.perPot * (1 + (state.chain - 1) * cfg.fever.chainBoost);
    if (state.fever >= 1) {
      state.fever = 0;
      state.feverTime = cfg.fever.durationMs;
      state.events.push({ type: 'fever', on: true });
    }
  }

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

function planNextDrop(state: GameState, cfg: RulesConfig): void {
  const col = pickDropColumn(state, cfg);
  state.nextDrop = { col, pot: rollLid(state, col, cfg) };
}

/** ms until the planned lid lands (Infinity during fever, when lids are paused). */
export function msToDrop(state: GameState, cfg: RulesConfig): number {
  if (state.feverTime > 0) return Infinity;
  return Math.max(0, currentDropInterval(state, cfg) - state.dropAcc);
}

function dropLid(state: GameState, cfg: RulesConfig): void {
  const { col: c, pot } = state.nextDrop;
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
  dealColor(state, c, pot, cfg);
  const row = col.lift + col.pots.length;
  col.pots.push(pot);
  state.events.push({ type: 'drop', col: c, row, pot });
  planNextDrop(state, cfg);
}

/** Advance the game by dt milliseconds. Events since the last call are in state.events (caller clears them). */
export function step(state: GameState, dt: number, cfg: RulesConfig): void {
  if (state.over) return;
  state.elapsed += dt;

  if (state.feverTime > 0) {
    state.feverTime -= dt;
    if (state.feverTime <= 0) {
      state.feverTime = 0;
      state.events.push({ type: 'fever', on: false });
    }
  } else {
    state.fever = Math.max(0, state.fever - (cfg.fever.decayPerSec * dt) / 1000);
  }

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

  if (state.feverTime > 0) return; // fever: the vine holds its lids
  state.dropAcc += dt;
  const interval = currentDropInterval(state, cfg);
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
