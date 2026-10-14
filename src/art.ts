/**
 * Every texture in the game, painted once at start-up with the canvas 2D API (gradients, highlights,
 * patterns): no image files, nothing third-party. Textures are drawn at CONFIG.layout.renderScale so they stay
 * crisp on a phone; sprites show them at 1 / renderScale. Shape coordinates below are art, not tuning.
 */
import Phaser from 'phaser';
import { CONFIG } from './config';
import { PUNGI_SKINS, THEMES, type PungiSkin, type Theme } from './meta';
import { SNAKE_KINDS, type SnakeKind } from './model/game';

const R = CONFIG.layout.renderScale;
const L = CONFIG.layout;
const A = CONFIG.art;
const C = CONFIG.colors;
const TAU = Math.PI * 2;

type Ctx = CanvasRenderingContext2D;

export const KINDS: SnakeKind[] = SNAKE_KINDS;

/** [back, belly, pattern] colours of each snake. */
export const SKIN: Record<SnakeKind, number[]> = {
  green: C.green,
  gold: C.goldSkin,
  sleepy: C.sleepy,
  ruby: C.ruby,
  moon: C.moon,
  king: C.king,
};

type ThemeLook = (typeof CONFIG.skins.themes)[Theme];
type PungiLook = (typeof CONFIG.skins.pungi)[PungiSkin];

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, Math.ceil(w * R), Math.ceil(h * R));
  if (!t) return;
  const ctx = t.getContext();
  ctx.save();
  ctx.scale(R, R);
  draw(ctx);
  ctx.restore();
  t.refresh();
}

export function hex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

/** Mix a colour toward white (amt > 0) or black (amt < 0). */
export function shade(c: number, amt: number, alpha = 1): string {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  const t = amt > 0 ? 255 : 0;
  const k = Math.abs(amt);
  const mix = (v: number) => Math.round(v + (t - v) * k);
  return `rgba(${mix(r)},${mix(g)},${mix(b)},${alpha})`;
}

/** Tiny seeded random for decorative scatter, so the art is identical on every load. */
function decoRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function glow(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

// ---------------------------------------------------------------- backdrop

function onionDome(ctx: Ctx, cx: number, y: number, r: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.85, y);
  ctx.bezierCurveTo(cx - r * 1.3, y - h * 0.45, cx - r * 0.25, y - h * 0.68, cx, y - h);
  ctx.bezierCurveTo(cx + r * 0.25, y - h * 0.68, cx + r * 1.3, y - h * 0.45, cx + r * 0.85, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - 0.8, y - h - 9, 1.6, 10);
  ctx.beginPath();
  ctx.arc(cx, y - h - 10, 2, 0, TAU);
  ctx.fill();
}

function arch(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + w * 0.6);
  ctx.quadraticCurveTo(x, y, x + w / 2, y - w * 0.15);
  ctx.quadraticCurveTo(x + w, y, x + w, y + w * 0.6);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
}

/** A row of domed buildings and minarets standing on baseY, with some windows lit. */
function skyline(ctx: Ctx, baseY: number, color: string, lit: number, seed: number, scale: number): void {
  const rnd = decoRand(seed);
  const windows: [number, number, number, number][] = [];
  let x = -14;
  ctx.fillStyle = color;
  while (x < L.width + 14) {
    const kind = rnd();
    const w = (34 + rnd() * 46) * scale;
    const h = (34 + rnd() * 64) * scale;
    const top = baseY - h;
    if (kind < 0.18) {
      // minaret
      const mw = 11 * scale;
      const mh = h + 70 * scale;
      ctx.fillRect(x, baseY - mh, mw, mh + 300);
      ctx.fillRect(x - 3 * scale, baseY - mh * 0.72, mw + 6 * scale, 4 * scale);
      onionDome(ctx, x + mw / 2, baseY - mh, mw * 0.65, 16 * scale);
      windows.push([x + mw / 2 - 2 * scale, baseY - mh * 0.55, 4 * scale, 7 * scale]);
      x += mw + 6 + rnd() * 10;
      continue;
    }
    ctx.fillRect(x, top, w, h + 300);
    if (kind < 0.62) onionDome(ctx, x + w / 2, top + 1, w * 0.36, w * 0.5);
    else if (kind < 0.8) {
      for (let cx = x; cx < x + w - 3; cx += 7 * scale) ctx.fillRect(cx, top - 4 * scale, 4 * scale, 5 * scale);
    } else {
      ctx.beginPath();
      ctx.ellipse(x + w / 2, top + 1, w * 0.42, w * 0.22, 0, Math.PI, 0);
      ctx.fill();
    }
    const cols = Math.max(1, Math.floor(w / (13 * scale)));
    const rows = Math.max(1, Math.floor(h / (22 * scale)));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rnd() > lit) continue;
        const wx = x + ((c + 0.5) * w) / cols - 2.5 * scale;
        windows.push([wx, top + 10 * scale + r * 22 * scale, 5 * scale, 9 * scale]);
      }
    }
    x += w + rnd() * 4;
  }
  for (const [wx, wy, ww, wh] of windows) {
    glow(ctx, wx + ww / 2, wy + wh / 2, ww * 2.4, 'rgba(255,190,90,0.35)');
    ctx.fillStyle = '#ffd27a';
    arch(ctx, wx, wy, ww, wh);
  }
}

function palm(ctx: Ctx, x: number, baseY: number, h: number, lean: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * 0.2, baseY - h * 0.6, x + lean, baseY - h);
  ctx.stroke();
  const tx = x + lean;
  const ty = baseY - h;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI + (i / 6) * Math.PI + (i % 2 ? 0.15 : -0.1);
    const len = 30 + (i % 3) * 6;
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.55 + 12;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.5, ty + Math.sin(a) * len * 0.6 - 10, ex, ey);
    ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.55, ty + Math.sin(a) * len * 0.5 - 4, tx, ty + 2);
    ctx.fill();
  }
}

/** A string of paper lanterns sagging between two points. */
function lanternString(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, sag: number, seed: number): void {
  const rnd = decoRand(seed);
  const at = (t: number) => {
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t + sag * 4 * t * (1 - t);
    return [x, y];
  };
  ctx.strokeStyle = 'rgba(30,12,40,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 30; i++) {
    const [x, y] = at(i / 30);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  const colors = ['#ff6b4a', '#ffb347', '#ff4f8b', '#4fd1c5', '#ffd166'];
  for (let t = 0.08; t < 0.95; t += 0.11 + rnd() * 0.04) {
    const [x, y] = at(t);
    const c = colors[Math.floor(rnd() * colors.length)];
    glow(ctx, x, y + 9, 18, 'rgba(255,170,90,0.35)');
    ctx.fillStyle = 'rgba(30,12,40,0.9)';
    ctx.fillRect(x - 0.5, y, 1, 4);
    ellipse(ctx, x, y + 9, 4.5, 6, c);
    ellipse(ctx, x - 1.3, y + 7.5, 1.5, 3, 'rgba(255,255,255,0.5)');
    ctx.fillStyle = 'rgba(40,16,30,0.9)';
    ctx.fillRect(x - 2.5, y + 2.6, 5, 1.6);
    ctx.fillRect(x - 2.5, y + 14.2, 5, 1.6);
  }
}

