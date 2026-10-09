import Phaser from 'phaser';
import { CONFIG } from '../config';
import { bindInput, type Dir } from '../input';
import { recordBest } from '../storage';

const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

/**
 * Starter scene: a target you move with swipes/arrows and hit with a tap/space. Replace with the real game;
 * keep the shape: config in, input via bindInput, score to storage via recordBest.
 */
export class GameScene extends Phaser.Scene {
  private target!: Phaser.GameObjects.Arc;
  private scoreText!: Phaser.GameObjects.Text;
  private score = 0;

  constructor() {
    super('game');
  }

  create(): void {
    const { width, height, safeTop } = CONFIG.layout;
    this.score = 0;
    this.scoreText = this.add.text(16, safeTop, 'SCORE 0', {
      fontFamily: FONT,
      fontSize: '20px',
      color: CONFIG.colors.text,
      fontStyle: 'bold',
    });
    this.target = this.add.circle(width / 2, height / 2, CONFIG.example.targetRadius, CONFIG.colors.accent);
    bindInput(this, {
      onSwipe: (d) => this.move(d),
      onTap: (x, y) => this.hit(x, y),
      onAction: () => this.hit(this.target.x, this.target.y),
    });
  }

  private move(dir: Dir): void {
    const s = CONFIG.example.moveStep;
    const dx = dir === 'left' ? -s : dir === 'right' ? s : 0;
    const dy = dir === 'up' ? -s : dir === 'down' ? s : 0;
    const x = Phaser.Math.Clamp(this.target.x + dx, 40, CONFIG.layout.width - 40);
    const y = Phaser.Math.Clamp(this.target.y + dy, 80, CONFIG.layout.height - 80);
    this.tweens.add({ targets: this.target, x, y, duration: 120, ease: 'Quad.easeOut' });
  }

  private hit(x: number, y: number): void {
    const inside =
      Phaser.Math.Distance.Between(x, y, this.target.x, this.target.y) <= CONFIG.example.targetRadius * 1.5;
    if (!inside) return;
    this.score += CONFIG.example.pointsPerHit;
    const best = recordBest(this.score);
    this.scoreText.setText(`SCORE ${this.score}   BEST ${best}`);
    this.tweens.add({ targets: this.target, scale: { from: 1.4, to: 1 }, duration: 160, ease: 'Back.easeOut' });
  }
}
