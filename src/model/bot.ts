/** Demo bot for ?auto=1 and the balance tests: charm the column whose lift clears the most pots. */
import { bestLift, type GameState, type RulesConfig } from './game';

/**
 * With no clear available in one lift, look two lifts ahead: raise one column to set up a clear that a second
 * lift finishes. A raised column sinks slowly enough (sinkMs) that the second lift lands in time.
 */
function bestSetup(state: GameState, cfg: RulesConfig): { col: number; lift: number } | null {
  let best: { col: number; lift: number; gain: number } | null = null;
  for (let c = 0; c < state.cols.length; c++) {
    const col = state.cols[c];
    const highest = Math.min(cfg.board.maxLift, cfg.board.rows - col.pots.length);
    for (let lift = col.lift + 1; lift <= highest; lift++) {
      const trial = { ...state, cols: state.cols.map((x, i) => (i === c ? { lift, pots: x.pots } : x)) };
      const next = bestLift(trial, cfg);
      if (next && next.col !== c && (!best || next.gain > best.gain)) best = { col: c, lift, gain: next.gain };
    }
  }
  return best;
}

export function botChoice(state: GameState, cfg: RulesConfig): number | null {
  const plan = bestLift(state, cfg);
  if (plan) return plan.lift > state.cols[plan.col].lift ? plan.col : null;
  // Raising is the only thing a held column does; lower targets are reached by letting go.
  const setup = bestSetup(state, cfg);
  return setup ? setup.col : null;
}