function moonDisc(ctx: Ctx, mx: number, my: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  glow(ctx, mx, my, 170, 'rgba(255,200,150,0.22)');
  glow(ctx, mx, my, 70, 'rgba(255,230,190,0.35)');
  const mg = ctx.createRadialGradient(mx - 12, my - 12, 4, mx, my, 40);
  mg.addColorStop(0, '#fffbea');
  mg.addColorStop(0.7, '#ffe6b5');
  mg.addColorStop(1, '#f4c48e');
  ellipse(ctx, mx, my, 38, 38, mg);
  for (const [cx, cy, cr] of [
    [-12, -8, 7],
    [10, 6, 9],
    [-4, 16, 5],
    [14, -14, 4],
    [-18, 10, 3.5],
  ]) {
    ellipse(ctx, mx + cx, my + cy, cr, cr, 'rgba(214,160,110,0.32)');
    ellipse(ctx, mx + cx + 0.8, my + cy + 0.8, cr * 0.7, cr * 0.7, 'rgba(255,240,210,0.25)');
  }
  ctx.restore();
}

function sunDisc(ctx: Ctx, sx: number, sy: number): void {
  glow(ctx, sx, sy, 230, 'rgba(255,245,200,0.35)');
  glow(ctx, sx, sy, 90, 'rgba(255,255,230,0.6)');
  const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, 30);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.6, '#fff6c8');
  g.addColorStop(1, '#ffd36b');
  ellipse(ctx, sx, sy, 30, 30, g);
}

function cloudBank(ctx: Ctx, y: number, seed: number, dark: string, light: string): void {
  const rnd = decoRand(seed);
  for (let i = 0; i < 9; i++) {
    const x = -20 + rnd() * (L.width + 40);
    const w = 70 + rnd() * 90;
    const h = 16 + rnd() * 14;
    const cy = y + (rnd() - 0.5) * 60;
    ctx.save();
    ctx.globalAlpha = 0.55 + rnd() * 0.3;
    ellipse(ctx, x, cy, w, h, dark);
    ellipse(ctx, x - w * 0.2, cy - h * 0.45, w * 0.45, h * 0.6, dark);
    ellipse(ctx, x + w * 0.25, cy - h * 0.35, w * 0.4, h * 0.55, dark);
    ctx.globalAlpha = 0.25;
    ellipse(ctx, x - w * 0.1, cy - h * 0.55, w * 0.7, h * 0.3, light);
    ctx.restore();
  }
}

/** One painted backdrop per theme (CONFIG.skins.themes): sky, light, skyline, terrace wall and rug. */
function background(scene: Phaser.Scene, theme: Theme, look: ThemeLook): void {
  tex(scene, `bg_${theme}`, L.width, L.height, (ctx) => {
    const W = L.width;
    const H = L.height;
    const sky = ctx.createLinearGradient(0, 0, 0, 640);
    look.sky.forEach((c, i) => sky.addColorStop([0, 0.3, 0.58, 0.8, 1][i], c));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    if (look.stars) {
      const rnd = decoRand(11);
      for (let i = 0; i < 170; i++) {
        const x = rnd() * W;
        const y = rnd() * 430;
        const r = rnd() * 1.1 + 0.25;
        ctx.globalAlpha = Math.max(0, 1 - y / 470) * (0.35 + rnd() * 0.65);
        ellipse(ctx, x, y, r, r, '#ffffff');
      }
      ctx.globalAlpha = 1;
    }
    if (look.light === 'moon') moonDisc(ctx, 92, 300, 1);
    else if (look.light === 'sun') sunDisc(ctx, 300, 150);
    else {
      moonDisc(ctx, 92, 300, 0.45);
      cloudBank(ctx, 250, 21, look.skyline[0], '#9fb6c9');
      cloudBank(ctx, 380, 33, look.skyline[1], '#7f97ab');
    }

    lanternString(ctx, -10, 452, 190, 470, 26, 3);
    lanternString(ctx, 170, 470, W + 10, 440, 30, 5);
    const lit = look.light === 'sun' ? 0 : 0.25;
    skyline(ctx, 560, look.skyline[0], lit, 4, 0.8);
    palm(ctx, 26, 600, 90, 18, look.palm);
    palm(ctx, 360, 600, 104, -22, look.palm);
    skyline(ctx, 612, look.skyline[1], lit * 0.8, 9, 1.05);

    // terrace wall
    const wallTop = 606;
    const wg = ctx.createLinearGradient(0, wallTop, 0, 712);
    wg.addColorStop(0, look.wall[0]);
    wg.addColorStop(1, look.wall[1]);
    ctx.fillStyle = wg;
    ctx.fillRect(0, wallTop, W, 110);
    ctx.fillStyle = 'rgba(40,20,30,0.45)';
    for (let x = 8; x < W; x += 39) arch(ctx, x, wallTop + 22, 24, 80);
    ctx.fillStyle = 'rgba(255,214,150,0.18)';
    for (let x = 8; x < W; x += 39) ctx.fillRect(x - 3, wallTop + 22, 1.5, 80);
    const cap = ctx.createLinearGradient(0, wallTop - 6, 0, wallTop + 8);
    cap.addColorStop(0, look.cap[0]);
    cap.addColorStop(1, look.cap[1]);
    ctx.fillStyle = cap;
    ctx.fillRect(0, wallTop - 6, W, 14);
    ctx.fillStyle = 'rgba(60,20,20,0.35)';
    ctx.fillRect(0, wallTop + 8, W, 3);

    // the rug
    const rugTop = 712;
    const rg = ctx.createLinearGradient(0, rugTop, 0, H);
    rg.addColorStop(0, look.rug[0]);
    rg.addColorStop(1, look.rug[1]);
    ctx.fillStyle = rg;
    ctx.fillRect(0, rugTop, W, H - rugTop);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, rugTop, W, 4);
    const band = (y: number, h: number) => {
      ctx.fillStyle = look.bands[0];
      ctx.fillRect(0, y, W, h);
      ctx.fillStyle = look.bands[1];
      for (let x = 0; x < W + 12; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, y + h / 2);
        ctx.lineTo(x + 6, y + 1.5);
        ctx.lineTo(x + 12, y + h / 2);
        ctx.lineTo(x + 6, y + h - 1.5);
        ctx.closePath();
        ctx.fill();
      }
      for (let x = 6; x < W + 12; x += 12) ellipse(ctx, x, y + h / 2, 1.2, 1.2, 'rgba(255,240,200,0.9)');
    };
    band(rugTop + 10, 11);
    band(H - 26, 11);
    ctx.fillStyle = 'rgba(30,8,20,0.35)';
    for (let y = rugTop + 34; y < H - 34; y += 22) {
      for (let x = ((y / 22) % 2) * 15; x < W + 15; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, y - 7);
        ctx.lineTo(x + 7, y);
        ctx.lineTo(x, y + 7);
        ctx.lineTo(x - 7, y);
        ctx.closePath();
        ctx.fill();
        ellipse(ctx, x, y, 2, 2, 'rgba(240,170,80,0.55)');
      }
    }
    ctx.strokeStyle = 'rgba(255,230,180,0.75)';
    ctx.lineWidth = 1;
    for (let x = 3; x < W; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, rugTop + 1);
      ctx.lineTo(x + 0.5, rugTop + 7);
      ctx.stroke();
    }
    const haze = ctx.createLinearGradient(0, 520, 0, 610);
    haze.addColorStop(0, 'rgba(0,0,0,0)');
    haze.addColorStop(1, look.haze);
    ctx.fillStyle = haze;
    ctx.fillRect(0, 520, W, 90);
  });
  // a thumbnail for the bazaar: sky, light, skyline, rug
  tex(scene, `swatch_${theme}`, 120, 72, (ctx) => {
    ctx.beginPath();
    ctx.roundRect(0, 0, 120, 72, 10);
    ctx.clip();
    const sky = ctx.createLinearGradient(0, 0, 0, 52);
    look.sky.forEach((c, i) => sky.addColorStop([0, 0.3, 0.58, 0.8, 1][i], c));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 120, 72);
    if (look.light === 'sun') {
      glow(ctx, 88, 16, 26, 'rgba(255,255,220,0.8)');
      ellipse(ctx, 88, 16, 8, 8, '#fff6c8');
    } else {
      glow(ctx, 30, 20, 22, 'rgba(255,220,180,0.5)');
      ellipse(ctx, 30, 20, 8, 8, look.light === 'moon' ? '#fff1cf' : 'rgba(255,241,207,0.5)');
    }
    if (look.light === 'cloud') {
      ellipse(ctx, 50, 28, 30, 7, look.skyline[0]);
      ellipse(ctx, 95, 36, 26, 6, look.skyline[1]);
    }
    ctx.fillStyle = look.skyline[1];
    for (let x = -4; x < 124; x += 17) {
      const h = 12 + ((x * 7) % 11);
      ctx.fillRect(x, 50 - h, 13, h + 4);
      ellipse(ctx, x + 6.5, 50 - h, 5.5, 4, look.skyline[1]);
    }
    const rg = ctx.createLinearGradient(0, 52, 0, 72);
    rg.addColorStop(0, look.rug[0]);
    rg.addColorStop(1, look.rug[1]);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 52, 120, 20);
    ctx.fillStyle = look.bands[0];
    ctx.fillRect(0, 56, 120, 4);
    ctx.fillStyle = look.bands[1];
    for (let x = 0; x < 120; x += 8) ctx.fillRect(x, 57, 4, 2);
  });
}

