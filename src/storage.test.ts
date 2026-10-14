import { describe, expect, it } from 'vitest';
import { DEFAULT_SAVE, SAVE_VERSION, migrate } from './storage';

describe('save migration', () => {
  it('returns defaults for garbage', () => {
    expect(migrate(null)).toEqual(DEFAULT_SAVE);
    expect(migrate('nope')).toEqual(DEFAULT_SAVE);
    expect(migrate({ best: 'high' })).toEqual(DEFAULT_SAVE);
  });

  it('brings a v1 save (best + settings only) up to v2 with an empty meta game', () => {
    const out = migrate({ v: 1, best: 420, settings: { muted: true } });
    expect(out).toEqual({ ...DEFAULT_SAVE, v: SAVE_VERSION, best: 420, settings: { muted: true } });
  });

  it('keeps v2 fields and drops anything malformed', () => {
    const out = migrate({
      v: 2,
      best: 10,
      flowers: 33,
      tamed: { green: 4, bogus: 'x' },
      owned: ['pungi:ivory', 7],
      pungi: 'ivory',
      theme: 'noon',
      daily: { last: '2026-10-14', streak: 3 },
      stats: { runs: 5 },
    });
    expect(out.flowers).toBe(33);
    expect(out.tamed).toEqual({ green: 4 });
    expect(out.owned).toEqual(['pungi:ivory']);
    expect(out.pungi).toBe('ivory');
    expect(out.theme).toBe('noon');
    expect(out.daily).toEqual({ last: '2026-10-14', streak: 3 });
    expect(out.stats).toEqual({ runs: 5, offers: 0, continues: 0, bazaar: 0 });
  });

  it('never lets the wallet go negative', () => {
    expect(migrate({ flowers: -5 }).flowers).toBe(0);
  });
});
