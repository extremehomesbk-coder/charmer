import Phaser from 'phaser';
import { buildArt, vineCurve } from '../art';
import { Sound } from '../audio';
import { CONFIG } from '../config';
import { claimDaily, dailyReward, dailyStreakIfClaimed, dayKey, tamedKinds, type Theme } from '../meta';
import type { SnakeKind } from '../model/game';
import { loadSave, writeSave, type SaveData } from '../storage';
import { button, designCamera, flowerPill, gradientFill, label, panel } from '../ui';
import { POT_TOP, laneX, weather } from './GameScene';

const L = CONFIG.layout;
const A = CONFIG.art;
const R = L.renderScale;
const TAU = Math.PI * 2;
const POINTS = 30;

interface MenuSnake {
  x: number;
  rope: Phaser.GameObjects.Rope;
  box: Phaser.GameObjects.Container;
  hood: Phaser.GameObjects.Image;
  pupils: Phaser.GameObjects.Image[];
  eyes: Phaser.GameObjects.Image[];
  kind: string;
  hero: boolean;
  phase: number;
}

/**
 * Title screen: the bazaar at dusk (or the theme in use), the tamed snakes swaying out of their pots, the
 * wallet, the daily pouch, and the way into the game and the bazaar.
 */
export class MenuScene extends Phaser.Scene {
  private snakes: MenuSnake[] = [];
  private pungi!: Phaser.GameObjects.Image;
  private save!: SaveData;
  private wallet!: ReturnType<typeof flowerPill>;
  private sfx = new Sound();

  constructor() {
    super('menu');
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auto') === '1') {
      this.scene.start('game', { auto: true }); // ?auto=1 goes straight to the demo
      return;
    }
    this.save = loadSave();
    this.sfx.setMuted(this.save.settings.muted === true);
    buildArt(this);
    designCamera(this);
    const { width } = L;
    const cx = width / 2;
    const img = (x: number, y: number, key: string) => this.add.image(x, y, key).setScale(1 / R);
    const theme = this.save.theme as Theme;
    img(0, 0, `bg_${theme}`).setOrigin(0);
    weather(this, theme, 1);

    // tamed snakes on the rug (the three starter breeds until any is tamed)
    this.snakes = [];
    const tamed = tamedKinds(this.save);
    const shown: SnakeKind[] = tamed.length ? tamed.slice(0, 5) : ['gold', 'green', 'sleepy'];
    const first = Math.floor((5 - shown.length) / 2);
    const heroIdx = Math.floor(shown.length / 2);
    shown.forEach((kind, i) => {
      const lane = first + i;
      const hero = i === heroIdx;
      const x = laneX(lane);
      img(x, L.rimY + 78, 'potShadow');
      img(x, POT_TOP, `potBack_${kind}`).setOrigin(0.5, 0);
      const pts = Array.from({ length: POINTS }, (_, k) => ({ x: x * R, y: (L.rimY + k) * R }));
      const rope = this.add.rope(0, 0, `body_${kind}`, undefined, pts, false).setScale(1 / R);
      const part = (key: string, px: number, py: number) => this.add.image(px, py, key).setScale(1 / R);
      const hood = part(`hood_${kind}`, 0, 4).setOrigin(0.5, 0);
      const head = part(`head_${kind}`, 0, -2).setOrigin(0.5, 0);
      const eyes = [-1, 1].map((s) => part('eye', s * 8.5, 15));
      const pupils = [-1, 1].map((s) => part('pupil', s * 8.5, 15.5));
      const extras: Phaser.GameObjects.Image[] = [];
      if (kind === 'sleepy') extras.push(...[-1, 1].map((s) => part('eyelid_sleepy', s * 8.5, 10.5)));
      if (kind === 'king') extras.push(part('crown', 0, -2).setOrigin(0.5, 1));
      const box = this.add.container(x, L.rimY, [hood, head, ...eyes, ...pupils, ...extras]);
      img(x, POT_TOP, `potFront_${kind}`).setOrigin(0.5, 0);
      this.snakes.push({ x, rope, box, hood, pupils, eyes, kind, hero, phase: lane * 1.7 });
    });
    img(0, L.vineY - 35, 'vine').setOrigin(0);
    for (const [lane, kind] of [
      [0, 'green'],
      [4, 'gold'],
    ] as const) {
      const x = laneX(lane);
      img(x, L.vineY - 35 + vineCurve(x) - 2, `bloom_${kind}`).setAngle(20);
    }
    this.pungi = img(cx, L.fluteY - 22, `pungi_${this.save.pungi}`).setOrigin(0.5, 0);
    this.add.particles(0, 0, 'note', {
      x: { min: cx - 6, max: cx + 6 },
      y: L.fluteY - 18,
      speedY: { min: -110, max: -70 },
      speedX: { min: -30, max: 30 },
      lifespan: 1300,
      scale: { start: 0.55, end: 0.3 },
      alpha: { start: 1, end: 0 },
      rotate: { min: -25, max: 25 },
      tint: [0xffe27a, 0xffffff, 0xffb3e6, 0x9be7ff],
      frequency: 220,
    });