// ---------------------------------------------------------------- vine

function leaf(ctx: Ctx, x: number, y: number, len: number, angle: number, light: string, dark: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.3, -len * 0.38, len * 0.75, -len * 0.3, len, 0);
  ctx.bezierCurveTo(len * 0.75, len * 0.3, len * 0.3, len * 0.38, 0, 0);
  const g = ctx.createLinearGradient(0, -len * 0.3, 0, len * 0.3);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,60,20,0.6)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1, 0);
  ctx.lineTo(len * 0.85, 0);
  ctx.strokeStyle = 'rgba(220,255,200,0.55)';
  ctx.stroke();
  ctx.restore();
}

function jasmine(ctx: Ctx, x: number, y: number, r: number, petal: string): void {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2;
    ctx.save();
    ctx.translate(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
    ctx.rotate(a);
    ellipse(ctx, 0, 0, r * 0.6, r * 0.38, petal);
    ctx.restore();
  }
  ellipse(ctx, x, y, r * 0.28, r * 0.28, '#ffcc33');
}

/** The vine's centre line, local to the vine texture (35 = CONFIG.layout.vineY). */
export function vineCurve(x: number): number {
  return 35 + Math.sin(x / 40) * 2.5;
}

function vine(scene: Phaser.Scene): void {
  tex(scene, 'vine', L.width, 70, (ctx) => {
    const W = L.width;
    const rnd = decoRand(21);
    for (let x = -6; x < W + 6; x += 13) {
      const up = Math.floor(x / 13) % 2 === 0;
      leaf(
        ctx,
        x,
        vineCurve(x) + (up ? -3 : 3),
        15 + rnd() * 6,
        (up ? -1 : 1) * (0.5 + rnd() * 0.5),
        '#5fbf4f',
        '#24692b',
      );
    }
    for (const [phase, color, light] of [
      [0, '#285e22', '#4c9a3c'],
      [Math.PI, '#33752b', '#6cc052'],
    ] as const) {
      ctx.beginPath();
      for (let x = -4; x <= W + 4; x += 2) {
        const y = vineCurve(x) + Math.sin(x / 13 + phase) * 3.6;
        if (x === -4) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.save();
      ctx.translate(0, -1.6);
      ctx.strokeStyle = light;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    // tendril curls
    ctx.strokeStyle = '#4c9a3c';
    ctx.lineWidth = 1.2;
    for (let x = 30; x < W; x += 74) {
      ctx.beginPath();
      for (let t = 0; t < 14; t += 0.3) {
        const r = 7 - t * 0.45;
        const px = x + Math.cos(t) * r;
        const py = vineCurve(x) - 12 + Math.sin(t) * r * 0.8;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    for (let x = 4; x < W + 6; x += 13) {
      const up = Math.floor(x / 13) % 2 === 1;
      if (rnd() < 0.55)
        leaf(
          ctx,
          x,
          vineCurve(x) + (up ? -2 : 2),
          13 + rnd() * 5,
          (up ? -1 : 1) * (2.2 + rnd() * 0.5),
          '#7ad65f',
          '#2f8236',
        );
    }
    for (let x = 18; x < W; x += 34 + rnd() * 30) {
      jasmine(ctx, x, vineCurve(x) - 4 + rnd() * 8, 5, rnd() < 0.5 ? '#fff6fb' : '#ffd1e8');
    }
  });
}

/** The curl of vine a lid hangs from. */
function tendril(scene: Phaser.Scene): void {
  tex(scene, 'tendril', 16, 22, (ctx) => {
    ctx.strokeStyle = '#3f8a35';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.bezierCurveTo(14, 6, 2, 10, 8, 16);
    ctx.lineTo(8, 21);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190,255,160,0.6)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  });
}

/** The flower a charmed snake leaves on the vine, one per colour of snake. */
function blooms(scene: Phaser.Scene): void {
  const petals: Record<SnakeKind, [string, string]> = {
    green: ['#ffb3d9', '#e0357d'],
    gold: ['#fff1a8', '#f29a12'],
    sleepy: ['#d6dcff', '#6a5cff'],
    ruby: ['#ffb0b8', '#c2102c'],
    moon: ['#ffffff', '#a9b4ff'],
    king: ['#ffe08a', '#d4600f'],
  };
  for (const kind of KINDS) {
    const [light, dark] = petals[kind];
    tex(scene, `bloom_${kind}`, 40, 40, (ctx) => {
      ctx.translate(20, 20);
      for (let ring = 0; ring < 2; ring++) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + ring * 0.52;
          const r = ring ? 9 : 13;
          ctx.save();
          ctx.rotate(a);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(r * 0.5, -r * 0.9, r * 1.3, -r * 0.6, r * 1.45, 0);
          ctx.bezierCurveTo(r * 1.3, r * 0.6, r * 0.5, r * 0.9, 0, 0);
          const g = ctx.createLinearGradient(0, 0, r * 1.45, 0);
          g.addColorStop(0, dark);
          g.addColorStop(1, light);
          ctx.fillStyle = g;
          ctx.fill();
          ctx.strokeStyle = 'rgba(80,10,40,0.35)';
          ctx.lineWidth = 0.7;
          ctx.stroke();
          ctx.restore();
        }
      }
      ellipse(ctx, 0, 0, 4.5, 4.5, '#ffd84a');
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU;
        ellipse(ctx, Math.cos(a) * 3.2, Math.sin(a) * 3.2, 1, 1, '#a35a00');
      }
    });
  }
}

