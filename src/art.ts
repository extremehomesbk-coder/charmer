/**
 * Every texture in the game, painted once at start-up with the canvas 2D API (gradients, highlights,
 * patterns): no image files, nothing third-party. Textures are drawn at CONFIG.layout.renderScale so they stay
 * crisp on a phone; sprites show them at 1 / renderScale. Shape coordinates below are art, not tuning.
 */
import Phaser from 'phaser';
import { CONFIG } from './config';

const R = CONFIG.layout.renderScale;
const L = CONFIG.layout;
const A = CONFIG.art;

type Ctx = CanvasRenderingContext2D;

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
export function shade(c: number, amt: number): string {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  const t = amt > 0 ? 255 : 0;
  const k = Math.abs(amt);
  const mix = (v: number) => Math.round(v + (t - v) * k);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

/** Tiny seeded random for decorative scatter, so the art is identical on every load. */
function decoRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// ---------------------------------------------------------------- pots

function potPath(ctx: Ctx, w: number, h: number): void {
  const hw = w / 2;
  const top = -h / 2;
  const neck = hw * 0.42;
  ctx.beginPath();
  ctx.moveTo(-neck, top + 7);
  ctx.bezierCurveTo(-neck, top + 13, -hw, top + 12, -hw, top + h * 0.5);
  ctx.bezierCurveTo(-hw, top + h * 0.82, -hw * 0.7, h / 2, 0, h / 2);
  ctx.bezierCurveTo(hw * 0.7, h / 2, hw, top + h * 0.82, hw, top + h * 0.5);
  ctx.bezierCurveTo(hw, top + 12, neck, top + 13, neck, top + 7);
  ctx.closePath();
}

function glyph(ctx: Ctx, kind: number, x: number, y: number, r: number): void {
  ctx.beginPath();
  switch (kind % 6) {
    case 0:
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    case 1:
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y + r * 0.8);
      ctx.lineTo(x - r, y + r * 0.8);
      break;
    case 2:
      ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
      break;
    case 3:
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      break;
    case 4:
      ctx.rect(x - r, y - r * 0.32, r * 2, r * 0.64);
      ctx.rect(x - r * 0.32, y - r, r * 0.64, r * 2);
      break;
    default:
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.45 : r;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
  }
  ctx.closePath();
}

function potBody(ctx: Ctx, w: number, h: number, light: string, mid: string, dark: string): void {
  potPath(ctx, w, h);
  const g = ctx.createRadialGradient(-w * 0.18, -h * 0.12, 2, 0, 0, w * 0.75);
  g.addColorStop(0, light);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fill();
}

function potFinish(ctx: Ctx, w: number, h: number, rim: string, rimDark: string): void {
  const top = -h / 2;
  const neck = (w / 2) * 0.42;
  // rim lip
  ctx.beginPath();
  ctx.ellipse(0, top + 5, neck + 4, 4.5, 0, 0, Math.PI * 2);
  const rg = ctx.createLinearGradient(0, top, 0, top + 10);
  rg.addColorStop(0, rim);
  rg.addColorStop(1, rimDark);
  ctx.fillStyle = rg;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, top + 4, neck, 2.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  // specular highlights
  ctx.save();
  potPath(ctx, w, h);
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(-w * 0.27, -h * 0.02, 4, h * 0.22, -0.25, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-w * 0.24, -h * 0.26, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fill();
  // bottom shade
  const sg = ctx.createLinearGradient(0, h * 0.15, 0, h / 2);
  sg.addColorStop(0, 'rgba(0,0,0,0)');
  sg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = sg;
  ctx.fillRect(-w / 2, h * 0.15, w, h / 2);
  ctx.restore();
  potPath(ctx, w, h);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke();
}

function zigzag(ctx: Ctx, w: number, y: number, color: string): void {
  ctx.save();
  ctx.beginPath();
  const half = w / 2 - 4;
  for (let x = -half, i = 0; x <= half; x += 5, i++) ctx.lineTo(x, y + (i % 2 ? 2.5 : -2.5));
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}

function emboss(ctx: Ctx, kind: number, x: number, y: number, r: number, dark: string, light: string): void {
  glyph(ctx, kind, x + 0.8, y + 1, r);
  ctx.fillStyle = dark;
  ctx.fill();
  glyph(ctx, kind, x, y, r);
  ctx.fillStyle = light;
  ctx.fill();
}

/** A cream disc with the colour's glyph, so each colour also reads by shape. */
function badge(ctx: Ctx, kind: number, x: number, y: number, c: number): void {
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 9);
  g.addColorStop(0, '#fffdf3');
  g.addColorStop(1, '#e9dcc0');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = shade(c, -0.5);
  ctx.stroke();
  glyph(ctx, kind, x, y + (kind % 6 === 1 ? 0.5 : 0), 5);
  ctx.fillStyle = shade(c, -0.35);
  ctx.fill();
}

