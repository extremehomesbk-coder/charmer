/**
 * localStorage wrapper with a versioned save format. Every read and write is wrapped in try/catch:
 * private mode or blocked storage just means no persistence, never a crash.
 */
import { CONFIG } from './config';

export const SAVE_VERSION = 1;

export interface SaveData {
  v: number;
  best: number;
  settings: Record<string, boolean | number | string>;
}

const KEY = `${CONFIG.title.toLowerCase().replace(/\s+/g, '-')}.save`;

export const DEFAULT_SAVE: SaveData = { v: SAVE_VERSION, best: 0, settings: {} };

/** Bring an older save up to the current version. Add one `if (data.v === n)` block per bump. */
export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SAVE };
  const data = raw as Partial<SaveData>;
  const best = typeof data.best === 'number' && Number.isFinite(data.best) ? data.best : 0;
  const settings = data.settings && typeof data.settings === 'object' ? data.settings : {};
  return { v: SAVE_VERSION, best, settings };
}

export function loadSave(): SaveData {
  try {
    const text = window.localStorage.getItem(KEY);
    return text ? migrate(JSON.parse(text)) : { ...DEFAULT_SAVE };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function writeSave(data: SaveData): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...data, v: SAVE_VERSION }));
  } catch {
    /* storage unavailable: play on without persistence */
  }
}

export function recordBest(score: number): number {
  const save = loadSave();
  if (score > save.best) {
    save.best = score;
    writeSave(save);
  }
  return save.best;
}