// ---------------------------------------------------------------- pots and lids

interface PotLook {
  light: string;
  mid: string;
  dark: string;
  rim: string;
  rimDark: string;
  band: string;
  ink: string;
}

const POT_LOOK: Record<SnakeKind, PotLook> = {
  green: {
    light: '#f7b07a',
    mid: '#d06a36',
    dark: '#7a3016',
    rim: '#f2a26b',
    rimDark: '#8a3a1c',
    band: '#fbe3bd',
    ink: '#1f8f8a',
  },
  gold: {
    light: '#fff6c4',
    mid: '#e8a821',
    dark: '#7a4800',
    rim: '#ffe68a',
    rimDark: '#9a6200',
    band: '#fff1b8',
    ink: '#c0392b',
  },
  sleepy: {
    light: '#9fb4ff',
    mid: '#3c4fc4',
    dark: '#1b2266',
    rim: '#8ea4ff',
    rimDark: '#1f2a7a',
    band: '#e4e9ff',
    ink: '#f5c542',
  },
  ruby: {
    light: '#ff9fb0',
    mid: '#c9203f',
    dark: '#5a0a1c',
    rim: '#ff8fa6',
    rimDark: '#6e0f24',
    band: '#fff0f3',
    ink: '#2b0b14',
  },
  moon: {
    light: '#7f8fd6',
    mid: '#2a3270',
    dark: '#0e1236',
    rim: '#aab6ff',
    rimDark: '#1c2460',
    band: '#1a2050',
    ink: '#f3f6ff',
  },
  king: {
    light: '#6a6a6a',
    mid: '#262626',
    dark: '#050505',
    rim: '#ffd36b',
    rimDark: '#8a5a00',
    band: '#ffd36b',
    ink: '#b8302a',
  },
};

const RIM_RX = 26;
const RIM_RY = 7;
const RIM_Y = 7; // rim ellipse centre, local to the pot texture's top
const HOLE_RX = 20;
const HOLE_RY = 4.4;

function potPath(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(-20, 11);
  ctx.bezierCurveTo(-19, 22, -33, 30, -33, 52);
  ctx.bezierCurveTo(-33, 70, -26, 80, -20, 83);
  ctx.quadraticCurveTo(0, 86.5, 20, 83);
  ctx.bezierCurveTo(26, 80, 33, 70, 33, 52);
  ctx.bezierCurveTo(33, 30, 19, 22, 20, 11);
  ctx.closePath();
}

function potBand(ctx: Ctx, kind: SnakeKind, look: PotLook): void {
  ctx.fillStyle = look.band;
  ctx.fillRect(-40, 33, 80, 13);
  ctx.fillStyle = look.ink;
  if (kind === 'sleepy' || kind === 'moon') {
    // moons and stars
    for (let x = -30; x <= 30; x += 15) {
      ctx.beginPath();
      ctx.arc(x, 39.5, 4.2, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 1.8, 38.5, 3.6, 0, TAU);
      ctx.fillStyle = look.band;
      ctx.fill();
      ctx.fillStyle = look.ink;
    }
    for (let i = 0; i < 9; i++) ellipse(ctx, -34 + i * 8.5, 62 + (i % 2) * 7, 1.4, 1.4, look.band);
    return;
  }
  for (let x = -36; x < 36; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, 46);
    ctx.lineTo(x + 4.5, 35);
    ctx.lineTo(x + 9, 46);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = look.dark;
  ctx.fillRect(-40, 31, 80, 2);
  ctx.fillRect(-40, 46, 80, 2);
  for (let x = -27; x <= 27; x += 9) ellipse(ctx, x, 62, 2.2, 2.2, look.band);
  if (kind === 'gold') {
    ellipse(ctx, 0, 64, 5, 6, '#e0303a');
    ellipse(ctx, -1.5, 62, 1.6, 2, 'rgba(255,255,255,0.8)');
  }
  if (kind === 'king') {
    ctx.fillStyle = '#ffd36b';
    ctx.beginPath();
    ctx.moveTo(-9, 70);
    ctx.lineTo(-9, 60);
    ctx.lineTo(-4.5, 65);
    ctx.lineTo(0, 58);
    ctx.lineTo(4.5, 65);
    ctx.lineTo(9, 60);
    ctx.lineTo(9, 70);
    ctx.closePath();
    ctx.fill();
  }
}

