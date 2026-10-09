import Phaser from 'phaser';
import { Sound } from '../audio';
import { CONFIG } from '../config';
import { bindHold } from '../input';
import { botChoice } from '../model/bot';
import { createGame, setHeld, stageTarget, step, type GameEvent, type GameState } from '../model/game';
import { loadSave, recordBest, writeSave } from '../storage';

const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
const L = CONFIG.layout;
const B = CONFIG.board;
const C = CONFIG.colors;
const F = CONFIG.feel;

const PITCH = (L.width - 2 * L.sidePad) / B.cols; // column pitch in px
const RIM_Y = L.vineY + B.rows * L.cell; // top of the baskets
const colX = (c: number) => L.sidePad + PITCH * (c + 0.5);
const rowY = (row: number) => RIM_Y - (row + 0.5) * L.cell;

interface DrawnPot {
  y: number;
  color: number;
}

/**
 * Renders the model in src/model/game.ts and routes input to it. Query flags: ?auto=1 lets the demo bot play,
 * ?seed=N replays a seed.
 */
export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private gfx!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;
  private muteText!: Phaser.GameObjects.Text;
  private sfx = new Sound();
  private drawnLift: number[] = [];
  private trackLift: number[] = [];
  private pots: DrawnPot[][] = [];
  private pops: { x: number; y: number; color: number; t: number }[] = [];
  private auto = false;
  private botTimer = 0;
  private overShown = false;

  constructor() {
    super('game');
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    this.auto = params.get('auto') === '1';
    const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9);
    this.state = createGame(seed, CONFIG);
    this.drawnLift = this.state.cols.map(() => 0);
    this.trackLift = this.state.cols.map(() => 0);
    this.pots = this.state.cols.map((col) => col.pots.map((color, i) => ({ y: rowY(i), color })));
    this.pops = [];
    this.overShown = false;
    this.botTimer = 0;

    this.gfx = this.add.graphics();
    this.fx = this.add.graphics();
    this.sfx.setMuted(loadSave().settings.muted === true);

    this.scoreText = this.add.text(L.sidePad, L.safeTop, '', {
      fontFamily: FONT,
      fontSize: '22px',
      color: C.text,
      fontStyle: 'bold',
    });
    this.stageText = this.add.text(L.sidePad, L.safeTop + 30, '', {
      fontFamily: FONT,
      fontSize: '14px',
      color: C.textDim,
    });
    this.muteText = this.add
      .text(L.width - L.sidePad, L.safeTop, '', { fontFamily: FONT, fontSize: '15px', color: C.textDim })
      .setOrigin(1, 0)
      .setPadding(12, 10, 0, 14)
      .setInteractive({ useHandCursor: true });
    this.muteText.on('pointerdown', () => this.toggleMute());
    this.updateMuteLabel();
    this.add
      .text(L.width / 2, L.height - L.safeBottom, 'hold a basket to charm its snake · line up 3', {
        fontFamily: FONT,
        fontSize: '13px',
        color: C.textDim,
      })
      .setOrigin(0.5, 1);

    bindHold(
      this,
      (x, y) => this.laneAt(x, y),
      (lane) => {
        if (this.auto || this.state.over) return;
        setHeld(this.state, lane);
        this.sfx.charm(lane);
      },
      B.cols,
    );
    this.events.once('shutdown', () => this.sfx.charm(null));
  }

  private laneAt(x: number, y: number): number | null {
    if (y < L.vineY - L.cell || y > RIM_Y + L.basketHeight + L.cell) return null;
    const c = Math.floor((x - L.sidePad) / PITCH);
    return Phaser.Math.Clamp(c, 0, B.cols - 1);
  }

  private toggleMute(): void {
    const save = loadSave();
    const muted = !(save.settings.muted === true);
    save.settings.muted = muted;
    writeSave(save);
    this.sfx.setMuted(muted);
    if (!muted && this.state.held !== null) this.sfx.charm(this.state.held);
    this.updateMuteLabel();
  }

  private updateMuteLabel(): void {
    this.muteText.setText(this.sfx.muted ? 'SOUND OFF' : 'SOUND ON');
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, F.maxFrameMs); // a background tab must not fast-forward the board
    if (this.auto && !this.state.over) {
      this.botTimer += dt;
      if (this.botTimer >= CONFIG.bot.thinkMs) {
        this.botTimer = 0;
        setHeld(this.state, botChoice(this.state, CONFIG));
      }
    }
    step(this.state, dt, CONFIG);
    for (const e of this.state.events) this.play(e);
    this.state.events = [];
    this.animate(dt);
    this.draw();
  }

  /** Mirror model events onto the drawn pots and fire effects. */
  private play(e: GameEvent): void {
    switch (e.type) {
      case 'move':
        this.trackLift[e.col] = e.lift;
        break;
      case 'drop':
        this.pots[e.col].push({ y: L.vineY - L.cell, color: e.color });
        this.sfx.thud();
        break;
      case 'clear': {
        for (let c = 0; c < B.cols; c++) {
          const idx = e.cells
            .filter((x) => x.col === c)
            .map((x) => x.row - this.trackLift[c])
            .sort((a, b) => b - a);
          for (const i of idx) this.pots[c].splice(i, 1);
        }
        for (const cell of e.cells) this.pops.push({ x: colX(cell.col), y: rowY(cell.row), color: cell.color, t: 0 });
        const mid = e.cells[Math.floor(e.cells.length / 2)];
        this.floatText(colX(mid.col), rowY(mid.row), e.chain > 1 ? `+${e.points}  x${e.chain}` : `+${e.points}`);
        this.sfx.pop(e.chain);
        break;
      }
      case 'stage':
        this.banner(`STAGE ${e.stage}`, `+${e.bonus}`);
        break;
      case 'over':
        this.sfx.charm(null);
        this.showGameOver();
        break;
    }
  }

  private animate(dt: number): void {
    const k = 1 - Math.pow(1 - F.liftLerp, dt / (1000 / 60));
    const fall = (L.cell * B.rows * dt) / F.dropFallMs;
    for (let c = 0; c < B.cols; c++) {
      this.drawnLift[c] += (this.state.cols[c].lift - this.drawnLift[c]) * k;
      // Safety net: if the mirror ever drifts from the model, resync it.
      const model = this.state.cols[c].pots;
      if (model.length !== this.pots[c].length || model.some((p, i) => p !== this.pots[c][i].color)) {
        this.pots[c] = model.map((color, i) => ({ y: this.pots[c][i]?.y ?? rowY(i), color }));
      }
      this.pots[c].forEach((p, i) => {
        const target = rowY(this.drawnLift[c] + i);
        p.y = p.y < target ? Math.min(target, p.y + fall) : target;
      });
    }
    this.pops = this.pops.filter((p) => (p.t += dt) < F.popMs);
  }

  private draw(): void {
    const g = this.gfx;
    const s = this.state;
    g.clear();
    const t = this.time.now / 1000;
    const laneW = PITCH - 6;

    // Column lanes, the held one lit; a nearly full one pulses red.
    for (let c = 0; c < B.cols; c++) {
      g.fillStyle(c === s.held ? C.columnHeld : C.column, 1);
      g.fillRoundedRect(colX(c) - laneW / 2, L.vineY, laneW, RIM_Y - L.vineY, 8);
      if (s.cols[c].pots.length >= B.rows - 1) {
        g.lineStyle(2, C.danger, 0.5 + 0.5 * Math.sin(t * 10));
        g.strokeRoundedRect(colX(c) - laneW / 2, L.vineY, laneW, RIM_Y - L.vineY, 8);
      }
    }

    // The vine across the top.
    g.lineStyle(6, C.vine, 1);
    g.beginPath();
    for (let x = 0; x <= L.width; x += 10) {
      const y = L.vineY - 4 + Math.sin(x / 30) * 3;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokePath();
    g.fillStyle(C.leaf, 1);
    for (let x = 15; x < L.width; x += 38) g.fillEllipse(x, L.vineY - 12 + Math.sin(x) * 3, 14, 7);

    // Snakes: a swaying neck from the basket to just under the bottom pot.
    const tailY = RIM_Y + L.basketHeight * 0.6;
    for (let c = 0; c < B.cols; c++) {
      const held = c === s.held;
      const x0 = colX(c);
      const headY = RIM_Y - this.drawnLift[c] * L.cell - 4;
      const sway = held ? 5 : 2;
      const body = held ? C.snakeHeld : C.snake;
      g.lineStyle(14, body, 1);
      g.beginPath();
      g.moveTo(x0, tailY);
      const steps = 8;
      for (let i = 1; i <= steps; i++) {
        const y = tailY + ((headY - tailY) * i) / steps;
        g.lineTo(x0 + Math.sin(t * 6 + i + c) * sway * (1 - i / steps), y);
      }
      g.strokePath();
      g.fillStyle(body, 1);
      g.fillEllipse(x0, headY, 26, 16);
      g.fillStyle(C.background, 1);
      g.fillCircle(x0 - 6, headY - 2, 2.2);
      g.fillCircle(x0 + 6, headY - 2, 2.2);
    }

    for (let c = 0; c < B.cols; c++) {
      for (const p of this.pots[c]) this.drawPot(g, colX(c), p.y, p.color);
    }

    // Baskets in front of the snakes' tails.
    for (let c = 0; c < B.cols; c++) {
      const x0 = colX(c);
      const w = PITCH - 10;
      g.fillStyle(C.basket, 1);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(x0 - w / 2, RIM_Y),
          new Phaser.Math.Vector2(x0 + w / 2, RIM_Y),
          new Phaser.Math.Vector2(x0 + w / 2 - 8, RIM_Y + L.basketHeight),
          new Phaser.Math.Vector2(x0 - w / 2 + 8, RIM_Y + L.basketHeight),
        ],
        true,
      );
      g.lineStyle(2, C.basketRim, 0.6);
      for (let k = 1; k < 4; k++) g.lineBetween(x0 - w / 2 + 3, RIM_Y + k * 13, x0 + w / 2 - 3, RIM_Y + k * 13);
      g.fillStyle(C.basketRim, 1);
      g.fillRoundedRect(x0 - w / 2 - 3, RIM_Y - 4, w + 6, 9, 4);
    }

    // Clear pops.
    const fx = this.fx;
    fx.clear();
    for (const p of this.pops) {
      const k = p.t / F.popMs;
      fx.lineStyle(4 * (1 - k), C.pots[p.color], 1 - k);
      fx.strokeCircle(p.x, p.y, L.potWidth * 0.4 + k * L.cell * 0.6);
    }

    // HUD: score, stage, progress to the next stage.
    const target = stageTarget(s.stage, CONFIG);
    this.scoreText.setText(`${s.score}`);
    this.stageText.setText(`STAGE ${s.stage}   ${s.stageCleared}/${target} pots${this.auto ? '   DEMO' : ''}`);
    const barW = L.width - 2 * L.sidePad;
    const barY = L.vineY - 34;
    g.fillStyle(C.panel, 1);
    g.fillRoundedRect(L.sidePad, barY, barW, 6, 3);
    g.fillStyle(C.accent, 1);
    g.fillRoundedRect(L.sidePad, barY, Math.max(6, (barW * s.stageCleared) / target), 6, 3);
  }

  private drawPot(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number): void {
    const w = L.potWidth;
    const h = L.potHeight;
    g.fillStyle(C.pots[color], 1);
    g.fillRoundedRect(x - w / 2, y - h / 2 + 6, w, h - 6, 12);
    g.fillRoundedRect(x - w * 0.32, y - h / 2, w * 0.64, 10, 4);
    g.fillStyle(0xffffff, 0.18);
    g.fillRoundedRect(x - w / 2 + 6, y - h / 2 + 10, 8, h - 18, 4);
    // A glyph per colour so the board reads without colour vision.
    g.fillStyle(0x000000, 0.35);
    const r = 8;
    const cy = y + 3;
    switch (color) {
      case 0:
        g.fillCircle(x, cy, r);
        break;
      case 1:
        g.fillTriangle(x, cy - r, x - r, cy + r * 0.8, x + r, cy + r * 0.8);
        break;
      case 2:
        g.fillRect(x - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6);
        break;
      case 3:
        g.fillPoints(
          [
            new Phaser.Math.Vector2(x, cy - r),
            new Phaser.Math.Vector2(x + r, cy),
            new Phaser.Math.Vector2(x, cy + r),
            new Phaser.Math.Vector2(x - r, cy),
          ],
          true,
        );
        break;
      case 4:
        g.fillRect(x - r, cy - r * 0.3, r * 2, r * 0.6);
        g.fillRect(x - r * 0.3, cy - r, r * 0.6, r * 2);
        break;
      default:
        g.fillRect(x - r, cy - r * 0.35, r * 2, r * 0.7);
    }
  }

  private floatText(x: number, y: number, msg: string): void {
    const txt = this.add
      .text(x, y, msg, { fontFamily: FONT, fontSize: '20px', color: C.text, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setStroke('#000000', 4);
    this.tweens.add({
      targets: txt,
      y: y - L.cell,
      alpha: 0,
      duration: F.floatTextMs,
      ease: 'Quad.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  private banner(title: string, sub: string): void {
    const txt = this.add
      .text(L.width / 2, L.height * 0.4, `${title}\n${sub}`, {
        fontFamily: FONT,
        fontSize: '34px',
        color: C.text,
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5)
      .setStroke('#000000', 6);
    this.tweens.add({
      targets: txt,
      scale: { from: 0.6, to: 1 },
      alpha: { from: 1, to: 0 },
      duration: F.floatTextMs * 2,
      ease: 'Quad.easeIn',
      onComplete: () => txt.destroy(),
    });
  }

  private showGameOver(): void {
    if (this.overShown) return;
    this.overShown = true;
    const best = this.auto ? loadSave().best : recordBest(this.state.score);
    const panel = this.add.rectangle(L.width / 2, L.height / 2, L.width - 60, 260, C.panel, 0.95);
    panel.setStrokeStyle(2, C.accent);
    this.add
      .text(
        L.width / 2,
        L.height / 2 - 100,
        `A LID FELL ON A FULL BASKET\n\n${this.state.score}\nBEST ${best} · STAGE ${this.state.stage}`,
        { fontFamily: FONT, fontSize: '18px', color: C.text, align: 'center', fontStyle: 'bold' },
      )
      .setOrigin(0.5, 0);
    const again = this.add
      .text(L.width / 2, L.height / 2 + 80, 'TAP TO PLAY AGAIN', {
        fontFamily: FONT,
        fontSize: '22px',
        color: C.text,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: again, alpha: { from: 1, to: 0.35 }, duration: 650, yoyo: true, repeat: -1 });
    // A short guard so the finger that was holding a basket does not restart the game instantly.
    this.time.delayedCall(F.restartGuardMs, () => {
      this.input.once('pointerdown', () => this.scene.restart());
      this.input.keyboard?.once('keydown-SPACE', () => this.scene.restart());
      if (this.auto) this.time.delayedCall(F.restartGuardMs * 3, () => this.scene.restart());
    });
  }
}