    // top bar: wallet, streak
    this.wallet = flowerPill(this, 60, L.safeTop + 18, 2);
    this.wallet.set(this.save.flowers);
    if (this.save.daily.streak > 0) {
      const streak = label(this, width - 16, L.safeTop + 18, `DAY ${this.save.daily.streak} STREAK`, 12, {
        color: '#ffe3a8',
        stroke: 4,
      }).setOrigin(1, 0.5);
      streak.setDepth(2);
    }

    const title = label(this, cx, 232, 'SNAKE\nSONG', 64, { stroke: 10, shadow: true }).setOrigin(0.5);
    title.setLineSpacing(-16);
    gradientFill(title, '#fff6c9', '#ff9a2e');
    this.tweens.add({
      targets: title,
      angle: { from: -2, to: 2 },
      yoyo: true,
      repeat: -1,
      duration: 1600,
      ease: 'Sine.easeInOut',
    });
    const best = this.save.best;
    if (best > 0) label(this, cx, 300, `BEST ${best}`, 15, { color: '#ffe3a8', stroke: 4 }).setOrigin(0.5);

    const pan = this.add.graphics();
    pan.fillStyle(0x1a0b2e, 0.62).fillRoundedRect(22, 322, width - 44, 92, 18);
    pan.lineStyle(1.5, 0xffd27a, 0.5).strokeRoundedRect(22, 322, width - 44, 92, 18);
    const rules = [
      'Hold under a pot: the pungi charms its snake up',
      'to the vine. Lids drop! A raised snake knocks',
      'them back. A lid that lands brings another pot.',
    ];
    rules.forEach((line, i) =>
      label(this, cx, 334 + i * 24, line, 14, { color: i === 1 ? '#bff6ff' : '#fff1d6', stroke: 4 }).setOrigin(0.5, 0),
    );

    button(this, cx, 466, 220, 58, 'PLAY', () => this.go(false), { size: 30 });
    button(this, cx - 78, 530, 140, 46, 'BAZAAR', () => this.bazaar('pungi'), {
      size: 17,
      fill: 0x5a3a8a,
      icon: 'flower',
    });
    button(this, cx + 78, 530, 140, 46, 'SNAKES', () => this.bazaar('snakes'), { size: 17, fill: 0x5a3a8a });
    const demo = label(this, cx, 584, 'watch a demo', 14, { color: '#e7c9ff', stroke: 4 })
      .setOrigin(0.5)
      .setPadding(30, 10, 30, 10)
      .setInteractive({ useHandCursor: true });
    demo.on('pointerup', () => this.go(true));
    this.input.keyboard?.once('keydown-SPACE', () => this.go(false));
    this.input.keyboard?.once('keydown-ENTER', () => this.go(false));

    if (params.get('stats') === '1') {
      const s = this.save.stats;
      label(
        this,
        cx,
        L.height - L.safeBottom - 4,
        `runs ${s.runs} · continue offers ${s.offers} · taken ${s.continues} · bazaar visits ${s.bazaar}`,
        11,
        { color: '#e7c9ff', stroke: 3 },
      ).setOrigin(0.5, 1);
    }