function potTextures(scene: Phaser.Scene): void {
  const w = L.potWidth + 8;
  const h = L.potHeight + 8;
  for (const kind of KINDS) {
    const look = POT_LOOK[kind];
    // back: the rim ring and the dark mouth the snake comes out of
    tex(scene, `potBack_${kind}`, w, 20, (ctx) => {
      ctx.translate(w / 2, 2);
      const rg = ctx.createLinearGradient(0, 0, 0, 14);
      rg.addColorStop(0, look.rim);
      rg.addColorStop(1, look.rimDark);
      ellipse(ctx, 0, RIM_Y, RIM_RX, RIM_RY, rg);
      const hg = ctx.createLinearGradient(0, RIM_Y - HOLE_RY, 0, RIM_Y + HOLE_RY);
      hg.addColorStop(0, '#120608');
      hg.addColorStop(1, '#3a1a12');
      ellipse(ctx, 0, RIM_Y + 0.4, HOLE_RX, HOLE_RY, hg);
    });
    // front: the body and the front half of the rim, drawn over the snake
    tex(scene, `potFront_${kind}`, w, h, (ctx) => {
      ctx.translate(w / 2, 2);
      potPath(ctx);
      const g = ctx.createRadialGradient(-11, 38, 3, 0, 50, 46);
      g.addColorStop(0, look.light);
      g.addColorStop(0.45, look.mid);
      g.addColorStop(1, look.dark);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      potPath(ctx);
      ctx.clip();
      potBand(ctx, kind, look);
      const side = ctx.createLinearGradient(-33, 0, 33, 0);
      side.addColorStop(0, 'rgba(255,255,255,0.1)');
      side.addColorStop(0.5, 'rgba(0,0,0,0)');
      side.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = side;
      ctx.fillRect(-40, 0, 80, 90);
      const low = ctx.createLinearGradient(0, 60, 0, 86);
      low.addColorStop(0, 'rgba(0,0,0,0)');
      low.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = low;
      ctx.fillRect(-40, 60, 80, 30);
      ctx.beginPath();
      ctx.ellipse(-20, 46, 4, 15, 0.25, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fill();
      ellipse(ctx, -18, 27, 2.4, 3.4, 'rgba(255,255,255,0.7)');
      ctx.restore();
      potPath(ctx);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = 'rgba(40,10,10,0.55)';
      ctx.stroke();
      // front lip: lower half of the rim ring
      ctx.beginPath();
      ctx.ellipse(0, RIM_Y, RIM_RX, RIM_RY, 0, 0, Math.PI);
      ctx.ellipse(0, RIM_Y + 0.4, HOLE_RX, HOLE_RY, 0, Math.PI, 0, true);
      ctx.closePath();
      const lg = ctx.createLinearGradient(0, RIM_Y, 0, RIM_Y + RIM_RY);
      lg.addColorStop(0, look.rim);
      lg.addColorStop(1, look.rimDark);
      ctx.fillStyle = lg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,10,10,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, RIM_Y, RIM_RX, RIM_RY, 0, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, RIM_Y - 0.5, RIM_RX - 2, RIM_RY - 2, 0, 0.15, Math.PI - 0.15);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.stroke();
    });
  }
  // ground shadow under a pot
  tex(scene, 'potShadow', 84, 20, (ctx) => {
    const g = ctx.createRadialGradient(42, 10, 2, 42, 10, 40);
    g.addColorStop(0, 'rgba(20,0,10,0.55)');
    g.addColorStop(1, 'rgba(20,0,10,0)');
    ctx.save();
    ctx.scale(1, 0.25);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 84, 80);
    ctx.restore();
  });
}

function lidPath(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(-29, 25);
  ctx.bezierCurveTo(-28, 12, -14, 8, 0, 8);
  ctx.bezierCurveTo(14, 8, 28, 12, 29, 25);
  ctx.closePath();
}

function lidTextures(scene: Phaser.Scene): void {
  const looks = {
    clay: { light: '#ffc28f', mid: '#cf6a35', dark: '#6f2a12', band: '#fbe3bd', ink: '#1f8f8a' },
    iron: { light: '#d7deea', mid: '#6b7488', dark: '#262b38', band: '#9aa3b8', ink: '#2b3040' },
  };
  for (const [kind, look] of Object.entries(looks)) {
    // origin of the texture: the top of the knob, centre
    tex(scene, `lid_${kind}`, 64, 34, (ctx) => {
      ctx.translate(32, 1);
      // knob
      const kg = ctx.createRadialGradient(-2, 2, 0.5, 0, 4, 6);
      kg.addColorStop(0, look.light);
      kg.addColorStop(1, look.dark);
      ellipse(ctx, 0, 4, 5, 4.4, kg);
      ctx.fillStyle = look.dark;
      ctx.fillRect(-2.5, 7, 5, 3);
      // dome
      lidPath(ctx);
      const g = ctx.createRadialGradient(-8, 10, 2, 0, 20, 30);
      g.addColorStop(0, look.light);
      g.addColorStop(0.5, look.mid);
      g.addColorStop(1, look.dark);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      lidPath(ctx);
      ctx.clip();
      if (kind === 'clay') {
        ctx.fillStyle = look.band;
        ctx.fillRect(-30, 16, 60, 4);
        for (let x = -24; x <= 24; x += 8) ellipse(ctx, x, 18, 1.3, 1.3, look.ink);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(-30, 17, 60, 2);
        for (let x = -22; x <= 22; x += 11) {
          ellipse(ctx, x, 21.5, 1.6, 1.6, look.light);
          ellipse(ctx, x + 0.4, 22, 1.2, 1.2, look.dark);
        }
      }
      ctx.beginPath();
      ctx.ellipse(-13, 14, 7, 2.6, -0.35, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fill();
      ctx.restore();
      // flange
      const fg = ctx.createLinearGradient(0, 23, 0, 30);
      fg.addColorStop(0, look.mid);
      fg.addColorStop(1, look.dark);
      ctx.beginPath();
      ctx.ellipse(0, 26, 30, 4.5, 0, 0, TAU);
      ctx.fillStyle = fg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,10,10,0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
      lidPath(ctx);
      ctx.stroke();
    });
  }
  // the shadow a falling lid casts on its pot's rim
  tex(scene, 'lidShadow', 60, 16, (ctx) => {
    const g = ctx.createRadialGradient(30, 8, 1, 30, 8, 28);
    g.addColorStop(0, 'rgba(10,0,20,0.7)');
    g.addColorStop(1, 'rgba(10,0,20,0)');
    ctx.save();
    ctx.scale(1, 16 / 60);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 60, 60);
    ctx.restore();
  });
  tex(scene, 'alert', 22, 22, (ctx) => {
    ellipse(ctx, 11, 11, 10, 10, '#ff4d4d');
    ctx.strokeStyle = '#fff3e0';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(9.6, 5, 2.8, 8);
    ellipse(ctx, 11, 16, 1.6, 1.6, '#ffffff');
  });
}

// ---------------------------------------------------------------- snakes

