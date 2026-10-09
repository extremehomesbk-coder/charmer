// Balance probe, run by hand: `npm run sim` (not part of `npm test`). Plays 12 seeded games with no input
// and 12 with the demo bot, and prints averages for docs/TUNING.md.
import { it } from 'vitest';
import { CONFIG } from '../src/config';
import { botChoice } from '../src/model/bot';
import { createGame, setHeld, step } from '../src/model/game';

function play(seed: number, bot: boolean) {
  const s = createGame(seed, CONFIG);
  const dt = 1000 / 60;
  let think = 0;
  while (!s.over && s.elapsed < 900_000) {
    think += dt;
    if (bot && think >= CONFIG.bot.thinkMs) {
      think = 0;
      setHeld(s, botChoice(s, CONFIG));
    }
    step(s, dt, CONFIG);
    s.events = [];
  }
  return { secs: Math.round(s.elapsed / 1000), score: s.score, stage: s.stage, cleared: s.totalCleared };
}

it('sim', { timeout: 120_000 }, () => {
  for (const bot of [false, true]) {
    const games = Array.from({ length: 12 }, (_, i) => play(i + 1, bot));
    const avg = (k: 'secs' | 'score' | 'stage' | 'cleared') =>
      Math.round(games.reduce((a, g) => a + g[k], 0) / games.length);
    const line = `${bot ? 'bot ' : 'idle'}  secs ${avg('secs')}  score ${avg('score')}  stage ${avg('stage')}`;
    process.stderr.write(`${line}  cleared ${avg('cleared')}  (secs: ${games.map((g) => g.secs).join(', ')})\n`);
  }
});
