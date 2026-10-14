// Balance probe, run by hand: `npm run sim` (not part of `npm test`). Plays 12 seeded games each with no input,
// with a slower 'casual' bot (notices lids after 650 ms) and with the demo bot, and prints averages for
// docs/TUNING.md.
import { it } from 'vitest';
import { CONFIG } from '../src/config';
import { botChoice } from '../src/model/bot';
import { createGame, setHeld, step } from '../src/model/game';

const CASUAL = { ...CONFIG, bot: { ...CONFIG.bot, reactMs: 650, slackS: 0.2 } };

function play(seed: number, who: 'idle' | 'bot' | 'casual' | 'night') {
  const bot = who !== 'idle';
  const cfg = who === 'casual' ? CASUAL : CONFIG;
  const s = createGame(seed, CONFIG, 1, who === 'night');
  const dt = 1000 / 60;
  let think = 0;
  while (!s.over && s.elapsed < 900_000) {
    think += dt;
    if (bot && think >= CONFIG.bot.thinkMs) {
      think = 0;
      setHeld(s, botChoice(s, cfg));
    }
    step(s, dt, CONFIG);
    s.events = [];
  }
  return {
    secs: Math.round(s.elapsed / 1000),
    score: s.score,
    level: s.level,
    charmed: s.charmed,
    saves: s.saves,
    flowers: s.flowers,
  };
}

it('sim', { timeout: 120_000 }, () => {
  for (const who of ['idle', 'casual', 'bot', 'night'] as const) {
    const games = Array.from({ length: 12 }, (_, i) => play(i + 1, who));
    const avg = (k: 'secs' | 'score' | 'level' | 'charmed' | 'saves' | 'flowers') =>
      Math.round(games.reduce((a, g) => a + g[k], 0) / games.length);
    const line = `${who.padEnd(6)}  secs ${avg('secs')}  score ${avg('score')}  level ${avg('level')}`;
    process.stderr.write(
      `${line}  charmed ${avg('charmed')}  saves ${avg('saves')}  flowers ${avg('flowers')}  ` +
        `(secs: ${games.map((g) => g.secs).join(', ')}; levels: ${games.map((g) => g.level).join(', ')})\n`,
    );
  }
});