/** The body strip a Rope bends along the snake's path: head end at the top of the texture. */
function bodyTextures(scene: Phaser.Scene): void {
  const w = A.bodyWidth;
  const len = A.bodyLength;
  for (const kind of KINDS) {
    const [back, belly, pat] = SKIN[kind];
    tex(scene, `body_${kind}`, w, len, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, shade(back, -0.6));
      g.addColorStop(0.16, shade(back, -0.2));
      g.addColorStop(0.36, shade(back, 0.3));
      g.addColorStop(0.6, hex(back));
      g.addColorStop(0.86, shade(back, -0.35));
      g.addColorStop(1, shade(back, -0.65));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, len);
      // side markings
      for (let y = 8; y < len; y += 20) {
        for (const x of [w * 0.13, w * 0.87]) {
          ctx.beginPath();
          ctx.moveTo(x, y - 6);
          ctx.lineTo(x + 3, y);
          ctx.lineTo(x, y + 6);
          ctx.lineTo(x - 3, y);
          ctx.closePath();
          ctx.fillStyle = shade(pat, 0, 0.85);
          ctx.fill();
        }
      }
      // belly plates down the front
      const bw = w * 0.5;
      const bx = (w - bw) / 2;
      const bg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      bg.addColorStop(0, shade(belly, -0.25));
      bg.addColorStop(0.35, shade(belly, 0.35));
      bg.addColorStop(1, shade(belly, -0.3));
      ctx.fillStyle = bg;
      ctx.fillRect(bx, 0, bw, len);
      ctx.strokeStyle = shade(belly, -0.45, 0.8);
      ctx.lineWidth = 0.8;
      for (let y = 3; y < len; y += 6) {
        ctx.beginPath();
        ctx.moveTo(bx, y);
        ctx.quadraticCurveTo(w / 2, y + 2.2, bx + bw, y);
        ctx.stroke();
      }
      ctx.fillStyle = shade(back, -0.7, 0.9);
      ctx.fillRect(0, 0, 1.3, len);
      ctx.fillRect(w - 1.3, 0, 1.3, len);
    });
  }
}

function hoodPath(ctx: Ctx, w: number, h: number): void {
  const hw = w / 2;
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.bezierCurveTo(hw * 0.6, 0, hw, h * 0.26, hw * 0.97, h * 0.55);
  ctx.bezierCurveTo(hw * 0.94, h * 0.8, hw * 0.5, h * 0.96, hw * 0.2, h);
  ctx.lineTo(-hw * 0.2, h);
  ctx.bezierCurveTo(-hw * 0.5, h * 0.96, -hw * 0.94, h * 0.8, -hw * 0.97, h * 0.55);
  ctx.bezierCurveTo(-hw, h * 0.26, -hw * 0.6, 0, 0, 1);
  ctx.closePath();
}

function headPath(ctx: Ctx, w: number, h: number): void {
  const hw = w / 2;
  ctx.beginPath();
  ctx.moveTo(0, 0.5);
  ctx.bezierCurveTo(hw * 0.68, 0.5, hw, h * 0.16, hw, h * 0.42);
  ctx.bezierCurveTo(hw, h * 0.74, hw * 0.6, h * 0.98, 0, h);
  ctx.bezierCurveTo(-hw * 0.6, h * 0.98, -hw, h * 0.74, -hw, h * 0.42);
  ctx.bezierCurveTo(-hw, h * 0.16, -hw * 0.68, 0.5, 0, 0.5);
  ctx.closePath();
}