function potTextures(scene: Phaser.Scene): void {
  const w = L.potWidth;
  const h = L.potHeight;
  const pad = 4;
  CONFIG.colors.pots.forEach((c, i) => {
    tex(scene, `pot${i}`, w + pad * 2, h + pad * 2, (ctx) => {
      ctx.translate(w / 2 + pad, h / 2 + pad);
      potBody(ctx, w, h, shade(c, 0.55), hex(c), shade(c, -0.55));
      zigzag(ctx, w, -h * 0.12, shade(c, 0.5));
      badge(ctx, i, 0, h * 0.14, c);
      potFinish(ctx, w, h, shade(c, 0.3), shade(c, -0.4));
    });
    // Gold pot: gilded body, the colour set in as a gem.
    tex(scene, `gold${i}`, w + pad * 2, h + pad * 2, (ctx) => {
      ctx.translate(w / 2 + pad, h / 2 + pad);
      potBody(ctx, w, h, '#fff6c2', '#f2b416', '#7a4a00');
      zigzag(ctx, w, -h * 0.14, 'rgba(255,255,255,0.7)');
      zigzag(ctx, w, h * 0.36, 'rgba(122,74,0,0.6)');
      ctx.beginPath();
      ctx.arc(0, h * 0.12, 10, 0, Math.PI * 2);
      const gg = ctx.createRadialGradient(-3, h * 0.12 - 3, 1, 0, h * 0.12, 11);
      gg.addColorStop(0, shade(c, 0.7));
      gg.addColorStop(0.5, hex(c));
      gg.addColorStop(1, shade(c, -0.6));
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff1a8';
      ctx.stroke();
      glyph(ctx, i, 0, h * 0.12, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fill();
      potFinish(ctx, w, h, '#fff1a8', '#a86e00');
    });
  });
  // Wild pot: rainbow glaze with a star.
  tex(scene, 'wild', w + pad * 2, h + pad * 2, (ctx) => {
    ctx.translate(w / 2 + pad, h / 2 + pad);
    potPath(ctx, w, h);
    const lg = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    CONFIG.colors.pots.forEach((c, i, all) => lg.addColorStop(i / (all.length - 1), hex(c)));
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.save();
    potPath(ctx, w, h);
    ctx.clip();
    const rg = ctx.createRadialGradient(-w * 0.18, -h * 0.12, 2, 0, 0, w * 0.75);
    rg.addColorStop(0, 'rgba(255,255,255,0.55)');
    rg.addColorStop(0.5, 'rgba(255,255,255,0)');
    rg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = rg;
    ctx.fillRect(-w, -h, w * 2, h * 2);
    ctx.restore();
    emboss(ctx, 5, 0, h * 0.1, 11, 'rgba(60,0,80,0.5)', '#ffffff');
    potFinish(ctx, w, h, '#ffffff', '#9a7bd6');
  });
}

// ---------------------------------------------------------------- snake

function snakeTextures(scene: Phaser.Scene): void {
  const s = A.segment;
  tex(scene, 'seg', s, s, (ctx) => {
    const r = s / 2;
    ctx.translate(r, r);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, 1, 0, 0, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, '#e8e8e8');
    g.addColorStop(1, '#6d6d6d');
    ctx.beginPath();
    ctx.arc(0, 0, r - 0.5, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(i * r * 0.55, -r * 0.1, r * 0.38, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  });
  const hw = A.headWidth;
  const hh = A.headHeight;
  tex(scene, 'head', hw, hh, (ctx) => {
    ctx.translate(hw / 2, hh / 2);
    // hood
    ctx.beginPath();
    ctx.ellipse(0, 3, hw / 2 - 1, hh / 2 - 2, 0, 0, Math.PI * 2);
    const hg = ctx.createRadialGradient(0, 0, 2, 0, 3, hw / 2);
    hg.addColorStop(0, '#d9d9d9');
    hg.addColorStop(1, '#5e5e5e');
    ctx.fillStyle = hg;
    ctx.fill();
    // hood mark
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-6, 7, 4, 0, Math.PI * 2);
    ctx.moveTo(10, 7);
    ctx.arc(6, 7, 4, 0, Math.PI * 2);
    ctx.stroke();
    // face
    ctx.beginPath();
    ctx.ellipse(0, -2, hw * 0.27, hh * 0.36, 0, 0, Math.PI * 2);
    const fg = ctx.createRadialGradient(-3, -6, 1, 0, -2, hw * 0.3);
    fg.addColorStop(0, '#ffffff');
    fg.addColorStop(1, '#9a9a9a');
    ctx.fillStyle = fg;
    ctx.fill();
    // eyes
    for (const x of [-5, 5]) {
      ctx.beginPath();
      ctx.ellipse(x, -5, 3.4, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffe14d';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, -5, 1, 3.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#111';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - 1, -6.5, 0.9, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-2.5, 3, 1.4, 1.4);
    ctx.fillRect(1.1, 3, 1.4, 1.4);
  });
  tex(scene, 'tongue', 10, 14, (ctx) => {
    ctx.strokeStyle = '#ff3b5c';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(5, 9);
    ctx.lineTo(2, 13);
    ctx.moveTo(5, 9);
    ctx.lineTo(8, 13);
    ctx.stroke();
  });
}

// ---------------------------------------------------------------- baskets, lanes, vine

function basketTextures(scene: Phaser.Scene, pitch: number): void {
  const w = pitch - 6;
  const h = L.basketHeight;
  tex(scene, 'basketBack', w, 20, (ctx) => {
    ctx.beginPath();
    ctx.ellipse(w / 2, 10, w / 2 - 4, 7, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(w / 2, 12, 2, w / 2, 10, w / 2);
    g.addColorStop(0, '#0b0603');
    g.addColorStop(1, '#3a2312');
    ctx.fillStyle = g;
    ctx.fill();
  });
  tex(scene, 'basket', w, h + 8, (ctx) => {
    const top = 6;
    const inset = 9;
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(2, top);
      ctx.lineTo(w - 2, top);
      ctx.quadraticCurveTo(w - inset + 2, top + h * 0.7, w - inset, top + h);
      ctx.lineTo(inset, top + h);
      ctx.quadraticCurveTo(inset - 2, top + h * 0.7, 2, top);
      ctx.closePath();
    };
    body();
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#6e4219');
    g.addColorStop(0.35, '#d39a52');
    g.addColorStop(0.65, '#c0843d');
    g.addColorStop(1, '#5b3413');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    body();
    ctx.clip();
    // weave: offset brick rows with a light top edge
    const rowH = 7;
    for (let r = 0, y = top + 3; y < top + h; r++, y += rowH) {
      for (let x = (r % 2) * 6 - 6; x < w; x += 12) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(x, y + rowH - 2, 11, 2);
        ctx.fillStyle = 'rgba(255,230,180,0.25)';
        ctx.fillRect(x + 1, y, 9, 1.4);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x + 11, y, 1, rowH);
      }
    }
    const sg = ctx.createLinearGradient(0, top + h * 0.5, 0, top + h);
    sg.addColorStop(0, 'rgba(0,0,0,0)');
    sg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, top, w, h);
    ctx.restore();
    // braided rim
    ctx.beginPath();
    ctx.ellipse(w / 2, top, w / 2 - 1, 5, 0, 0, Math.PI);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#e7b56c';
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(90,50,15,0.8)';
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI;
      const x = w / 2 + Math.cos(a) * (w / 2 - 1);
      const y = top + Math.sin(a) * 5;
      ctx.beginPath();
      ctx.moveTo(x - 2, y - 3);
      ctx.lineTo(x + 2, y + 3);
      ctx.stroke();
    }
  });
}

