import Phaser from 'phaser';
import { buildArt, vineCurve } from '../art';
import { CONFIG } from '../config';
import { loadSave } from '../storage';
import { designCamera, gradientFill, label } from '../ui';
import { POT_TOP, laneX } from './GameScene';

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

/** Title screen: dusk over the bazaar, a snake swaying up out of its pot to the pungi, two more peeking. */
export class MenuScene extends Phaser.Scene {
  private snakes: MenuSnake[] = [];
  private pungi!: Phaser.GameObjects.Image;

  constructor() {
    super('menu');
  }

  create(): void {
    if (new URLSearchParams(window.location.search).get('auto') === '1') {
      this.scene.start('game', { auto: true }); // ?auto=1 goes straight to the demo
      return;
    }
    buildArt(this);
    designCamera(this);
    const { width } = L;
    const cx = width / 2;
    const img = (x: number, y: number, key: string) => this.add.image(x, y, key).setScale(1 / R);
    img(0, 0, 'bg').setOrigin(0);
    this.add.particles(0, 0, 'spark', {
      x: { min: 0, max: width },
      y: { min: 300, max: L.rimY },
      lifespan: 6000,
      speedY: { min: -10, max: -3 },
      speedX: { min: -8, max: 8 },
      scale: { start: 0.25, end: 0.05 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xfff3a0, 0xffd27a, 0xb8ff9a],
      frequency: 300,
      blendMode: Phaser.BlendModes.ADD,
    });

    this.snakes = [];
    const pots: [number, string, boolean][] = [
      [1, 'gold', false],
      [2, 'green', true],
      [3, 'sleepy', false],
    ];
    for (const [lane, kind, hero] of pots) {
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
      const lids = kind === 'sleepy' ? [-1, 1].map((s) => part('eyelid_sleepy', s * 8.5, 10.5)) : [];
      const box = this.add.container(x, L.rimY, [hood, head, ...eyes, ...pupils, ...lids]);
      img(x, POT_TOP, `potFront_${kind}`).setOrigin(0.5, 0);
      this.snakes.push({ x, rope, box, hood, pupils, eyes, kind, hero, phase: lane * 1.7 });
    }
    img(0, L.vineY - 35, 'vine').setOrigin(0);
    for (const [lane, kind] of [
      [0, 'green'],
      [4, 'gold'],
    ] as const) {
      const x = laneX(lane);
      img(x, L.vineY - 35 + vineCurve(x) - 2, `bloom_${kind}`).setAngle(20);
    }
    this.pungi = img(cx, L.fluteY - 22, 'pungi').setOrigin(0.5, 0);
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

    const title = label(this, cx, 252, 'SNAKE\nSONG', 64, { stroke: 10, shadow: true }).setOrigin(0.5);
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

    const panel = this.add.graphics();
    panel.fillStyle(0x1a0b2e, 0.62).fillRoundedRect(22, 344, width - 44, 112, 18);
    panel.lineStyle(1.5, 0xffd27a, 0.5).strokeRoundedRect(22, 344, width - 44, 112, 18);
    const rules = [
      'Hold under a pot: the pungi charms its',
      'snake up to the vine and the pot is gone.',
      'Lids drop! A raised snake knocks them back.',
      'A lid that lands brings another pot.',
    ];
    rules.forEach((line, i) =>
      label(this, cx, 356 + i * 23, line, 15, { color: i === 2 ? '#bff6ff' : '#fff1d6', stroke: 4 }).setOrigin(0.5, 0),
    );

    const btnY = 506;
    const btn = this.add.graphics();
    btn.fillStyle(0x7a2e0e, 1).fillRoundedRect(cx - 110, btnY - 26, 220, 60, 30);
    btn.fillStyle(0xff9a2e, 1).fillRoundedRect(cx - 110, btnY - 30, 220, 58, 29);
    btn.fillStyle(0xffffff, 0.28).fillRoundedRect(cx - 100, btnY - 26, 200, 18, 9);
    btn.lineStyle(3, 0xfff1c2, 1).strokeRoundedRect(cx - 110, btnY - 30, 220, 58, 29);
    const play = label(this, cx, btnY - 1, 'PLAY', 30, { stroke: 6 }).setOrigin(0.5);
    this.tweens.add({
      targets: [play],
      scale: { from: 1, to: 1.08 },
      yoyo: true,
      repeat: -1,
      duration: 600,
      ease: 'Sine.easeInOut',
    });
    const best = loadSave().best;
    if (best > 0) label(this, cx, 318, `BEST ${best}`, 15, { color: '#ffe3a8', stroke: 4 }).setOrigin(0.5);
    const demo = label(this, cx, 560, 'watch a demo', 14, { color: '#e7c9ff', stroke: 4 })
      .setOrigin(0.5)
      .setPadding(30, 10, 30, 10);

    const go = (auto: boolean) => {
      this.input.removeAllListeners();
      this.cameras.main.fadeOut(200, 18, 8, 40);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('game', { auto }));
    };
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const onDemo = demo.getBounds().contains(p.worldX, p.worldY);
      go(onDemo);
    });
    this.input.keyboard?.once('keydown-SPACE', () => go(false));
    this.input.keyboard?.once('keydown-ENTER', () => go(false));
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
      s.hood.setScale((s.hero ? 1 : 0.4) / R, (s.hero ? 1 : 0.78) / R);
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