function headTextures(scene: Phaser.Scene): void {
  const hw = A.hoodWidth;
  const hh = A.hoodHeight;
  const w = A.headWidth;
  const h = A.headHeight;
  for (const kind of KINDS) {
    const [back, belly, pat] = SKIN[kind];
    tex(scene, `hood_${kind}`, hw + 4, hh + 4, (ctx) => {
      ctx.translate(hw / 2 + 2, 2);
      hoodPath(ctx, hw, hh);
      const g = ctx.createRadialGradient(0, hh * 0.45, 4, 0, hh * 0.5, hw * 0.6);
      g.addColorStop(0, shade(back, 0.1));
      g.addColorStop(1, shade(back, -0.45));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      hoodPath(ctx, hw, hh);
      ctx.clip();
      // inner panel and the two eye-spots on the hood
      ctx.beginPath();
      ctx.ellipse(0, hh * 0.62, hw * 0.3, hh * 0.42, 0, 0, TAU);
      ctx.fillStyle = shade(belly, -0.05, 0.9);
      ctx.fill();
      for (const sx of [-1, 1]) {
        if (kind === 'moon') {
          ellipse(ctx, sx * hw * 0.3, hh * 0.42, 5.5, 5.5, shade(pat, 0));
          ellipse(ctx, sx * hw * 0.3 + sx * 2.2, hh * 0.42 - 1, 4.6, 4.6, shade(belly, -0.05, 0.9));
          continue;
        }
        ellipse(ctx, sx * hw * 0.3, hh * 0.42, 5.5, 4.5, shade(pat, 0));
        ellipse(ctx, sx * hw * 0.3, hh * 0.42, 3, 2.3, shade(belly, 0.2));
        ellipse(ctx, sx * hw * 0.3, hh * 0.42, 1.3, 1.1, shade(pat, -0.2));
      }
      ctx.strokeStyle = shade(pat, 0, 0.6);
      ctx.lineWidth = 1.4;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.ellipse(0, hh * 0.5, hw * (0.38 + i * 0.07), hh * (0.4 + i * 0.07), 0, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      ctx.restore();
      hoodPath(ctx, hw, hh);
      ctx.strokeStyle = shade(back, -0.75);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    tex(scene, `head_${kind}`, w + 4, h + 4, (ctx) => {
      ctx.translate(w / 2 + 2, 2);
      headPath(ctx, w, h);
      const g = ctx.createRadialGradient(-w * 0.15, h * 0.25, 2, 0, h * 0.45, w * 0.7);
      g.addColorStop(0, shade(back, 0.45));
      g.addColorStop(0.55, hex(back));
      g.addColorStop(1, shade(back, -0.4));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      headPath(ctx, w, h);
      ctx.clip();
      // crown scales
      for (const [sx, sy, rx] of [
        [0, 4, 6],
        [-7, 6, 4.5],
        [7, 6, 4.5],
      ]) {
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx, 3.6, 0, 0, Math.PI);
        ctx.fillStyle = shade(pat, 0, 0.55);
        ctx.fill();
      }
      // chin
      ctx.beginPath();
      ctx.ellipse(0, h * 0.94, w * 0.3, h * 0.2, 0, Math.PI, 0);
      ctx.fillStyle = shade(belly, 0, 0.75);
      ctx.fill();
      ctx.restore();
      // cheeks, nostrils, smile
      ellipse(ctx, -w * 0.32, h * 0.66, 4.5, 2.8, 'rgba(255,110,140,0.45)');
      ellipse(ctx, w * 0.32, h * 0.66, 4.5, 2.8, 'rgba(255,110,140,0.45)');
      ellipse(ctx, -2.6, h * 0.72, 0.9, 0.7, shade(back, -0.7));
      ellipse(ctx, 2.6, h * 0.72, 0.9, 0.7, shade(back, -0.7));
      ctx.beginPath();
      ctx.moveTo(-6, h * 0.8);
      ctx.quadraticCurveTo(0, h * 0.88, 6, h * 0.8);
      ctx.strokeStyle = shade(back, -0.75);
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.stroke();
      headPath(ctx, w, h);
      ctx.strokeStyle = shade(back, -0.75);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-w * 0.2, h * 0.16, 5, 2.2, -0.4, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fill();
    });
    // a heavy eyelid, drawn over the sleepy snake's eyes
    tex(scene, `eyelid_${kind}`, 16, 10, (ctx) => {
      ctx.beginPath();
      ctx.moveTo(1, 9);
      ctx.bezierCurveTo(1, 1, 15, 1, 15, 9);
      ctx.quadraticCurveTo(8, 7, 1, 9);
      ctx.fillStyle = shade(back, -0.1);
      ctx.fill();
      ctx.strokeStyle = shade(back, -0.7);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(1.5, 9);
      ctx.quadraticCurveTo(8, 7, 14.5, 9);
      ctx.stroke();
    });
  }
  tex(scene, 'eye', 14, 16, (ctx) => {
    const g = ctx.createRadialGradient(5, 5, 1, 7, 8, 8);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#dfe6f0');
    ellipse(ctx, 7, 8, 6.2, 7.2, g);
    ctx.strokeStyle = '#1c1426';
    ctx.lineWidth = 1.3;
    ctx.stroke();
  });
  tex(scene, 'pupil', 8, 10, (ctx) => {
    ellipse(ctx, 4, 5, 3.4, 4.4, '#1c1426');
    ellipse(ctx, 2.8, 3.4, 1.3, 1.5, '#ffffff');
    ellipse(ctx, 5, 6.8, 0.6, 0.6, 'rgba(255,255,255,0.7)');
  });
  tex(scene, 'tongue', 10, 16, (ctx) => {
    ctx.strokeStyle = '#e8304a';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(5, 9);
    ctx.lineTo(2, 14);
    ctx.moveTo(5, 9);
    ctx.lineTo(8, 14);
    ctx.stroke();
  });
}

// ---------------------------------------------------------------- the pungi (charmer's gourd flute)

function pungi(scene: Phaser.Scene, skin: PungiSkin, look: PungiLook): void {
  tex(scene, `pungi_${skin}`, 48, 80, (ctx) => {
    ctx.translate(24, 0);
    // twin pipes, pointing up at the pot
    for (const x of [-5, 5]) {
      const g = ctx.createLinearGradient(x - 3.5, 0, x + 3.5, 0);
      g.addColorStop(0, look.wood[0]);
      g.addColorStop(0.4, look.wood[1]);
      g.addColorStop(1, look.wood[2]);
      ctx.fillStyle = g;
      ctx.fillRect(x - 3.5, 3, 7, 30);
      ellipse(ctx, x, 3, 3.5, 1.5, '#1d0d04');
      for (const y of [8, 15, 22]) {
        ctx.fillStyle = look.band;
        ctx.fillRect(x - 3.6, y, 7.2, 1.6);
      }
    }
    // wax collar
    ellipse(ctx, 0, 33, 11, 4, look.wood[0]);
    // gourd
    ctx.beginPath();
    ctx.moveTo(-9, 34);
    ctx.bezierCurveTo(-24, 38, -22, 60, -5, 63);
    ctx.lineTo(5, 63);
    ctx.bezierCurveTo(22, 60, 24, 38, 9, 34);
    ctx.closePath();
    const gg = ctx.createRadialGradient(-6, 42, 2, 0, 48, 20);
    gg.addColorStop(0, look.gourd[0]);
    gg.addColorStop(0.5, look.gourd[1]);
    gg.addColorStop(1, look.gourd[2]);
    ctx.fillStyle = gg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,10,0,0.6)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = look.band;
    ctx.fillRect(-24, 45, 48, 3.2);
    for (let x = -15; x <= 15; x += 6) ellipse(ctx, x, 52, 1.4, 1.4, look.dots);
    ellipse(ctx, -7, 42, 3, 5, 'rgba(255,255,255,0.4)');
    ctx.restore();
    // mouthpiece
    const mg = ctx.createLinearGradient(-4, 0, 4, 0);
    mg.addColorStop(0, '#9c7b52');
    mg.addColorStop(0.5, '#fff1d0');
    mg.addColorStop(1, '#9c7b52');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.moveTo(-4.5, 62);
    ctx.lineTo(4.5, 62);
    ctx.lineTo(3, 78);
    ctx.lineTo(-3, 78);
    ctx.closePath();
    ctx.fill();
    // tassel
    ctx.strokeStyle = look.tassel;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(14, 44);
    ctx.quadraticCurveTo(20, 52, 18, 62);
    ctx.stroke();
    ellipse(ctx, 18, 63, 2.4, 3.4, look.dots);
  });
}

// ---------------------------------------------------------------- icons for the menu and the bazaar

function iconTextures(scene: Phaser.Scene): void {
  // a flower: the currency
  tex(scene, 'flower', 26, 26, (ctx) => {
    ctx.translate(13, 13);
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((i / 5) * TAU);
      ctx.beginPath();
      ctx.ellipse(0, -6.5, 4.2, 6.2, 0, 0, TAU);
      const g = ctx.createLinearGradient(0, -12, 0, 0);
      g.addColorStop(0, '#ffb3d9');
      g.addColorStop(1, '#e0357d');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(80,10,40,0.45)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }
    ellipse(ctx, 0, 0, 4, 4, '#ffd84a');
    ellipse(ctx, -1.2, -1.2, 1.3, 1.3, 'rgba(255,255,255,0.7)');
  });
  // a crown for the king cobra
  tex(scene, 'crown', 24, 16, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(2, 14);
    ctx.lineTo(1, 4);
    ctx.lineTo(7, 9);
    ctx.lineTo(12, 1);
    ctx.lineTo(17, 9);
    ctx.lineTo(23, 4);
    ctx.lineTo(22, 14);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, 16);
    g.addColorStop(0, '#fff1a8');
    g.addColorStop(1, '#d19a12');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#7a4a00';
    ctx.lineWidth = 1;
    ctx.stroke();
    ellipse(ctx, 12, 11, 1.8, 1.8, '#e0303a');
    ellipse(ctx, 6, 12, 1.2, 1.2, '#1f8f8a');
    ellipse(ctx, 18, 12, 1.2, 1.2, '#1f8f8a');
  });
  tex(scene, 'lock', 22, 26, (ctx) => {
    ctx.strokeStyle = '#c9c2d8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(11, 9, 6, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(2, 10, 18, 14, 3);
    ctx.fillStyle = '#c9c2d8';
    ctx.fill();
    ellipse(ctx, 11, 16, 2, 2, '#4a3f66');
    ctx.fillStyle = '#4a3f66';
    ctx.fillRect(10, 16, 2, 5);
  });
  tex(scene, 'check', 20, 20, (ctx) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(3, 10);
    ctx.lineTo(8, 15);
    ctx.lineTo(17, 5);
    ctx.stroke();
  });
  tex(scene, 'rain', 3, 22, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 22);
    g.addColorStop(0, 'rgba(200,230,255,0)');
    g.addColorStop(1, 'rgba(200,230,255,0.8)');
    ctx.fillStyle = g;
    ctx.fillRect(0.5, 0, 2, 22);
  });
  // the daily pouch: a drawstring bag with a flower poking out
  tex(scene, 'pouch', 72, 72, (ctx) => {
    ctx.translate(36, 36);
    ctx.beginPath();
    ctx.moveTo(-14, -12);
    ctx.bezierCurveTo(-34, -4, -34, 30, -8, 32);
    ctx.lineTo(8, 32);
    ctx.bezierCurveTo(34, 30, 34, -4, 14, -12);
    ctx.closePath();
    const g = ctx.createRadialGradient(-8, 2, 2, 0, 10, 32);
    g.addColorStop(0, '#f2c27a');
    g.addColorStop(0.6, '#b8702a');
    g.addColorStop(1, '#5a2e0c');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,15,0,0.6)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // gathered neck
    ctx.beginPath();
    ctx.moveTo(-16, -12);
    ctx.quadraticCurveTo(0, -4, 16, -12);
    ctx.quadraticCurveTo(0, -20, -16, -12);
    ctx.fillStyle = '#7a4418';
    ctx.fill();
    ctx.strokeStyle = '#e0303a';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-17, -11);
    ctx.quadraticCurveTo(0, -3, 17, -11);
    ctx.stroke();
    for (const x of [-20, 20]) {
      ctx.beginPath();
      ctx.moveTo(x * 0.85, -11);
      ctx.quadraticCurveTo(x * 1.1, -2, x * 0.9, 6);
      ctx.stroke();
      ellipse(ctx, x * 0.9, 7, 2.2, 3, '#ffcc33');
    }
    // flowers poking out
    for (const [fx, fy, r, c1, c2] of [
      [-8, -20, 5, '#ffb3d9', '#e0357d'],
      [6, -24, 6, '#fff1a8', '#f29a12'],
      [16, -18, 4.5, '#d6dcff', '#6a5cff'],
    ] as [number, number, number, string, string][]) {
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate((i / 5) * TAU);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.9, r * 0.6, r, 0, 0, TAU);
        const pg = ctx.createLinearGradient(0, -r * 2, 0, 0);
        pg.addColorStop(0, c1);
        pg.addColorStop(1, c2);
        ctx.fillStyle = pg;
        ctx.fill();
        ctx.restore();
      }
      ellipse(ctx, fx, fy, r * 0.5, r * 0.5, '#ffd84a');
    }
  });
}

