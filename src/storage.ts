/**
 * localStorage wrapper with a versioned save format. Every read and write is wrapped in try/catch:
 * private mode or blocked storage just means no persistence, never a crash.
 */
import { CONFIG } from './config';
import type { SnakeKind } from './model/game';

export const SAVE_VERSION = 2;

export interface SaveData {
  v: number;
  best: number;
  settings: Record<string, boolean | number | string>;
  flowers: number; // the wallet
  tamed: Partial<Record<SnakeKind, number>>; // charms per breed, toward taming it
  owned: string[]; // bazaar item ids
  pungi: string; // pungi skin in use
  theme: string; // theme in use
  daily: { last: string; streak: number }; // last pouch day (YYYY-MM-DD) and days in a row
  stats: { runs: number; offers: number; continues: number; bazaar: number }; // local only, for the playtest log
}

const KEY = `${CONFIG.title.toLowerCase().replace(/\s+/g, '-')}.save`;

export const DEFAULT_SAVE: SaveData = {
  v: SAVE_VERSION,
  best: 0,
  settings: {},
  flowers: 0,
  tamed: {},
  owned: [],
  pungi: 'classic',
  theme: 'dusk',
  daily: { last: '', streak: 0 },
  stats: { runs: 0, offers: 0, continues: 0, bazaar: 0 },
};

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);

/** Bring an older save up to the current version. v1 had only best and settings; v2 added the meta game. */
export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_SAVE);
  const d = raw as Record<string, unknown>;
  const tamed: Partial<Record<SnakeKind, number>> = {};
  if (d.tamed && typeof d.tamed === 'object') {
    for (const [k, v] of Object.entries(d.tamed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) tamed[k as SnakeKind] = v;
    }
  }
  const daily = (d.daily && typeof d.daily === 'object' ? d.daily : {}) as Record<string, unknown>;
  const stats = (d.stats && typeof d.stats === 'object' ? d.stats : {}) as Record<string, unknown>;
  return {
    v: SAVE_VERSION,
    best: num(d.best),
    settings: d.settings && typeof d.settings === 'object' ? (d.settings as SaveData['settings']) : {},
    flowers: Math.max(0, num(d.flowers)),
    tamed,
    owned: Array.isArray(d.owned) ? d.owned.filter((x): x is string => typeof x === 'string') : [],
    pungi: str(d.pungi, 'classic'),
    theme: str(d.theme, 'dusk'),
    daily: { last: str(daily.last, ''), streak: num(daily.streak) },
    stats: {
      runs: num(stats.runs),
      offers: num(stats.offers),
      continues: num(stats.continues),
      bazaar: num(stats.bazaar),
    },
  };
}

export function loadSave(): SaveData {
  try {
    const text = window.localStorage.getItem(KEY);
    return text ? migrate(JSON.parse(text)) : structuredClone(DEFAULT_SAVE);
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function writeSave(data: SaveData): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...data, v: SAVE_VERSION }));
  } catch {
    /* storage unavailable: play on without persistence */
  }
}

/** Read, change, write. Returns the new save. */
export function updateSave(fn: (save: SaveData) => SaveData): SaveData {
  const next = fn(loadSave());
  writeSave(next);
  return next;
}

export function recordBest(score: number): number {
  const save = loadSave();
  if (score > save.best) {
    save.best = score;
    writeSave(save);
  }
  return save.best;
}