function laneTextures(scene: Phaser.Scene, pitch: number, height: number): void {
  const w = pitch - 6;
  tex(scene, 'lane', w, height, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, 'rgba(255,255,255,0.015)');
    g.addColorStop(1, 'rgba(255,255,255,0.07)');
    ctx.beginPath();
    ctx.roundRect(1, 0, w - 2, height, 10);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  tex(scene, 'beam', w, height, (ctx) => {
    const g = ctx.createLinearGradient(0, height, 0, 0);
    g.addColorStop(0, 'rgba(255,214,110,0.55)');
    g.addColorStop(0.5, 'rgba(255,190,80,0.16)');
    g.addColorStop(1, 'rgba(255,190,80,0)');
    ctx.beginPath();
    ctx.roundRect(1, 0, w - 2, height, 10);
    ctx.fillStyle = g;
    ctx.fill();
  });
  tex(scene, 'danger', w, height, (ctx) => {
    ctx.beginPath();
    ctx.roundRect(2, 2, w - 4, height - 4, 10);
    ctx.strokeStyle = 'rgba(255,70,70,0.9)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ff3030';
    ctx.shadowBlur = 10;
    ctx.stroke();
  });
}

function vineTexture(scene: Phaser.Scene): void {
  const w = L.width;
  const h = A.vineHeight;
  tex(scene, 'vine', w, h, (ctx) => {
    const mid = h / 2;
    const stem = (amp: number, phase: number, width: number, color: string) => {
      ctx.beginPath();
      for (let x = -4; x <= w + 4; x += 4) {
        const y = mid + Math.sin(x / 34 + phase) * amp;
        if (x === -4) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.stroke();
    };
    stem(5, 0, 9, '#1d4a1f');
    stem(5, 0, 6, '#3f8f3a');
    stem(4, 2.2, 4, '#2b6b2c');
    stem(5, 0, 1.5, 'rgba(200,255,170,0.5)');
    const rnd = decoRand(7);
    for (let x = 10; x < w; x += 26) {
      const y = mid + Math.sin(x / 34) * 5;
      const up = rnd() > 0.5 ? -1 : 1;
      const len = 12 + rnd() * 8;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(up * (0.5 + rnd() * 0.6));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.5, -len * 0.45, len, 0);
      ctx.quadraticCurveTo(len * 0.5, len * 0.45, 0, 0);
      const lg = ctx.createLinearGradient(0, 0, len, 0);
      lg.addColorStop(0, '#2f7a2c');
      lg.addColorStop(1, '#8ee36a');
      ctx.fillStyle = lg;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(1, 0);
      ctx.lineTo(len - 2, 0);
      ctx.strokeStyle = 'rgba(20,60,20,0.6)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
      if (rnd() > 0.7) {
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(x + 6 + Math.cos(a) * 3, y - up * 7 + Math.sin(a) * 3, 2.4, 0, Math.PI * 2);
          ctx.fillStyle = '#ffd1ec';
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(x + 6, y - up * 7, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffcf3c';
        ctx.fill();
      }
    }
  });
}

// ---------------------------------------------------------------- backdrop and particles

function backgroundTexture(scene: Phaser.Scene, rimY: number): void {
  const w = L.width;
  const h = L.height;
  tex(scene, 'bg', w, h, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#120a2e');
    g.addColorStop(0.45, '#1d1146');
    g.addColorStop(0.8, '#2a1240');
    g.addColorStop(1, '#170a1e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const rnd = decoRand(11);
    for (let i = 0; i < 90; i++) {
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h * 0.7, rnd() * 1.2 + 0.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`;
      ctx.fill();
    }
    // moon
    const mx = w * 0.8;
    const my = 92;
    const mg = ctx.createRadialGradient(mx, my, 10, mx, my, 90);
    mg.addColorStop(0, 'rgba(255,230,180,0.35)');
    mg.addColorStop(1, 'rgba(255,230,180,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(mx - 90, my - 90, 180, 180);
    ctx.beginPath();
    ctx.arc(mx, my, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#fff1cf';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx + 9, my - 5, 19, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(29,17,70,0.9)';
    ctx.fill();
    // market skyline behind the baskets
    ctx.fillStyle = '#26103a';
    const base = rimY + 10;
    const dome = (x: number, r: number, hgt: number) => {
      ctx.fillRect(x - r, base - hgt, r * 2, hgt);
      ctx.beginPath();
      ctx.arc(x, base - hgt, r, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 2, base - hgt - r);
      ctx.lineTo(x, base - hgt - r - 12);
      ctx.lineTo(x + 2, base - hgt - r);
      ctx.fill();
    };
    dome(40, 22, 70);
    dome(120, 16, 110);
    dome(205, 30, 60);
    dome(290, 18, 95);
    dome(360, 26, 75);
    // lantern string glow
    for (let i = 0; i < 9; i++) {
      const x = 20 + i * 44;
      const y = base - 40 - Math.sin(i * 1.3) * 18;
      const lg = ctx.createRadialGradient(x, y, 1, x, y, 26);
      lg.addColorStop(0, 'rgba(255,170,70,0.55)');
      lg.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(x - 26, y - 26, 52, 52);
      ctx.beginPath();
      ctx.ellipse(x, y, 4, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb347';
      ctx.fill();
    }
    // rug under the baskets
    const ry = rimY + L.basketHeight - 8;
    const rug = ctx.createLinearGradient(0, ry, 0, h);
    rug.addColorStop(0, '#7a1f2b');
    rug.addColorStop(1, '#3d0d18');
    ctx.fillStyle = rug;
    ctx.fillRect(0, ry, w, h - ry);
    for (let y = ry + 8; y < h; y += 18) {
      ctx.fillStyle = 'rgba(255,190,90,0.18)';
      ctx.fillRect(0, y, w, 2);
      for (let x = 8; x < w; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, y + 9);
        ctx.lineTo(x + 5, y + 5);
        ctx.lineTo(x + 10, y + 9);
        ctx.lineTo(x + 5, y + 13);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,200,120,0.14)';
        ctx.fill();
      }
    }
    const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  });
}

function particleTextures(scene: Phaser.Scene): void {
  tex(scene, 'shard', 12, 12, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(12, 6);
    ctx.lineTo(6, 12);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });
  tex(scene, 'spark', 28, 28, (ctx) => {
    const g = ctx.createRadialGradient(14, 14, 0, 14, 14, 14);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 28, 28);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(15.5, 12.5);
    ctx.lineTo(28, 14);
    ctx.lineTo(15.5, 15.5);
    ctx.lineTo(14, 28);
    ctx.lineTo(12.5, 15.5);
    ctx.lineTo(0, 14);
    ctx.lineTo(12.5, 12.5);
    ctx.closePath();
    ctx.fill();
  });
  tex(scene, 'glow', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  tex(scene, 'ring', 64, 64, (ctx) => {
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 6;
    ctx.stroke();
  });
  tex(scene, 'note', 22, 26, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(7, 20, 6, 4.5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(11, 3, 2.4, 17);
    ctx.beginPath();
    ctx.moveTo(13, 3);
    ctx.quadraticCurveTo(21, 6, 19, 13);
    ctx.quadraticCurveTo(18, 8, 13, 9);
    ctx.fill();
  });
  tex(scene, 'dust', 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,240,220,0.8)');
    g.addColorStop(1, 'rgba(255,240,220,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  });
  tex(scene, 'beamH', 64, 24, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 24);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 24);
  });
  tex(scene, 'arrow', 24, 16, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(2, 2);
    ctx.lineTo(12, 13);
    ctx.lineTo(22, 2);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  });
}

/** Paint every texture once (re-entering a scene reuses them). */
export function buildArt(scene: Phaser.Scene, pitch: number, rimY: number): void {
  backgroundTexture(scene, rimY);
  vineTexture(scene);
  laneTextures(scene, pitch, rimY - L.vineY);
  basketTextures(scene, pitch);
  potTextures(scene);
  snakeTextures(scene);
  particleTextures(scene);
}

export function potKey(kind: 'plain' | 'gold' | 'wild', color: number): string {
  return kind === 'wild' ? 'wild' : kind === 'gold' ? `gold${color}` : `pot${color}`;
}
