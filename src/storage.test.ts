import { describe, expect, it } from 'vitest';
import { DEFAULT_SAVE, SAVE_VERSION, migrate } from './storage';

describe('save migration', () => {
  it('returns defaults for garbage', () => {
    expect(migrate(null)).toEqual(DEFAULT_SAVE);
    expect(migrate('nope')).toEqual(DEFAULT_SAVE);
    expect(migrate({ best: 'high' })).toEqual(DEFAULT_SAVE);
  });

  it('keeps a valid best score and stamps the current version', () => {
    const out = migrate({ v: 0, best: 420, settings: { sound: false } });
    expect(out).toEqual({ v: SAVE_VERSION, best: 420, settings: { sound: false } });
  });
});
