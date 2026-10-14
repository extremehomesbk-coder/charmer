/**
 * Demo bot for ?auto=1 and the balance probe: charm the snake closest to the vine, but break off to guard a
 * lane when its lid would land before that snake could get its head up. It notices a wobbling lid only after
 * bot.reactMs, like a person would.
 */
import type { GameConfig } from '../config';
import { meanerMs, riseFor, secondsToReach, warnMsForLevel, type GameState, type RulesConfig } from './game';

type BotConfig = RulesConfig & Pick<GameConfig, 'bot'>;

const MARGIN = 0.04; // guard a little above the minimum so a sinking snake still blocks on impact

export function botChoice(state: GameState, cfg: BotConfig): number | null {
  const guard = cfg.snakes.guardMin + MARGIN;
  let urgent: { lane: number; slack: number } | null = null;
  state.lanes.forEach((pot, lane) => {
    if (!pot) return;
    const lid = pot.lid;
    const warn = meanerMs(warnMsForLevel(state.level, cfg), lid.bounces, cfg);
    if (lid.phase === 'wobble' && warn - lid.timer < cfg.bot.reactMs) return;
    const t = secondsToReach(state, lane, guard, cfg);
    if (t === null) return;
    if (pot.h - cfg.snakes[pot.kind].sink * t >= guard) return; // already high enough to take the hit
    const slack = t - Math.max(0, guard - pot.h) / riseFor(state.level, pot.kind, cfg);
    if (!urgent || slack < urgent.slack) urgent = { lane, slack };
  });
  const u = urgent as { lane: number; slack: number } | null;
  if (u && u.slack < cfg.bot.slackS) return u.lane;

  let best: number | null = null;
  let bestTime = Infinity;
  state.lanes.forEach((pot, lane) => {
    if (!pot || pot.lid.phase === 'sealed') return;
    const time = (1 - pot.h) / riseFor(state.level, pot.kind, cfg);
    if (time < bestTime) [best, bestTime] = [lane, time];
  });
  return best;
}
