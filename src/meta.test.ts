import { describe, expect, it } from 'vitest';
import { CONFIG } from './config';
import {
  buy,
  canContinue,
  CATALOG,
  claimDaily,
  dailyReward,
  dailyStreakIfClaimed,
  dayKey,
  equip,
  isTamed,
  owns,
  payContinue,
  recordCharm,
  tamedKinds,
  tameThreshold,
} from './meta';
import { DEFAULT_SAVE, type SaveData } from './storage';

const fresh = (over: Partial<SaveData> = {}): SaveData => ({ ...structuredClone(DEFAULT_SAVE), ...over });

describe('catalogue and buying', () => {
  it('lists every pungi skin and theme, the defaults free', () => {
    expect(CATALOG.map((i) => i.id)).toEqual([
      'pungi:classic',
      'pungi:ivory',
      'pungi:peacock',
      'pungi:ember',
      'theme:dusk',
      'theme:monsoon',
      'theme:noon',
    ]);
    expect(CATALOG.find((i) => i.id === 'pungi:classic')?.price).toBe(0);
    expect(CATALOG.find((i) => i.id === 'theme:dusk')?.price).toBe(0);
    expect(owns(fresh(), 'pungi:classic')).toBe(true);
    expect(owns(fresh(), 'pungi:ivory')).toBe(false);
  });

  it('buying takes the flowers, owns and equips the item; short or repeat buys are refused', () => {
    const price = CONFIG.meta.prices.ivory;
    expect(buy(fresh({ flowers: price - 1 }), 'pungi:ivory')).toBeNull();
    const after = buy(fresh({ flowers: price + 5 }), 'pungi:ivory');
    expect(after).toMatchObject({ flowers: 5, owned: ['pungi:ivory'], pungi: 'ivory' });
    expect(buy(after as SaveData, 'pungi:ivory')).toBeNull();
    const theme = buy(fresh({ flowers: 999 }), 'theme:noon');
    expect(theme).toMatchObject({ theme: 'noon', flowers: 999 - CONFIG.meta.prices.noon });
  });

  it('equips only what is owned', () => {
    expect(equip(fresh(), 'theme:noon').theme).toBe('dusk');
    expect(equip(fresh({ owned: ['theme:noon'] }), 'theme:noon').theme).toBe('noon');
    expect(equip(fresh({ pungi: 'ivory', owned: ['pungi:ivory'] }), 'pungi:classic').pungi).toBe('classic');
  });
});

describe('taming', () => {
  it('a breed is tamed at its threshold, and recordCharm says when that happens', () => {
    let save = fresh();
    let tamedNow = false;
    for (let i = 0; i < tameThreshold('gold'); i++) {
      expect(isTamed(save, 'gold')).toBe(false);
      ({ save, tamedNow } = recordCharm(save, 'gold'));
    }
    expect(tamedNow).toBe(true);
    expect(isTamed(save, 'gold')).toBe(true);
    expect(recordCharm(save, 'gold').tamedNow).toBe(false);
    expect(tamedKinds(save)).toEqual(['gold']);
  });
});

describe('daily pouch', () => {
  it('formats the local day', () => {
    expect(dayKey(new Date(2026, 9, 14, 23, 59))).toBe('2026-10-14');
  });

  it('first claim is day 1; the next day continues the streak; a missed day resets it', () => {
    const d1 = claimDaily(fresh(), '2026-10-14');
    expect(d1).toMatchObject({ streak: 1, flowers: dailyReward(1), rare: null });
    expect(d1?.save.flowers).toBe(CONFIG.meta.daily.base);
    expect(claimDaily(d1!.save, '2026-10-14')).toBeNull(); // once a day
    const d2 = claimDaily(d1!.save, '2026-10-15');
    expect(d2?.streak).toBe(2);
    expect(d2?.flowers).toBe(CONFIG.meta.daily.base + CONFIG.meta.daily.step);
    const reset = claimDaily(d2!.save, '2026-10-17');
    expect(reset?.streak).toBe(1);
    expect(dailyStreakIfClaimed(reset!.save, '2026-10-17')).toBe(0);
    expect(dailyStreakIfClaimed(reset!.save, '2026-10-18')).toBe(2);
  });

  it('the reward is capped, and a full week tames a ruby snake with a bonus', () => {
    const d = CONFIG.meta.daily;
    expect(dailyReward(99)).toBe(d.cap);
    let save = fresh();
    let last: ReturnType<typeof claimDaily> = null;
    for (let i = 0; i < d.streakDays; i++) {
      last = claimDaily(save, `2026-11-${String(10 + i).padStart(2, '0')}`);
      save = last!.save;
    }
    expect(last?.streak).toBe(d.streakDays);
    expect(last?.rare).toBe('ruby');
    expect(last?.flowers).toBe(dailyReward(d.streakDays) + d.streakBonus);
    expect(isTamed(save, 'ruby')).toBe(true);
  });

  it('crosses month and year ends', () => {
    const a = claimDaily(fresh(), '2026-12-31');
    expect(claimDaily(a!.save, '2027-01-01')?.streak).toBe(2);
  });
});

describe('continue', () => {
  const price = CONFIG.meta.continuePrice;
  it('is offered once per run when wallet plus run flowers cover the price', () => {
    expect(canContinue(fresh({ flowers: price }), 0, false)).toBe(true);
    expect(canContinue(fresh({ flowers: price - 10 }), 10, false)).toBe(true);
    expect(canContinue(fresh({ flowers: price - 10 }), 9, false)).toBe(false);
    expect(canContinue(fresh({ flowers: 999 }), 0, true)).toBe(false);
  });

  it('is paid from the run first, then the wallet', () => {
    expect(payContinue(fresh({ flowers: 100 }), 20)).toEqual({
      save: expect.objectContaining({ flowers: 100 - (price - 20) }),
      runFlowers: 0,
    });
    expect(payContinue(fresh({ flowers: 100 }), price + 7)).toEqual({
      save: expect.objectContaining({ flowers: 100 }),
      runFlowers: 7,
    });
  });
});
