/** Shared look for text, buttons and panels, and the design-size camera, so every scene reads as one game. */
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

export interface ButtonOpts {
  size?: number;
  fill?: number; // face colour
  depth?: number;
  textColor?: string;
  icon?: string; // texture drawn left of the text
}

export interface Button {
  container: Phaser.GameObjects.Container;
  text: Phaser.GameObjects.Text;
  setLabel(text: string): void;
  setEnabled(on: boolean): void;
  setFill(fill: number): void;
  destroy(): void;
}

/** A rounded, lit-from-above button at least 44 px tall. Fires on release inside it. */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  onTap: () => void,
  opts: ButtonOpts = {},
): Button {
  const fill = opts.fill ?? 0xff9a2e;
  const g = scene.add.graphics();
  const paint = (face: number, pressed: boolean) => {
    const dark = Phaser.Display.Color.IntegerToColor(face).darken(45).color;
    g.clear();
    g.fillStyle(dark, 1).fillRoundedRect(-w / 2, -h / 2 + (pressed ? 2 : 4), w, h, h / 2);
    g.fillStyle(face, 1).fillRoundedRect(-w / 2, -h / 2 + (pressed ? 2 : 0), w, h - 2, h / 2);
    g.fillStyle(0xffffff, 0.25).fillRoundedRect(-w / 2 + 10, -h / 2 + 4 + (pressed ? 2 : 0), w - 20, h * 0.3, h * 0.15);
    g.lineStyle(2, 0xfff1c2, 0.9).strokeRoundedRect(-w / 2, -h / 2 + (pressed ? 2 : 0), w, h - 2, h / 2);
  };
  paint(fill, false);
  const size = opts.size ?? Math.min(22, h * 0.46);
  const t = label(scene, 0, -1, text, size, {
    color: opts.textColor ?? '#ffffff',
    stroke: Math.max(3, size / 5),
  }).setOrigin(0.5);
  const parts: Phaser.GameObjects.GameObject[] = [g, t];
  if (opts.icon) {
    const icon = scene.add.image(0, -1, opts.icon).setScale(1 / R);
    const shift = (icon.displayWidth + 6) / 2;
    icon.setX(-t.width / 2 - shift + icon.displayWidth / 2 + 2);
    t.setX(shift - 2);
    parts.push(icon);
  }
  const container = scene.add.container(x, y, parts).setDepth(opts.depth ?? 0);
  // The face itself is the hit target. (Phaser orders overlapping hits by what was rendered, so an invisible
  // zone under a modal dim would never win; a drawn Graphics does.)
  const hitH = Math.max(h, 44);
  g.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -hitH / 2, w, hitH), Phaser.Geom.Rectangle.Contains);
  if (g.input) g.input.cursor = 'pointer';
  let enabled = true;
  let face = fill;
  let down = false;
  g.on('pointerdown', () => {
    if (!enabled) return;
    down = true;
    paint(face, true);
  });
  g.on('pointerout', () => {
    if (down) paint(face, false);
    down = false;
  });
  g.on('pointerup', () => {
    if (!enabled || !down) return;
    down = false;
    paint(face, false);
    onTap();
  });
  return {
    container,
    text: t,
    setLabel: (s) => t.setText(s),
    setEnabled: (on) => {
      enabled = on;
      container.setAlpha(on ? 1 : 0.5);
    },
    setFill: (f) => {
      face = f;
      paint(face, false);
    },
    destroy: () => container.destroy(),
  };
}

/** A translucent rounded panel with a thin gold edge. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, depth = 0, alpha = 0.97) {
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(0x2a1458, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, 26);
  g.lineStyle(4, 0xffc23d, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 26);
  g.lineStyle(1.5, 0xfff1c2, 0.5).strokeRoundedRect(x - w / 2 + 8, y - h / 2 + 8, w - 16, h - 16, 20);
  return g;
}

/** A pill showing a flower count (the wallet, or this run's haul). */
export function flowerPill(scene: Phaser.Scene, x: number, y: number, depth = 0, prefix = '') {
  const g = scene.add.graphics();
  const icon = scene.add.image(0, 0, 'flower').setScale(1 / R);
  const t = label(scene, 0, 0, '0', 15, { color: '#fff1d6', stroke: 4 }).setOrigin(0, 0.5);
  const c = scene.add.container(x, y, [g, icon, t]).setDepth(depth);
  let shown = -1;
  const draw = (n: number) => {
    const text = `${prefix}${n}`;
    t.setText(text);
    const w = 34 + t.width + 10;
    g.clear();
    g.fillStyle(0x1a0b2e, 0.6).fillRoundedRect(-w / 2, -14, w, 28, 14);
    g.lineStyle(1.5, 0xffd27a, 0.5).strokeRoundedRect(-w / 2, -14, w, 28, 14);
    icon.setX(-w / 2 + 17);
    t.setX(-w / 2 + 32);
  };
  draw(0);
  return {
    container: c,
    set(n: number, bump = false) {
      if (n === shown) return;
      shown = n;
      draw(n);
      if (bump)
        scene.tweens.add({ targets: icon, scale: { from: 1.6 / R, to: 1 / R }, duration: 260, ease: 'Back.easeOut' });
    },
    /** world position of the icon, for flowers flying in */
    iconAt(): { x: number; y: number } {
      return { x: c.x + icon.x, y: c.y };
    },
  };
}

/** A snake's face (hood, head, eyes) as one container, for the menu, the bazaar and the share card. */
export function snakeFace(scene: Phaser.Scene, x: number, y: number, kind: string, scale = 1) {
  const part = (key: string, px: number, py: number) => scene.add.image(px, py, key).setScale(1 / R);
  const hood = part(`hood_${kind}`, 0, -14).setOrigin(0.5, 0);
  const head = part(`head_${kind}`, 0, -20).setOrigin(0.5, 0);
  const eyes = [-1, 1].map((s) => part('eye', s * 8.5, -3));
  const pupils = [-1, 1].map((s) => part('pupil', s * 8.5, -2.5));
  const items: Phaser.GameObjects.GameObject[] = [hood, head, ...eyes, ...pupils];
  if (kind === 'sleepy') items.push(...[-1, 1].map((s) => part('eyelid_sleepy', s * 8.5, -7.5)));
  if (kind === 'king') items.push(part('crown', 0, -24).setOrigin(0.5, 1));
  return scene.add.container(x, y, items).setScale(scale);
}
