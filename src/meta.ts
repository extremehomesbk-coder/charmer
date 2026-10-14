/**
 * The meta game as pure functions over the save: flowers (the currency), taming snakes, the daily pouch, and
 * the bazaar catalogue. No Phaser, no DOM; src/storage.ts reads and writes the save, the scenes call these.
 */
import { CONFIG } from './config';
import { isNight, SNAKE_KINDS, type SnakeKind } from './model/game';
import type { SaveData } from './storage';

export { isNight };
export type PungiSkin = keyof typeof CONFIG.skins.pungi;
export type Theme = keyof typeof CONFIG.skins.themes;
export const PUNGI_SKINS = Object.keys(CONFIG.skins.pungi) as PungiSkin[];
export const THEMES = Object.keys(CONFIG.skins.themes) as Theme[];

export interface Item {
  id: string; // 'pungi:ivory', 'theme:noon'
  type: 'pungi' | 'theme';
  key: PungiSkin | Theme;
  name: string;
  blurb: string;
  price: number; // 0 = yours from the start
}

const PRICES: Record<string, number> = CONFIG.meta.prices;

export const CATALOG: Item[] = [
  ...PUNGI_SKINS.map<Item>((key) => ({
    id: `pungi:${key}`,
    type: 'pungi',
    key,
    name: CONFIG.skins.pungi[key].name,
    blurb: CONFIG.skins.pungi[key].blurb,
    price: PRICES[key] ?? 0,
  })),
  ...THEMES.map<Item>((key) => ({
    id: `theme:${key}`,
    type: 'theme',
    key,
    name: CONFIG.skins.themes[key].name,
    blurb: CONFIG.skins.themes[key].blurb,
    price: PRICES[key] ?? 0,
  })),
];

export const SNAKE_NAMES: Record<SnakeKind, string> = {
  green: 'Garden cobra',
  gold: 'Gilded cobra',
  sleepy: 'Dozy cobra',
  ruby: 'Ruby racer',
  moon: 'Moon cobra',
  king: 'King cobra',
};

export const SNAKE_BLURBS: Record<SnakeKind, string> = {
  green: 'steady and friendly',
  gold: 'slow to charm, worth 250',
  sleepy: 'slips back when the flute stops',
  ruby: 'quick up, quick down',
  moon: 'only comes out after dark',
  king: 'slow, heavy, worth 500',
};

export function owns(save: SaveData, id: string): boolean {
  return save.owned.includes(id) || CATALOG.find((i) => i.id === id)?.price === 0;
}

/** Buy and equip an item. null when it is already owned or the flowers are short. */
export function buy(save: SaveData, id: string): SaveData | null {
  const item = CATALOG.find((i) => i.id === id);
  if (!item || owns(save, id) || save.flowers < item.price) return null;
  const next: SaveData = { ...save, flowers: save.flowers - item.price, owned: [...save.owned, id] };
  return equip(next, id);
}

/** Put an owned item in use. */
export function equip(save: SaveData, id: string): SaveData {
  const item = CATALOG.find((i) => i.id === id);
  if (!item || !owns(save, id)) return save;
  return item.type === 'pungi' ? { ...save, pungi: item.key } : { ...save, theme: item.key };
}

export function tameThreshold(kind: SnakeKind): number {
  return CONFIG.meta.tame[kind];
}

export function isTamed(save: SaveData, kind: SnakeKind): boolean {
  return (save.tamed[kind] ?? 0) >= tameThreshold(kind);
}

export function tamedKinds(save: SaveData): SnakeKind[] {
  return SNAKE_KINDS.filter((k) => isTamed(save, k));
}

/** Count a charmed snake toward taming its breed. Returns the save and whether the breed was tamed just now. */
export function recordCharm(save: SaveData, kind: SnakeKind): { save: SaveData; tamedNow: boolean } {
  const before = isTamed(save, kind);
  const next: SaveData = { ...save, tamed: { ...save.tamed, [kind]: (save.tamed[kind] ?? 0) + 1 } };
  return { save: next, tamedNow: !before && isTamed(next, kind) };
}

export function bankFlowers(save: SaveData, flowers: number): SaveData {
  return { ...save, flowers: Math.max(0, save.flowers + flowers) };
}

/** Local calendar day as YYYY-MM-DD (the daily pouch follows the phone's clock). */
export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export interface DailyReward {
  save: SaveData;
  flowers: number;
  streak: number;
  rare: SnakeKind | null; // a breed tamed outright by a full streak
}

/** How many days in a row the pouch would stand at if claimed today (0 when today's is already taken). */
export function dailyStreakIfClaimed(save: SaveData, today: string): number {
  if (save.daily.last === today) return 0;
  return save.daily.last && daysBetween(save.daily.last, today) === 1 ? save.daily.streak + 1 : 1;
}

export function dailyReward(streak: number): number {
  const d = CONFIG.meta.daily;
  return Math.min(d.cap, d.base + d.step * (streak - 1));
}

/** Claim the daily pouch. null when today's is already taken. */
export function claimDaily(save: SaveData, today: string): DailyReward | null {
  const streak = dailyStreakIfClaimed(save, today);
  if (streak === 0) return null;
  const d = CONFIG.meta.daily;
  let flowers = dailyReward(streak);
  let rare: SnakeKind | null = null;
  let tamed = save.tamed;
  if (streak % d.streakDays === 0) {
    flowers += d.streakBonus;
    rare = 'ruby';
    tamed = { ...tamed, ruby: Math.max(tamed.ruby ?? 0, tameThreshold('ruby')) };
  }
  const next: SaveData = {
    ...save,
    flowers: save.flowers + flowers,
    tamed,
    daily: { last: today, streak },
  };
  return { save: next, flowers, streak, rare };
}

export function canContinue(save: SaveData, runFlowers: number, revived: boolean): boolean {
  return !revived && save.flowers + runFlowers >= CONFIG.meta.continuePrice;
}

/** Pay for a continue out of this run's flowers first, then the wallet. Returns the new wallet and run total. */
export function payContinue(save: SaveData, runFlowers: number): { save: SaveData; runFlowers: number } {
  const price = CONFIG.meta.continuePrice;
  const fromRun = Math.min(runFlowers, price);
  return { save: { ...save, flowers: save.flowers - (price - fromRun) }, runFlowers: runFlowers - fromRun };
}
