import Phaser from 'phaser';
import { CONFIG } from '../config';
import { bindInput } from '../input';
import { loadSave } from '../storage';

const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create(): void {
    const { width, height } = CONFIG.layout;
    this.add
      .text(width / 2, height * 0.3, CONFIG.title.toUpperCase(), {
        fontFamily: FONT,
        fontSize: '40px',
        color: CONFIG.colors.text,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.3 + 40, `v${CONFIG.version}`, {
        fontFamily: FONT,
        fontSize: '13px',
        color: CONFIG.colors.textDim,
      })
      .setOrigin(0.5);
    this.add
      .text(
        width / 2,
        height * 0.42,
        "Hold a basket to play the flute.\nIts snake lifts the pots above it.\nLine up 3 of a colour to clear them.\nDon't let a lid land on a full basket.",
        { fontFamily: FONT, fontSize: '16px', color: CONFIG.colors.textDim, align: 'center', lineSpacing: 6 },
      )
      .setOrigin(0.5, 0);
    const play = this.add
      .text(width / 2, height * 0.68, 'TAP TO PLAY', {
        fontFamily: FONT,
        fontSize: '26px',
        color: CONFIG.colors.text,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: play, alpha: { from: 1, to: 0.35 }, duration: 650, yoyo: true, repeat: -1 });
    this.add
      .text(width / 2, height * 0.68 + 36, `BEST ${loadSave().best}`, {
        fontFamily: FONT,
        fontSize: '15px',
        color: CONFIG.colors.textDim,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height - CONFIG.layout.safeBottom - 10, 'desktop: hold keys 1-5', {
        fontFamily: FONT,
        fontSize: '11px',
        color: CONFIG.colors.textDim,
      })
      .setOrigin(0.5);
    bindInput(this, { onTap: () => this.scene.start('game'), onAction: () => this.scene.start('game') });
  }
}
