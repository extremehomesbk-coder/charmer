import Phaser from 'phaser';
import { buildArt, potKey } from '../art';
import { Sound } from '../audio';
import { CONFIG } from '../config';
import { bindHold } from '../input';
import { botChoice } from '../model/bot';
import {
  createGame,
  msToDrop,
  setHeld,
  stageTarget,
  step,
  type Cell,
  type GameEvent,
  type GameState,
  type Pot,
} from '../model/game';
import { loadSave, recordBest, writeSave } from '../storage';
import { designCamera, gradientFill, label } from '../ui';

const L = CONFIG.layout;
const B = CONFIG.board;
const C = CONFIG.colors;
const F = CONFIG.feel;
const A = CONFIG.art;
const R = L.renderScale;

const PITCH = (L.width - 2 * L.sidePad) / B.cols; // column pitch in px
const RIM_Y = L.vineY + B.rows * L.cell; // top of the baskets
const colX = (c: number) => L.sidePad + PITCH * (c + 0.5);
const rowY = (row: number) => RIM_Y - (row + 0.5) * L.cell;

const DEPTH = {
  bg: 0,
  lane: 2,
  beam: 3,
  basketBack: 5,
  snake: 6,
  pot: 7,
  vine: 8,
  ghost: 9,
  basket: 10,
  fx: 12,
  hud: 20,
  overlay: 30,
  panel: 31,
};

const COMBO_WORDS = ['', '', 'NICE!', 'GREAT!', 'AMAZING!', 'CHARMING!!'];

interface PotSprite {
  img: Phaser.GameObjects.Image;
  vy: number;
  landed: boolean;
}

interface Snake {
  segs: Phaser.GameObjects.Image[];
  head: Phaser.GameObjects.Image;
  tongue: Phaser.GameObjects.Image;
}

/** Colour a pot shows in effects (gold pots glow gold, wild pots pick a bright colour). */
function potTint(p: Pot): number {
  if (p.kind === 'gold') return C.gold;
  if (p.kind === 'wild') return C.pots[p.id % C.pots.length];
  return C.pots[p.color];
}

/**
 * Renders the model in src/model/game.ts and routes input to it. Query flags: ?auto=1 lets the demo bot play,
 * ?seed=N replays a seed.
 */