    const streakIf = dailyStreakIfClaimed(this.save, dayKey(new Date()));
    if (streakIf > 0) this.time.delayedCall(500, () => this.dailyPouch(streakIf));
    this.cameras.main.fadeIn(200, 18, 8, 40);
  }

  private go(auto: boolean): void {
    this.input.removeAllListeners();
    this.cameras.main.fadeOut(200, 18, 8, 40);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('game', { auto }));
  }

  private bazaar(tab: 'pungi' | 'theme' | 'snakes'): void {
    this.input.removeAllListeners();
    this.cameras.main.fadeOut(180, 18, 8, 40);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('bazaar', { tab }));
  }

  /** The daily pouch: a popup with today's flowers, claimed with one tap. */
  private dailyPouch(streak: number): void {
    const cx = L.width / 2;
    const cy = 430;
    const depth = 10;
    const dim = this.add
      .rectangle(cx, L.height / 2, L.width, L.height, 0x0c0420, 0.6)
      .setDepth(depth)
      .setInteractive();
    const card = panel(this, cx, cy, 300, 320, depth + 1);
    const parts: Phaser.GameObjects.GameObject[] = [dim, card];
    const t = label(this, cx, cy - 122, 'DAILY POUCH', 28, { stroke: 6, shadow: true })
      .setOrigin(0.5)
      .setDepth(depth + 2);
    gradientFill(t, '#fff6c9', '#ff9a2e');
    const pouch = this.add
      .image(cx, cy - 40, 'pouch')
      .setScale(1.3 / R)
      .setDepth(depth + 2);
    this.tweens.add({
      targets: pouch,
      angle: { from: -6, to: 6 },
      yoyo: true,
      repeat: -1,
      duration: 500,
      ease: 'Sine.easeInOut',
    });
    const d = CONFIG.meta.daily;
    const flowers = dailyReward(streak) + (streak % d.streakDays === 0 ? d.streakBonus : 0);
    const day = label(this, cx, cy + 22, `day ${streak} of ${d.streakDays}`, 15, { color: '#e7c9ff', stroke: 4 })
      .setOrigin(0.5)
      .setDepth(depth + 2);
    const amount = label(this, cx + 10, cy + 54, `+${flowers}`, 30, { stroke: 6 })
      .setOrigin(0.5)
      .setDepth(depth + 2);
    gradientFill(amount, '#fff7d6', '#ffc23d');
    const icon = this.add
      .image(cx - amount.width / 2 - 8, cy + 54, 'flower')
      .setScale(1.1 / R)
      .setDepth(depth + 2);
    const note = label(
      this,
      cx,
      cy + 88,
      streak % d.streakDays === 0
        ? 'A FULL WEEK: a ruby racer joins you!'
        : `come back tomorrow for +${dailyReward(streak + 1)}`,
      12,
      { color: '#ffe3c2', stroke: 3 },
    )
      .setOrigin(0.5)
      .setDepth(depth + 2);
    parts.push(t, pouch, day, amount, icon, note);
    const claim = button(
      this,
      cx,
      cy + 130,
      180,
      48,
      'CLAIM',
      () => {
        const reward = claimDaily(this.save, dayKey(new Date()));
        if (!reward) return;
        this.save = reward.save;
        writeSave(this.save);
        claim.setEnabled(false);
        dim.disableInteractive(); // taps pass through while the pouch fades
        this.sfx.coins(6);
        // flowers fly from the pouch to the wallet
        const target = this.wallet.iconAt();
        for (let i = 0; i < Math.min(8, Math.ceil(reward.flowers / 5)); i++) {
          const f = this.add
            .image(pouch.x + Phaser.Math.Between(-20, 20), pouch.y, 'flower')
            .setScale(1 / R)
            .setDepth(depth + 3);
          this.tweens.add({
            targets: f,
            x: target.x,
            y: target.y,
            scale: 0.5 / R,
            delay: i * 60,
            duration: 550,
            ease: 'Cubic.easeIn',
            onComplete: () => {
              f.destroy();
              this.wallet.set(this.save.flowers, true);
            },
          });
        }
        this.time.delayedCall(700, () => {
          this.tweens.add({
            targets: parts,
            alpha: 0,
            duration: 250,
            onComplete: () => {
              parts.forEach((p) => p.destroy());
              claim.destroy();
              if (reward.rare) this.scene.restart(); // the new snake takes its place on the rug
            },
          });
        });
      },
      { size: 22, depth: depth + 2 },
    );
  }

  update(time: number): void {
    const t = time / 1000;
    for (const s of this.snakes) {
      const h = s.hero ? 0.15 + Math.sin(t * 0.9) * 0.025 : 0;
      const top = s.hero
        ? L.rimY - h * (L.rimY - L.lidTop - L.lidHeight)
        : L.rimY - L.headPeek + Math.sin(t * 2 + s.phase) * 2;
      const tailY = L.rimY + 40;
      const len = tailY - top - 22;
      const amp = s.hero ? 9 : 2;
      const w = t * 1.9 * TAU * (s.hero ? 1 : 0.5) + s.phase;
      const sway = (u: number) => amp * Math.sin(w - u * 3.2) * Math.pow(u, 1.3);
      const pts = s.rope.points as { x: number; y: number }[];
      for (let j = 0; j < POINTS; j++) {
        const u = 1 - j / (POINTS - 1);
        pts[j] = { x: (s.x + sway(u)) * R, y: (tailY - u * len) * R };
      }
      const n = Phaser.Math.Clamp(Math.round(len / 4) * 4, 8, A.bodyLength);
      const tex = this.textures.get(`body_${s.kind}`);
      if (!tex.has(`L${n}`)) tex.add(`L${n}`, 0, 0, 0, A.bodyWidth * R, n * R);
      s.rope.setFrame(`L${n}`);
      s.rope.setPoints(pts);
      const slope = (sway(1) - sway(0.94)) / (0.06 * len);
      s.box.setPosition(s.x + sway(1), top).setRotation(Math.atan(slope) * 0.6);
      const big = s.kind === 'king' ? 1.15 : 1;
      s.hood.setScale(((s.hero ? 1 : 0.4) * big) / R, ((s.hero ? 1 : 0.78) * big) / R);
      const blink = Math.sin(t * 1.3 + s.phase * 3) > 0.985 ? 0.12 : 1;
      s.eyes.forEach((e) => e.setScale(1 / R, blink / R));
      s.pupils.forEach((p, i) =>
        p
          .setPosition((i ? 8.5 : -8.5) + (s.hero ? 0 : Math.sign(laneX(2) - s.x) * 2), s.hero ? 13.5 : 15.5)
          .setScale(1 / R, blink / R),
      );
    }
    this.pungi.setY(L.fluteY - 22 + Math.sin(t * 9) * 1.5).setRotation(Math.sin(t * 5) * 0.08);
  }
}
