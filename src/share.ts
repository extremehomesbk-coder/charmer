/**
 * The share card: a 720 x 1280 picture of a run (score, level, tamed snakes) drawn on a plain canvas from the
 * game's own textures, handed to the phone's share sheet when there is one, else saved as a PNG. No network:
 * the picture leaves only if the player sends it.
 */
import Phaser from 'phaser';
import { CONFIG } from './config';
import { SNAKE_NAMES, type Theme } from './meta';
import type { SnakeKind } from './model/game';

export interface ShareInfo {
  score: number;
  level: number;
  charmed: number;
  best: number;
  tamed: SnakeKind[];
  theme: Theme;
}

const W = 720;
const H = 1280;
const FONT = '"Arial Rounded MT Bold", "Avenir Next", "Trebuchet MS", system-ui, sans-serif';

function source(scene: Phaser.Scene, key: string): CanvasImageSource | null {
  const t = scene.textures.get(key);
  return t && key !== '__MISSING' ? (t.getSourceImage() as CanvasImageSource) : null;
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, fill: string, stroke = 0) {
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (stroke) {
    ctx.lineWidth = stroke;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a0b2e';
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}

export function buildShareCard(scene: Phaser.Scene, info: ShareInfo): HTMLCanvasElement {
  const look = CONFIG.skins.themes[info.theme] ?? CONFIG.skins.themes.dusk;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const bg = source(scene, `bg_${info.theme}`);
  if (bg) ctx.drawImage(bg, 0, 0, W, H);
  else {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    look.sky.forEach((c, i) => sky.addColorStop(i / (look.sky.length - 1), c));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
  }
  // a dark card over the middle
  ctx.fillStyle = 'rgba(26,11,46,0.72)';
  ctx.beginPath();
  ctx.roundRect(50, 150, W - 100, 900, 48);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffc23d';
  ctx.stroke();

  text(ctx, 'SNAKE SONG', W / 2, 240, 84, '#ffd27a', 14);
  text(ctx, 'I charmed', W / 2, 330, 34, '#fff1d6');
  text(ctx, `${info.charmed} snakes`, W / 2, 390, 60, '#ffffff', 10);
  text(ctx, 'SCORE', W / 2, 500, 30, '#e7c9ff');
  const g = ctx.createLinearGradient(0, 520, 0, 640);
  g.addColorStop(0, '#fff7d6');
  g.addColorStop(1, '#ffc23d');
  text(ctx, String(info.score), W / 2, 580, 130, g as unknown as string, 16);
  text(ctx, `level ${info.level}  ·  best ${info.best}`, W / 2, 680, 32, '#fff1d6');

  // tamed snakes
  const tamed = info.tamed;
  text(ctx, tamed.length ? 'MY SNAKES' : 'no snakes tamed yet', W / 2, 770, 28, '#e7c9ff');
  const pitch = Math.min(120, (W - 160) / Math.max(1, tamed.length));
  tamed.forEach((kind, i) => {
    const x = W / 2 + (i - (tamed.length - 1) / 2) * pitch;
    const y = 860;
    const hood = source(scene, `hood_${kind}`);
    const head = source(scene, `head_${kind}`);
    const eye = source(scene, 'eye');
    const pupil = source(scene, 'pupil');
    const s = 1.6;
    if (hood)
      ctx.drawImage(
        hood,
        x - (CONFIG.art.hoodWidth + 4) * s * 0.5,
        y - 30 * s,
        (CONFIG.art.hoodWidth + 4) * s,
        (CONFIG.art.hoodHeight + 4) * s,
      );
    if (head)
      ctx.drawImage(
        head,
        x - (CONFIG.art.headWidth + 4) * s * 0.5,
        y - 36 * s,
        (CONFIG.art.headWidth + 4) * s,
        (CONFIG.art.headHeight + 4) * s,
      );
    for (const sx of [-1, 1]) {
      if (eye) ctx.drawImage(eye, x + sx * 8.5 * s - 7 * s, y - 19 * s - 8 * s, 14 * s, 16 * s);
      if (pupil) ctx.drawImage(pupil, x + sx * 8.5 * s - 4 * s, y - 18.5 * s - 5 * s, 8 * s, 10 * s);
    }
    if (kind === 'king') {
      const crown = source(scene, 'crown');
      if (crown) ctx.drawImage(crown, x - 12 * s, y - 50 * s, 24 * s, 16 * s);
    }
    text(ctx, SNAKE_NAMES[kind].split(' ')[0], x, y + 44, 20, '#fff1d6');
  });

  text(ctx, 'hold a pot, charm the snake, dodge the lids', W / 2, 980, 26, '#ffe3c2');
  text(ctx, 'extremehomesbk-coder.github.io/charmer', W / 2, 1130, 30, '#ffffff', 8);
  return canvas;
}

/** Hand the card to the share sheet, or save it. */
export async function shareCard(canvas: HTMLCanvasElement, textLine: string): Promise<'shared' | 'saved' | 'failed'> {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) return 'failed';
  const file = new File([blob], 'snake-song.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: 'Snake Song', text: textLine });
      return 'shared';
    }
  } catch {
    return 'failed'; // the player closed the sheet
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'snake-song.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return 'saved';
  } catch {
    return 'failed';
  }
}
