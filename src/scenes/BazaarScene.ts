import Phaser from 'phaser';
import { buildArt } from '../art';
import { Sound } from '../audio';
import { CONFIG } from '../config';
import {
  buy,
  CATALOG,
  equip,
  isNight,
  isTamed,
  owns,
  SNAKE_BLURBS,
  SNAKE_NAMES,
  tameThreshold,
  type Item,
} from '../meta';
import { SNAKE_KINDS } from '../model/game';
import { updateSave, writeSave, type SaveData } from '../storage';
import { button, designCamera, flowerPill, gradientFill, label, panel, snakeFace, type Button } from '../ui';

const L = CONFIG.layout;
const R = L.renderScale;
const TABS = ['pungi', 'theme', 'snakes'] as const;
type Tab = (typeof TABS)[number];
const TAB_NAMES: Record<Tab, string> = { pungi: 'FLUTES', theme: 'THEMES', snakes: 'SNAKES' };

/** The bazaar stall: spend flowers on pungi skins and themes, and see which snakes are tamed. */
export class BazaarScene extends Phaser.Scene {
  private save!: SaveData;
  private tab: Tab = 'pungi';
  private sfx = new Sound();
  private bg!: Phaser.GameObjects.Image;
  private wallet!: ReturnType<typeof flowerPill>;
  private tabButtons: Button[] = [];
  private rows: Phaser.GameObjects.GameObject[] = [];
  private rowButtons: Button[] = [];
  private toast: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('bazaar');
  }

  create(data: { tab?: Tab } = {}): void {
    this.save = updateSave((s) => ({ ...s, stats: { ...s.stats, bazaar: s.stats.bazaar + 1 } }));
    this.tab = data.tab && TABS.includes(data.tab) ? data.tab : 'pungi';
    buildArt(this);
    designCamera(this);
    this.sfx.setMuted(this.save.settings.muted === true);
    this.sfx.setSkin(this.save.pungi as never);
    this.bg = this.add
      .image(0, 0, `bg_${this.save.theme}`)
      .setOrigin(0)
      .setScale(1 / R);
    this.add.rectangle(L.width / 2, L.height / 2, L.width, L.height, 0x0c0420, 0.55);

    const title = label(this, L.width / 2, L.safeTop + 30, 'BAZAAR', 36, { stroke: 7, shadow: true }).setOrigin(0.5);
    gradientFill(title, '#fff6c9', '#ff9a2e');
    button(this, 52, L.safeTop + 30, 84, 40, 'BACK', () => this.leave(), { size: 15, fill: 0x5a3a8a });
    this.wallet = flowerPill(this, L.width - 62, L.safeTop + 30, 1);
    this.wallet.set(this.save.flowers);

    this.tabButtons = TABS.map((tab, i) =>
      button(this, 70 + i * 125, L.safeTop + 88, 112, 40, TAB_NAMES[tab], () => this.show(tab), {
        size: 15,
        fill: 0x5a3a8a,
      }),
    );
    this.show(this.tab);
    this.input.keyboard?.once('keydown-ESC', () => this.leave());
    this.cameras.main.fadeIn(200, 18, 8, 40);
  }

  private leave(): void {
    this.input.removeAllListeners();
    this.cameras.main.fadeOut(180, 18, 8, 40);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('menu'));
  }

  private show(tab: Tab): void {
    this.tab = tab;
    this.tabButtons.forEach((b, i) => b.setFill(TABS[i] === tab ? 0xff9a2e : 0x5a3a8a));
    for (const r of this.rows) r.destroy();
    for (const b of this.rowButtons) b.destroy();
    this.rows = [];
    this.rowButtons = [];
    if (tab === 'snakes') this.snakeRows();
    else this.itemRows(CATALOG.filter((i) => i.type === tab));
  }

  private rowPanel(y: number, h: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x1a0b2e, 0.72).fillRoundedRect(16, y - h / 2, L.width - 32, h, 18);
    g.lineStyle(1.5, 0xffd27a, 0.35).strokeRoundedRect(16, y - h / 2, L.width - 32, h, 18);
    this.rows.push(g);
  }

  private itemRows(items: Item[]): void {
    const top = L.safeTop + 150;
    const h = 86;
    items.forEach((item, i) => {
      const y = top + i * (h + 10);
      this.rowPanel(y, h);
      if (item.type === 'pungi') {
        this.rows.push(this.add.image(58, y, `pungi_${item.key}`).setScale(0.7 / R));
      } else {
        this.rows.push(this.add.image(62, y, `swatch_${item.key}`).setScale(0.62 / R));
      }
      this.rows.push(label(this, 108, y - 16, item.name, 17, { color: '#fff1d6', stroke: 4 }).setOrigin(0, 0.5));
      this.rows.push(label(this, 108, y + 8, item.blurb, 12, { color: '#d9ccff', stroke: 3 }).setOrigin(0, 0.5));
      const inUse = (item.type === 'pungi' ? this.save.pungi : this.save.theme) === item.key;
      const owned = owns(this.save, item.id);
      const bx = L.width - 70;
      if (inUse) {
        const b = button(this, bx, y + 14, 92, 36, 'IN USE', () => undefined, {
          size: 13,
          fill: 0x2e8b57,
          icon: 'check',
        });
        b.setEnabled(false);
        b.container.setAlpha(0.9);
        this.rowButtons.push(b);
      } else if (owned) {
        this.rowButtons.push(
          button(this, bx, y + 14, 92, 36, 'USE', () => this.use(item), { size: 14, fill: 0x2e8b57 }),
        );
      } else {
        const can = this.save.flowers >= item.price;
        const b = button(this, bx, y + 14, 92, 36, String(item.price), () => this.purchase(item), {
          size: 15,
          fill: can ? 0xff9a2e : 0x6a5a7a,
          icon: 'flower',
        });
        this.rowButtons.push(b);
      }
    });
  }

  private snakeRows(): void {
    const top = L.safeTop + 150;
    const h = 86;
    const night = isNightNow();
    SNAKE_KINDS.forEach((kind, i) => {
      const y = top + i * (h + 10);
      this.rowPanel(y, h);
      const count = this.save.tamed[kind] ?? 0;
      const need = tameThreshold(kind);
      const tamed = isTamed(this.save, kind);
      const face = snakeFace(this, 58, y + 16, kind, 0.95);
      if (!tamed && count === 0) face.each((o: Phaser.GameObjects.Image) => o.setTint(0x3a2a5a));
      this.rows.push(face);
      let name = SNAKE_NAMES[kind];
      if (!tamed && count === 0) name = '???';
      this.rows.push(label(this, 108, y - 20, name, 17, { color: '#fff1d6', stroke: 4 }).setOrigin(0, 0.5));
      const blurb = kind === 'moon' && !night ? `${SNAKE_BLURBS[kind]} (not now)` : SNAKE_BLURBS[kind];
      this.rows.push(label(this, 108, y + 2, blurb, 12, { color: '#d9ccff', stroke: 3 }).setOrigin(0, 0.5));
      const g = this.add.graphics();
      const bw = L.width - 108 - 32;
      g.fillStyle(0x0c0420, 0.7).fillRoundedRect(108, y + 16, bw, 12, 6);
      const f = Math.min(1, count / need);
      if (f > 0) g.fillStyle(tamed ? 0x7dfcb0 : 0xffd27a, 1).fillRoundedRect(108, y + 16, Math.max(12, bw * f), 12, 6);
      this.rows.push(g);
      const status = tamed ? 'TAMED' : `${count} / ${need} charmed`;
      this.rows.push(
        label(this, 108 + bw, y + 36, status, 11, { color: tamed ? '#7dfcb0' : '#e7c9ff', stroke: 3 }).setOrigin(
          1,
          0.5,
        ),
      );
    });
    this.rows.push(
      label(this, L.width / 2, L.height - L.safeBottom - 10, 'tamed snakes sway on the title screen', 12, {
        color: '#e7c9ff',
        stroke: 3,
      }).setOrigin(0.5, 1),
    );
  }

  private use(item: Item): void {
    this.save = equip(this.save, item.id);
    writeSave(this.save);
    this.apply(item);
    this.sfx.pop(1.2);
    this.show(this.tab);
  }

  private purchase(item: Item): void {
    const next = buy(this.save, item.id);
    if (!next) {
      this.say(`need ${item.price - this.save.flowers} more flowers`);
      this.cameras.main.shake(120, 0.004);
      return;
    }
    this.save = next;
    writeSave(this.save);
    this.wallet.set(this.save.flowers, true);
    this.apply(item);
    this.sfx.coins(5);
    this.say(`${item.name} is yours!`);
    this.show(this.tab);
  }

  private apply(item: Item): void {
    if (item.type === 'theme') this.bg.setTexture(`bg_${item.key}`);
    else {
      this.sfx.setSkin(item.key as never);
      this.sfx.charm(2);
      this.time.delayedCall(900, () => this.sfx.charm(null));
    }
  }

  private say(text: string): void {
    this.toast?.destroy();
    this.toast = label(this, L.width / 2, L.height - L.safeBottom - 40, text, 15, { color: '#ffe3c2', stroke: 4 })
      .setOrigin(0.5)
      .setDepth(5);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1400, duration: 400 });
  }
}

function isNightNow(): boolean {
  const flag = new URLSearchParams(window.location.search).get('night');
  if (flag === '1') return true;
  if (flag === '0') return false;
  return isNight(new Date().getHours(), CONFIG);
}

// panel() is used by the game-over card; keep the import live for the bazaar's future receipt popup.
void panel;
