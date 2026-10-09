/** Shared look for text and the design-size camera, so every scene reads as one game. */
import Phaser from 'phaser';
import { CONFIG } from './config';

export const FONT = '"Arial Rounded MT Bold", "Avenir Next", "Trebuchet MS", system-ui, sans-serif';
const R = CONFIG.layout.renderScale;

/** Work in design coordinates (390 x 844) on a canvas rendered at renderScale. */
export function designCamera(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(R).centerOn(CONFIG.layout.width / 2, CONFIG.layout.height / 2);
}

export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  opts: { color?: string; stroke?: number; shadow?: boolean; align?: string } = {},
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: 'bold',
    color: opts.color ?? CONFIG.colors.text,
    align: opts.align ?? 'center',
    resolution: R,
  });
  if (opts.stroke) t.setStroke('#1a0b2e', opts.stroke);
  if (opts.shadow) t.setShadow(0, Math.max(2, size / 12), 'rgba(0,0,0,0.55)', 0, true, true);
  return t;
}

/** Fill a text with a vertical gradient (titles, combo words). */
export function gradientFill(t: Phaser.GameObjects.Text, top: string, bottom: string): void {
  const g = t.context.createLinearGradient(0, 0, 0, t.height);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  t.setFill(g);
}
