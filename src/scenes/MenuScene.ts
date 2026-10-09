import Phaser from 'phaser';
import { buildArt } from '../art';
import { CONFIG } from '../config';
import { bindInput } from '../input';
import { loadSave } from '../storage';
import { designCamera, gradientFill, label } from '../ui';

const L = CONFIG.layout;
const B = CONFIG.board;
const R = L.renderScale;
const PITCH = (L.width - 2 * L.sidePad) / B.cols;
const RIM_Y = L.vineY + B.rows * L.cell;

/** Title screen: the market at night, a charmed snake rising out of a basket with a stack of pots. */
export class MenuScene extends Phaser.Scene {
  private segs: Phaser.GameObjects.Image[] = [];
  private head!: Phaser.GameObjects.Image;
  private stack: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('menu');
  }

  create(): void {
    buildArt(this, PITCH, RIM_Y);
    designCamera(this);
    const { width, height } = L;
    this.add
      .image(0, 0, 'bg')
      .setOrigin(0)
      .setScale(1 / R);
    this.add.particles(0, 0, 'spark', {
      x: { min: 0, max: width },
      y: { min: 200, max: RIM_Y },
      lifespan: 5000,
      speedY: { min: -12, max: -4 },
      speedX: { min: -6, max: 6 },
      scale: { start: 0.2, end: 0.05 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xfff3a0, 0xb8ff9a, 0xffd0f0],
      frequency: 260,
      blendMode: Phaser.BlendModes.ADD,
    });

    const x = width / 2;
    this.add.image(x, RIM_Y, 'basketBack').setScale(1 / R);
    this.segs = Array.from({ length: 60 }, () =>
      this.add
        .image(x, RIM_Y, 'seg')
        .setScale(1 / R)
        .setTint(CONFIG.colors.snakeHeld),
    );
    this.head = this.add
      .image(x, RIM_Y, 'head')
      .setScale(1 / R)
      .setTint(CONFIG.colors.snakeHeld);
    this.stack = ['pot1', 'gold0', 'wild', 'pot2'].map((k) => this.add.image(x, RIM_Y, k).setScale(1 / R));
    this.add
      .image(x, RIM_Y - 6, 'basket')
      .setOrigin(0.5, 0)
      .setScale(1 / R);
    this.add.particles(x, RIM_Y + 10, 'note', {
      speedY: { min: -90, max: -60 },
      speedX: { min: -40, max: 40 },
      lifespan: 1400,
      scale: { start: 0.5, end: 0.25 },
      alpha: { start: 1, end: 0 },
      tint: [0xffe27a, 0xffffff, 0xffb3e6, 0x9be7ff],
      frequency: 260,
    });

    const title = label(this, x, 120, 'SNAKE\nSONG', 66, { stroke: 10, shadow: true }).setOrigin(0.5);
    title.setLineSpacing(-14);
    gradientFill(title, '#fff6c9', '#ff9a2e');
    this.tweens.add({
      targets: title,
      angle: { from: -2, to: 2 },
      yoyo: true,
      repeat: -1,
      duration: 1600,
      ease: 'Sine.easeInOut',
    });
    label(this, x, 214, `v${CONFIG.version}`, 12, { color: '#b9a8e6' }).setOrigin(0.5);
    label(
      this,
      x,
      246,
      'Hold a basket to charm its snake.\nIts pots rise. Line up 3 to pop them.\nGold pots blast a row · rainbow pots match all.',
      15,
      { color: '#efe6ff', align: 'center', stroke: 4 },
    )
      .setOrigin(0.5, 0)
      .setLineSpacing(6);

    const btnY = height - 78;
    const btn = this.add.graphics();
    btn.fillStyle(0xff9a2e, 1).fillRoundedRect(x - 120, btnY - 30, 240, 60, 30);
    btn.fillStyle(0xffffff, 0.25).fillRoundedRect(x - 112, btnY - 26, 224, 18, 9);
    btn.lineStyle(3, 0xfff1c2, 1).strokeRoundedRect(x - 120, btnY - 30, 240, 60, 30);
    const play = label(this, x, btnY, 'PLAY', 28, { stroke: 6 }).setOrigin(0.5);
    const best = loadSave().best;
    label(this, x, 352, best > 0 ? `BEST ${best}` : 'desktop: hold keys 1-5', 14, { color: '#e7c7a0' }).setOrigin(0.5);
    this.tweens.add({
      targets: [play],
      scale: { from: 1, to: 1.08 },
      yoyo: true,
      repeat: -1,
      duration: 600,
      ease: 'Sine.easeInOut',
    });

    const go = () => {
      this.cameras.main.fadeOut(200, 10, 4, 25);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('game'));
    };
    bindInput(this, { onTap: go, onAction: go });
  }

  update(time: number): void {
    const t = time / 1000;
    const x = L.width / 2;
    const lift = 1 + Math.sin(t * 1.3) * 0.6;
    const tailY = RIM_Y + L.basketHeight * 0.55;
    const headY = RIM_Y - lift * L.cell;
    const len = tailY - headY;
    const n = Math.ceil(len / CONFIG.art.segmentSpacing);
    this.segs.forEach((s, i) => {
      if (i > n) return void s.setVisible(false);
      const f = i / n;
      s.setVisible(true).setPosition(x + Math.sin(t * 6 - f * 5) * 7 * Math.sin(f * Math.PI), tailY - len * f);
    });
    this.head.setPosition(x, headY - 4);
    this.stack.forEach((p, i) =>
      p.setPosition(x + Math.sin(t * 6) * 1.5 * (1 + i * 0.3), headY - (i + 0.5) * L.cell + 6),
    );
  }
}