// ---------------------------------------------------------------- particles and glows

function fxTextures(scene: Phaser.Scene): void {
  tex(scene, 'spark', 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  });
  tex(scene, 'star', 18, 18, (ctx) => {
    ctx.translate(9, 9);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU - Math.PI / 2;
      const r = i % 2 ? 2.2 : 8.5;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });
  tex(scene, 'note', 16, 20, (ctx) => {
    const draw = (fill: string, dx: number, dy: number, lw: number) => {
      ctx.save();
      ctx.translate(dx, dy);
      ctx.beginPath();
      ctx.ellipse(5, 15, 4.2, 3.2, -0.4, 0, TAU);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.fillRect(8, 2, 1.8, 13);
      ctx.beginPath();
      ctx.moveTo(9.8, 2);
      ctx.quadraticCurveTo(15, 5, 13, 10);
      ctx.lineWidth = lw;
      ctx.strokeStyle = fill;
      ctx.stroke();
      ctx.restore();
    };
    draw('rgba(60,20,40,0.6)', 0.8, 0.8, 2.2);
    draw('#ffffff', 0, 0, 2);
  });
  tex(scene, 'petal', 12, 8, (ctx) => {
    ctx.beginPath();
    ctx.ellipse(6, 4, 5.5, 3, 0, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });
  tex(scene, 'leaf', 14, 8, (ctx) => leaf(ctx, 1, 4, 12, 0, '#7ad65f', '#2f8236'));
  tex(scene, 'dust', 20, 20, (ctx) => {
    const g = ctx.createRadialGradient(10, 10, 0, 10, 10, 10);
    g.addColorStop(0, 'rgba(255,236,210,0.9)');
    g.addColorStop(1, 'rgba(255,236,210,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 20, 20);
  });
  tex(scene, 'shard', 10, 8, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(4, 0);
    ctx.lineTo(10, 5);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });
  // a warm column of light up the charmed lane
  const pitch = (L.width - 2 * L.sidePad) / CONFIG.board.lanes;
  const beamH = L.rimY - L.lidTop + 60;
  tex(scene, 'beam', pitch, beamH, (ctx) => {
    const v = ctx.createLinearGradient(0, 0, 0, beamH);
    v.addColorStop(0, 'rgba(255,214,120,0)');
    v.addColorStop(0.6, 'rgba(255,214,120,0.18)');
    v.addColorStop(1, 'rgba(255,214,120,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, pitch, beamH);
    ctx.globalCompositeOperation = 'destination-in';
    const hz = ctx.createLinearGradient(0, 0, pitch, 0);
    hz.addColorStop(0, 'rgba(0,0,0,0)');
    hz.addColorStop(0.5, 'rgba(0,0,0,1)');
    hz.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, 0, pitch, beamH);
  });
  // red edges that pulse while the rug is full
  tex(scene, 'vignette', L.width, L.height, (ctx) => {
    const g = ctx.createRadialGradient(
      L.width / 2,
      L.height * 0.55,
      L.height * 0.3,
      L.width / 2,
      L.height * 0.55,
      L.height * 0.62,
    );
    g.addColorStop(0, 'rgba(255,40,60,0)');
    g.addColorStop(1, 'rgba(255,40,60,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L.width, L.height);
  });
  tex(scene, 'ring', 64, 64, (ctx) => {
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, TAU);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();
  });
}

/** Paint every texture the game uses (each only once per game). */
export function buildArt(scene: Phaser.Scene): void {
  for (const theme of THEMES) background(scene, theme, CONFIG.skins.themes[theme]);
  vine(scene);
  tendril(scene);
  blooms(scene);
  potTextures(scene);
  lidTextures(scene);
  bodyTextures(scene);
  headTextures(scene);
  for (const skin of PUNGI_SKINS) pungi(scene, skin, CONFIG.skins.pungi[skin]);
  iconTextures(scene);
  fxTextures(scene);
}