export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private sfx = new Sound();
  private auto = false;
  private botTimer = 0;
  private overShown = false;

  private drawnLift: number[] = [];
  private pots = new Map<number, PotSprite>();
  private snakes: Snake[] = [];
  private beams: Phaser.GameObjects.Image[] = [];
  private dangers: Phaser.GameObjects.Image[] = [];
  private baskets: Phaser.GameObjects.Image[] = [];
  private ghost!: Phaser.GameObjects.Image;
  private arrow!: Phaser.GameObjects.Image;
  private shards!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private notes!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hud!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;
  private feverText!: Phaser.GameObjects.Text;
  private muteText!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Rectangle;
  private shownScore = 0;
  private noteTimer = 0;

  constructor() {
    super('game');
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    this.auto = params.get('auto') === '1';
    const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9);
    this.state = createGame(seed, CONFIG);
    this.drawnLift = this.state.cols.map(() => 0);
    this.pots = new Map();
    this.snakes = [];
    this.beams = [];
    this.dangers = [];
    this.baskets = [];
    this.overShown = false;
    this.botTimer = 0;
    this.shownScore = 0;

    buildArt(this, PITCH, RIM_Y);
    designCamera(this);
    this.sfx.setMuted(loadSave().settings.muted === true);

    this.add
      .image(0, 0, 'bg')
      .setOrigin(0)
      .setScale(1 / R)
      .setDepth(DEPTH.bg);
    this.add
      .particles(0, 0, 'spark', {
        x: { min: 0, max: L.width },
        y: { min: L.vineY, max: RIM_Y },
        lifespan: 5000,
        speedY: { min: -12, max: -4 },
        speedX: { min: -6, max: 6 },
        scale: { start: 0.18, end: 0.05 },
        alpha: { start: 0.8, end: 0 },
        tint: [0xfff3a0, 0xb8ff9a, 0xffd0f0],
        frequency: 380,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(DEPTH.lane);

    for (let c = 0; c < B.cols; c++) {
      const x = colX(c);
      this.add
        .image(x, L.vineY, 'lane')
        .setOrigin(0.5, 0)
        .setScale(1 / R)
        .setDepth(DEPTH.lane);
      this.beams.push(
        this.add
          .image(x, L.vineY, 'beam')
          .setOrigin(0.5, 0)
          .setScale(1 / R)
          .setAlpha(0)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(DEPTH.beam),
      );
      this.dangers.push(
        this.add
          .image(x, L.vineY, 'danger')
          .setOrigin(0.5, 0)
          .setScale(1 / R)
          .setAlpha(0)
          .setDepth(DEPTH.beam),
      );
      this.add
        .image(x, RIM_Y, 'basketBack')
        .setScale(1 / R)
        .setDepth(DEPTH.basketBack);
      this.baskets.push(
        this.add
          .image(x, RIM_Y - 6, 'basket')
          .setOrigin(0.5, 0)
          .setScale(1 / R)
          .setDepth(DEPTH.basket),
      );
      const segs = Array.from({ length: Math.ceil((L.cell * B.maxLift + L.basketHeight) / A.segmentSpacing) + 2 }, () =>
        this.add
          .image(x, RIM_Y, 'seg')
          .setScale(1 / R)
          .setDepth(DEPTH.snake)
          .setVisible(false),
      );
      const head = this.add
        .image(x, RIM_Y, 'head')
        .setScale(1 / R)
        .setDepth(DEPTH.snake + 0.5);
      const tongue = this.add
        .image(x, RIM_Y, 'tongue')
        .setOrigin(0.5, 0)
        .setScale(1 / R)
        .setDepth(DEPTH.snake + 0.4)
        .setVisible(false);
      this.snakes.push({ segs, head, tongue });
    }
    this.add
      .image(0, L.vineY - A.vineHeight / 2 + 2, 'vine')
      .setOrigin(0, 0)
      .setScale(1 / R)
      .setDepth(DEPTH.vine);

    this.ghost = this.add
      .image(0, 0, 'pot0')
      .setScale(1 / R)
      .setDepth(DEPTH.ghost)
      .setVisible(false);
    this.arrow = this.add
      .image(0, 0, 'arrow')
      .setScale(1 / R)
      .setDepth(DEPTH.ghost)
      .setVisible(false);

    const fx = (key: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) =>
      this.add.particles(0, 0, key, { emitting: false, ...cfg }).setDepth(DEPTH.fx);
    this.shards = fx('shard', {
      speed: { min: 120, max: 320 },
      angle: { min: 0, max: 360 },
      rotate: { min: 0, max: 360 },
      gravityY: 600,
      lifespan: { min: 450, max: 800 },
      scale: { start: 0.5, end: 0.1 },
      alpha: { start: 1, end: 0 },
    });
    this.sparks = fx('spark', {
      speed: { min: 30, max: 140 },
      lifespan: { min: 300, max: 600 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
    });
    this.dust = fx('dust', {
      speedX: { min: -60, max: 60 },
      speedY: { min: -30, max: -5 },
      lifespan: 350,
      scale: { start: 0.6, end: 1.4 },
      alpha: { start: 0.6, end: 0 },
    });
    this.notes = fx('note', {
      speedY: { min: -90, max: -60 },
      speedX: { min: -25, max: 25 },
      lifespan: 1100,
      scale: { start: 0.45, end: 0.25 },
      alpha: { start: 1, end: 0 },
      rotate: { min: -20, max: 20 },
    });

    this.overlay = this.add
      .rectangle(L.width / 2, L.height / 2, L.width, L.height, C.fever, 1)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.overlay - 1);

    // HUD
    this.hud = this.add.graphics().setDepth(DEPTH.hud);
    this.scoreText = label(this, L.width / 2, L.safeTop + 2, '0', 38, { stroke: 6, shadow: true })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.hud);
    gradientFill(this.scoreText, '#fff7d6', '#ffc23d');
    this.stageText = label(this, L.sidePad, L.safeTop + 12, '', 13, { color: '#d9ccff' }).setDepth(DEPTH.hud);
    this.feverText = label(this, L.width / 2, L.vineY - 40, 'FEVER', 11, { color: '#f2d9ff' })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 1);
    this.muteText = label(this, L.width - L.sidePad, L.safeTop + 12, '', 13, { color: '#d9ccff' })
      .setOrigin(1, 0)
      .setPadding(14, 12, 0, 14)
      .setDepth(DEPTH.hud)
      .setInteractive({ useHandCursor: true });
    this.muteText.on('pointerdown', () => this.toggleMute());
    this.updateMuteLabel();
    label(this, L.width / 2, L.height - L.safeBottom, 'hold a basket · line up 3', 13, { color: '#e7c7a0' })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.hud);

    for (const [c, col] of this.state.cols.entries()) col.pots.forEach((p, i) => this.spawnPot(p, c, rowY(i), true));

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
    this.cameras.main.fadeIn(250, 10, 4, 25);
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
    this.drawHud();
  }

  // ------------------------------------------------------------ events

  private play(e: GameEvent): void {
    switch (e.type) {
      case 'move':
        break;
      case 'drop':
        this.spawnPot(e.pot, e.col, L.vineY + 6, false);
        break;
      case 'clear':
        this.clearFx(e.cells, e.chain, e.points, e.longest, e.blastRows);
        break;
      case 'stage':
        this.sfx.stage();
        this.banner(`STAGE ${e.stage}`, `+${e.bonus}`, '#ffffff', '#9fd8ff');
        this.confetti();
        break;
      case 'fever':
        if (e.on) {
          this.sfx.fanfare();
          this.banner('FEVER!', 'lids stop · points x2', '#ffe9ff', '#d36bff');
          this.cameras.main.flash(180, 220, 120, 255);
        }
        break;
      case 'over':
        this.sfx.charm(null);
        this.showGameOver();
        break;
    }
  }

  private spawnPot(p: Pot, c: number, y: number, landed: boolean): void {
    const img = this.add
      .image(colX(c), y, potKey(p.kind, p.color))
      .setScale(1 / R)
      .setDepth(DEPTH.pot);
    if (!landed) {
      img.setScale(0.6 / R);
      this.tweens.add({ targets: img, scale: 1 / R, duration: 150, ease: 'Back.easeOut' });
    }
    this.pots.set(p.id, { img, vy: 0, landed });
  }

  private clearFx(cells: Cell[], chain: number, points: number, longest: number, blastRows: number[]): void {
    let sx = 0;
    let sy = 0;
    for (const cell of cells) {
      const x = colX(cell.col);
      const y = rowY(cell.row);
      sx += x;
      sy += y;
      const tint = potTint(cell.pot);
      const ps = this.pots.get(cell.pot.id);
      this.pots.delete(cell.pot.id);
      if (ps) {
        ps.img.setTintFill(0xffffff).setDepth(DEPTH.fx);
        this.tweens.add({
          targets: ps.img,
          scale: 1.35 / R,
          alpha: 0,
          duration: F.popMs,
          ease: 'Quad.easeOut',
          onComplete: () => ps.img.destroy(),
        });
      }
      this.shards.setParticleTint(tint);
      this.shards.explode(10, x, y);
      this.sparks.setParticleTint(tint);
      this.sparks.explode(3, x, y);
      const ring = this.add
        .image(x, y, 'ring')
        .setTint(tint)
        .setScale(0.3)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.fx);
      this.tweens.add({
        targets: ring,
        scale: 1.1,
        alpha: 0,
        duration: F.popMs * 1.6,
        ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
      });
    }
    for (const row of blastRows) {
      const beam = this.add
        .image(L.width / 2, rowY(row), 'beamH')
        .setTint(C.gold)
        .setDisplaySize(L.width * 0.2, L.cell * 1.2)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.fx);
      this.tweens.add({
        targets: beam,
        displayWidth: L.width * 1.2,
        alpha: { from: 1, to: 0 },
        duration: 450,
        ease: 'Cubic.easeOut',
        onComplete: () => beam.destroy(),
      });
      this.sfx.blast();
    }
    const n = cells.length;
    const cx = sx / n;
    const cy = sy / n;
    this.floatText(cx, cy, `+${points}`);
    this.sfx.pop(chain);
    const big = chain >= 2 || blastRows.length > 0 || longest >= 4;
    if (big) {
      this.cameras.main.shake(F.shakeMs, F.shake * Math.min(chain + blastRows.length, 4));
      const word =
        blastRows.length > 0
          ? 'GOLDEN!'
          : chain >= 2
            ? `${COMBO_WORDS[Math.min(chain, COMBO_WORDS.length - 1)]} x${chain}`
            : longest >= 5
              ? 'FIVE IN A ROW!'
              : 'FOUR IN A ROW!';
      this.comboWord(cx, cy - L.cell, word);
    }
  }

  // ------------------------------------------------------------ per-frame visuals

  private animate(dt: number): void {
    const s = this.state;
    const t = this.time.now / 1000;
    const k = 1 - Math.pow(1 - F.liftLerp, dt / (1000 / 60));
    const fever = s.feverTime > 0;

    const alive = new Set<number>();
    for (let c = 0; c < B.cols; c++) {
      const col = s.cols[c];
      const held = c === s.held;
      this.drawnLift[c] += (col.lift - this.drawnLift[c]) * k;
      const sway = held ? Math.sin(t * 7 + c) * 1.6 : 0;

      // pots: fall under gravity onto the stack, follow the lift, squash on landing
      col.pots.forEach((p, i) => {
        alive.add(p.id);
        let ps = this.pots.get(p.id);
        if (!ps) {
          this.spawnPot(p, c, rowY(this.drawnLift[c] + i), true);
          ps = this.pots.get(p.id) as PotSprite;
        }
        const target = rowY(this.drawnLift[c] + i);
        const img = ps.img;
        img.x = colX(c) + sway * (1 + i * 0.25);
        if (img.y < target - 0.5) {
          ps.vy += F.gravity * dt;
          img.y = Math.min(target, img.y + ps.vy * dt);
          ps.landed = false;
        } else {
          if (!ps.landed && ps.vy > 0.2) this.land(ps, colX(c), target);
          ps.landed = true;
          ps.vy = 0;
          img.y = target;
        }
      });

      // snake neck from the basket to just under the bottom pot
      const sn = this.snakes[c];
      const tint = fever
        ? Phaser.Display.Color.HSVToRGB((t * 0.5 + c * 0.15) % 1, 0.5, 1).color
        : held
          ? C.snakeHeld
          : C.snake;
      const tailY = RIM_Y + L.basketHeight * 0.55;
      const headY = RIM_Y - this.drawnLift[c] * L.cell - (col.pots.length ? 2 : 10 + Math.sin(t * 2 + c) * 3);
      const len = tailY - headY;
      const n = Math.max(2, Math.ceil(len / A.segmentSpacing));
      const amp = held ? 6 : 2.5;
      sn.segs.forEach((seg, i) => {
        if (i > n) {
          seg.setVisible(false);
          return;
        }
        const f = i / n;
        seg
          .setVisible(true)
          .setPosition(
            colX(c) + Math.sin(t * (held ? 8 : 3) - f * 5 + c) * amp * Math.sin(f * Math.PI),
            tailY - len * f,
          )
          .setTint(tint);
      });
      sn.head.setPosition(colX(c) + sway, headY - 4).setTint(tint);
      sn.head.scaleX = (1 / R) * (held ? 1.12 + Math.sin(t * 8) * 0.04 : 1);
      const flick = col.pots.length === 0 && (t * 1000) % F.tongueEveryMs < 180;
      sn.tongue.setVisible(flick).setPosition(sn.head.x, sn.head.y + 9);

      // lane glow and danger
      const beam = this.beams[c];
      beam.alpha += ((held ? 1 : fever ? 0.35 : 0) - beam.alpha) * k;
      const nearFull = col.pots.length >= B.rows - 1;
      this.dangers[c].alpha = nearFull ? 0.5 + 0.5 * Math.sin(t * 12) : 0;
      this.baskets[c].x = colX(c) + (nearFull ? Math.sin(t * 40) * 1.2 : 0);
    }
    for (const [id, ps] of this.pots) {
      if (!alive.has(id)) {
        ps.img.destroy();
        this.pots.delete(id);
      }
    }

    // where the next lid lands
    const ms = msToDrop(s, CONFIG);
    if (!s.over && ms < CONFIG.pace.warnMs) {
      const { col, pot } = s.nextDrop;
      const doom = s.cols[col].pots.length >= B.rows;
      const pulse = 0.5 + 0.5 * Math.sin(t * 14);
      this.ghost
        .setVisible(true)
        .setTexture(potKey(pot.kind, pot.color))
        .setPosition(colX(col), L.vineY + 26)
        .setAlpha(0.25 + 0.35 * pulse);
      if (doom) this.ghost.setTint(C.danger);
      else this.ghost.clearTint();
      this.arrow
        .setVisible(true)
        .setPosition(colX(col), L.vineY + 56 + pulse * 6)
        .setTint(doom ? C.danger : 0xffffff)
        .setAlpha(0.8);
    } else {
      this.ghost.setVisible(false);
      this.arrow.setVisible(false);
    }

    // music notes from the charmed basket
    if (s.held !== null && !s.over) {
      this.noteTimer += dt;
      if (this.noteTimer >= F.noteEveryMs) {
        this.noteTimer = 0;
        this.notes.setParticleTint(Phaser.Utils.Array.GetRandom([0xffe27a, 0xffffff, 0xffb3e6, 0x9be7ff]));
        this.notes.emitParticleAt(colX(s.held) + Phaser.Math.Between(-14, 14), RIM_Y + 18);
      }
    }

    this.overlay.alpha += ((fever ? 0.07 + 0.03 * Math.sin(t * 6) : 0) - this.overlay.alpha) * k;
  }

  private land(ps: PotSprite, x: number, y: number): void {
    this.tweens.add({
      targets: ps.img,
      scaleY: { from: 0.78 / R, to: 1 / R },
      scaleX: { from: 1.16 / R, to: 1 / R },
      duration: F.squashMs,
      ease: 'Back.easeOut',
    });
    this.dust.explode(5, x, y + L.potHeight / 2);
    this.sfx.thud();
  }

  private drawHud(): void {
    const s = this.state;
    const g = this.hud;
    g.clear();
    this.shownScore += (s.score - this.shownScore) * Math.min(1, (1000 / 60 / F.scoreCountMs) * 4);
    if (Math.abs(s.score - this.shownScore) < 1) this.shownScore = s.score;
    this.scoreText.setText(`${Math.round(this.shownScore)}`);
    const target = stageTarget(s.stage, CONFIG);
    this.stageText.setText(`STAGE ${s.stage}${this.auto ? '  DEMO' : ''}`);

    // stage progress (thin) and fever meter (thick, glowing when full)
    const x = L.sidePad + 40;
    const w = L.width - 2 * x;
    const y1 = L.vineY - 58;
    g.fillStyle(0x000000, 0.35).fillRoundedRect(x, y1, w, 5, 2.5);
    g.fillStyle(0x7fd3ff, 1).fillRoundedRect(x, y1, Math.max(5, (w * s.stageCleared) / target), 5, 2.5);
    const y2 = L.vineY - 46;
    const fever = s.feverTime > 0;
    const fill = fever ? s.feverTime / CONFIG.fever.durationMs : s.fever;
    g.fillStyle(0x000000, 0.4).fillRoundedRect(x, y2, w, 12, 6);
    if (fill > 0.01) {
      const t = this.time.now / 1000;
      const col = fever ? Phaser.Display.Color.HSVToRGB((t * 0.8) % 1, 0.55, 1).color : C.fever;
      g.fillStyle(col, 1).fillRoundedRect(x, y2, Math.max(12, w * fill), 12, 6);
      g.fillStyle(0xffffff, 0.35).fillRoundedRect(x + 3, y2 + 2, Math.max(6, w * fill - 6), 3, 1.5);
    }
    g.lineStyle(1, 0xffffff, 0.25).strokeRoundedRect(x, y2, w, 12, 6);
    this.feverText.setPosition(L.width / 2, y2 + 6).setText(fever ? 'FEVER!' : 'FEVER');
  }

  // ------------------------------------------------------------ text effects

  private floatText(x: number, y: number, msg: string): void {
    const txt = label(this, x, y, msg, 22, { stroke: 5 })
      .setOrigin(0.5)
      .setDepth(DEPTH.fx + 1);
    this.tweens.add({
      targets: txt,
      y: y - L.cell * 1.2,
      alpha: { from: 1, to: 0 },
      duration: F.floatTextMs,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  private comboWord(x: number, y: number, word: string): void {
    const txt = label(this, Phaser.Math.Clamp(x, 110, L.width - 110), y, word, 30, { stroke: 7, shadow: true })
      .setOrigin(0.5)
      .setDepth(DEPTH.fx + 2)
      .setAngle(Phaser.Math.Between(-6, 6));
    gradientFill(txt, '#fffbe0', '#ff9d2e');
    this.tweens.add({
      targets: txt,
      scale: { from: 0.3, to: 1 },
      duration: 220,
      ease: 'Back.easeOut',
      onComplete: () =>
        this.tweens.add({
          targets: txt,
          y: y - 30,
          alpha: 0,
          delay: 350,
          duration: 400,
          onComplete: () => txt.destroy(),
        }),
    });
  }

  private banner(title: string, sub: string, top: string, bottom: string): void {
    const t1 = label(this, L.width / 2, L.height * 0.4, title, 52, { stroke: 9, shadow: true })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay);
    gradientFill(t1, top, bottom);
    const t2 = label(this, L.width / 2, L.height * 0.4 + 44, sub, 18, { stroke: 5 })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay);
    this.tweens.add({ targets: [t1, t2], scale: { from: 0.4, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: [t1, t2],
      alpha: 0,
      y: '-=30',
      delay: 900,
      duration: 400,
      onComplete: () => {
        t1.destroy();
        t2.destroy();
      },
    });
  }

  private confetti(): void {
    for (let i = 0; i < 6; i++) {
      this.shards.setParticleTint(C.pots[i % C.pots.length]);
      this.shards.explode(12, Phaser.Math.Between(40, L.width - 40), L.vineY);
    }
  }

  private showGameOver(): void {
    if (this.overShown) return;
    this.overShown = true;
    const s = this.state;
    const prevBest = loadSave().best;
    const best = this.auto ? prevBest : recordBest(s.score);
    const newBest = !this.auto && s.score > prevBest && s.score > 0;
    this.cameras.main.shake(260, 0.01);
    for (const ps of this.pots.values()) ps.img.setTint(0x777777);

    const dim = this.add.rectangle(L.width / 2, L.height / 2, L.width, L.height, 0x07030f, 0).setDepth(DEPTH.panel);
    this.tweens.add({ targets: dim, fillAlpha: 0.65, duration: 400 });
    const card = this.add.container(L.width / 2, L.height / 2).setDepth(DEPTH.panel + 1);
    const g = this.add.graphics();
    const w = L.width - 60;
    const h = 330;
    g.fillStyle(0x2a1550, 0.97).fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    g.lineStyle(3, C.gold, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
    g.lineStyle(1, 0xffffff, 0.15).strokeRoundedRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 16);
    const title = label(this, 0, -h / 2 + 34, 'THE BASKET OVERFLOWED', 17, { color: '#ffb3c7' }).setOrigin(0.5);
    const score = label(this, 0, -60, `${s.score}`, 60, { stroke: 8, shadow: true }).setOrigin(0.5);
    gradientFill(score, '#fff7d6', '#ffb02e');
    const stats = label(
      this,
      0,
      10,
      `BEST ${best}\nSTAGE ${s.stage}  ·  ${s.totalCleared} POTS  ·  BEST COMBO x${Math.max(1, s.bestChain)}`,
      14,
      { color: '#e6dcff', align: 'center' },
    ).setOrigin(0.5, 0);
    const again = label(this, 0, h / 2 - 50, 'TAP TO PLAY AGAIN', 22, { stroke: 5 }).setOrigin(0.5);
    card.add([g, title, score, stats, again]);
    if (newBest) {
      const nb = label(this, 0, -112, 'NEW BEST!', 22, { stroke: 5 }).setOrigin(0.5).setAngle(-4);
      gradientFill(nb, '#ffffff', '#7dfcb0');
      card.add(nb);
      this.tweens.add({ targets: nb, scale: { from: 1, to: 1.12 }, yoyo: true, repeat: -1, duration: 420 });
      this.confetti();
    }
    card.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut', delay: 150 });
    this.tweens.add({ targets: again, alpha: { from: 1, to: 0.35 }, duration: 650, yoyo: true, repeat: -1 });
    // A short guard so the finger that was holding a basket does not restart the game instantly.
    this.time.delayedCall(F.restartGuardMs, () => {
      const restart = () => this.cameras.main.fadeOut(200, 10, 4, 25);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart());
      this.input.once('pointerdown', restart);
      this.input.keyboard?.once('keydown-SPACE', restart);
      if (this.auto) this.time.delayedCall(F.restartGuardMs * 3, restart);
    });
  }
}
