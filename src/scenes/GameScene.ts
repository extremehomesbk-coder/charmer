import Phaser from 'phaser';
import { buildArt, vineCurve } from '../art';
import { Sound } from '../audio';
import { CONFIG } from '../config';
import { bindHold } from '../input';
import { botChoice } from '../model/bot';
import {
  bankFlowers,
  canContinue,
  payContinue,
  recordCharm,
  SNAKE_NAMES,
  tamedKinds,
  tameThreshold,
  type Theme,
} from '../meta';
import {
  createGame,
  isNight,
  revive,
  setHeld,
  step,
  type GameEvent,
  type GameState,
  type Pot,
  type SnakeKind,
} from '../model/game';
import { buildShareCard, shareCard } from '../share';
import { loadSave, recordBest, updateSave, writeSave, type SaveData } from '../storage';
import { button, designCamera, flowerPill, gradientFill, label, panel, snakeFace, type Button } from '../ui';

const L = CONFIG.layout;
const F = CONFIG.feel;
const A = CONFIG.art;
const C = CONFIG.colors;
const R = L.renderScale;
const LANES = CONFIG.board.lanes;
const TAU = Math.PI * 2;

export const PITCH = (L.width - 2 * L.sidePad) / LANES;
export const laneX = (i: number) => L.sidePad + PITCH * (i + 0.5);
const HUNG_BOTTOM = L.lidTop + L.lidHeight;
const CLIMB = L.rimY - HUNG_BOTTOM; // px from the rim to a hanging lid: height 1 in the model
const headTopAt = (h: number) => L.rimY - h * CLIMB;
const lidTopAt = (y: number) => L.rimY - y * CLIMB - L.lidHeight;
export const POT_TOP = L.rimY - 9; // the pot textures put the rim's centre line 9 px below their top
const TAIL_Y = L.rimY + 40; // where a snake's body starts, hidden inside its pot
const ROPE_POINTS = 36;

/** Ambient particles for a theme: fireflies at dusk, rain in the monsoon, dust motes at noon. */
export function weather(scene: Phaser.Scene, theme: Theme, depth: number): void {
  const kind = CONFIG.skins.themes[theme]?.weather ?? 'fireflies';
  if (kind === 'rain') {
    scene.add
      .particles(0, 0, 'rain', {
        x: { min: -40, max: L.width + 40 },
        y: -20,
        lifespan: 1100,
        speedY: { min: 520, max: 680 },
        speedX: { min: -70, max: -40 },
        scale: { start: 0.6 / R, end: 0.6 / R },
        alpha: { start: 0.55, end: 0.2 },
        rotate: 6,
        frequency: 22,
      })
      .setDepth(depth);
    return;
  }
  scene.add
    .particles(0, 0, 'spark', {
      x: { min: 0, max: L.width },
      y: { min: kind === 'dust' ? 150 : 300, max: L.rimY },
      lifespan: 6000,
      speedY: { min: -10, max: -3 },
      speedX: { min: -8, max: 8 },
      scale: { start: kind === 'dust' ? 0.18 : 0.25, end: 0.05 },
      alpha: { start: kind === 'dust' ? 0.5 : 0.9, end: 0 },
      tint: kind === 'dust' ? [0xfff3d0, 0xffe0a0] : [0xfff3a0, 0xffd27a, 0xb8ff9a],
      frequency: kind === 'dust' ? 300 : 450,
      blendMode: Phaser.BlendModes.ADD,
    })
    .setDepth(depth);
}

function nightNow(params: URLSearchParams): boolean {
  const flag = params.get('night');
  if (flag === '1') return true;
  if (flag === '0') return false;
  return isNight(new Date().getHours(), CONFIG);
}

const DEPTH = {
  bg: 0,
  ambient: 1,
  beam: 2,
  potShadow: 3,
  potBack: 4,
  body: 5,
  head: 6,
  potFront: 7,
  lidShadow: 8,
  lid: 9,
  tendril: 10,
  vine: 11,
  bloom: 12,
  pungi: 13,
  fx: 14,
  text: 15,
  hud: 20,
  overlay: 30,
};

const COMBO_WORDS = ['', '', 'NICE!', 'SWEET!', 'CHARMING!', 'DAZZLING!'];
const NOTE_TINTS = [0xffe27a, 0xffffff, 0xffb3e6, 0x9be7ff, 0xb8ffb0];
const EYE_X = 8.5;
const EYE_Y = 15;

interface LaneView {
  i: number;
  x: number;
  kind: SnakeKind;
  shadow: Phaser.GameObjects.Image;
  back: Phaser.GameObjects.Image;
  front: Phaser.GameObjects.Image;
  rope: Phaser.GameObjects.Rope;
  headBox: Phaser.GameObjects.Container;
  hood: Phaser.GameObjects.Image;
  head: Phaser.GameObjects.Image;
  eyes: Phaser.GameObjects.Image[];
  pupils: Phaser.GameObjects.Image[];
  eyelids: Phaser.GameObjects.Image[];
  tongue: Phaser.GameObjects.Image;
  crown: Phaser.GameObjects.Image;
  lid: Phaser.GameObjects.Image;
  tendril: Phaser.GameObjects.Image;
  lidShadow: Phaser.GameObjects.Image;
  alert: Phaser.GameObjects.Image;
  bloom: Phaser.GameObjects.Image | null;
  pot: Pot | null; // the model's pot object (the model mutates it; the view reads it)
  drawnH: number;
  peek: number; // 0..1: how far a resting snake peeks over its rim
  charmAmt: number; // 0..1 eased: is this the charmed snake
  hoodOpen: number;
  phase: number;
  enter: { t: number; dur: number; fromX: number; hop: boolean } | null;
  exit: { t: number; top: number } | null;
  squash: number; // pot squash after a landing, decays
  bonk: number; // head squash after a save, decays
  wobble: number; // ms left of the lid's wobble
  wobbleMs: number;
  lidSpin: number;
  blinkT: number;
  tongueT: number;
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
  private lanes: LaneView[] = [];
  private beam!: Phaser.GameObjects.Image;
  private pungi!: Phaser.GameObjects.Image;
  private pungiX = L.width / 2;
  private noteTimer = 0;
  private notes!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private stars!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private petals!: Phaser.GameObjects.Particles.ParticleEmitter;
  private shards!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hud!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private muteText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private fullFlash!: Phaser.GameObjects.Image;
  private vine!: Phaser.GameObjects.Image;
  private shownScore = 0;
  private time0 = 0;
  private save!: SaveData;
  private theme: Theme = 'dusk';
  private flowersPill!: ReturnType<typeof flowerPill>;
  private offer: { parts: Phaser.GameObjects.GameObject[]; buttons: Button[]; timer: Phaser.Time.TimerEvent } | null =
    null;
  private banked = false;

  constructor() {
    super('game');
  }

  create(data: { auto?: boolean } = {}): void {
    const params = new URLSearchParams(window.location.search);
    this.auto = data.auto === true || params.get('auto') === '1';
    const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9);
    const night = nightNow(params);
    this.state = createGame(seed, CONFIG, Number(params.get('level')) || 1, night);
    this.lanes = [];
    this.overShown = false;
    this.offer = null;
    this.banked = false;
    this.botTimer = 0;
    this.shownScore = 0;
    this.pungiX = L.width / 2;

    buildArt(this);
    designCamera(this);
    this.save = loadSave();
    this.theme = (this.save.theme in CONFIG.skins.themes ? this.save.theme : 'dusk') as Theme;
    this.sfx.setMuted(this.save.settings.muted === true);
    this.sfx.setSkin(this.save.pungi as never);
    const img = (x: number, y: number, key: string, depth: number) =>
      this.add
        .image(x, y, key)
        .setScale(1 / R)
        .setDepth(depth);

    img(0, 0, `bg_${this.theme}`, DEPTH.bg).setOrigin(0);
    weather(this, this.theme, DEPTH.ambient);
    for (let i = 0; i < (CONFIG.skins.themes[this.theme].stars ? 9 : 0); i++) {
      const s = img(Phaser.Math.Between(10, L.width - 10), Phaser.Math.Between(70, 420), 'star', DEPTH.ambient)
        .setScale(Phaser.Math.FloatBetween(0.25, 0.5) / R)
        .setAlpha(0)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: s,
        alpha: { from: 0, to: 0.9 },
        yoyo: true,
        repeat: -1,
        duration: Phaser.Math.Between(900, 1800),
        delay: Phaser.Math.Between(0, 3000),
        repeatDelay: Phaser.Math.Between(500, 4000),
      });
    }

    this.beam = img(0, L.lidTop - 30, 'beam', DEPTH.beam)
      .setOrigin(0.5, 0)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);

    for (let i = 0; i < LANES; i++) this.lanes.push(this.makeLane(i));
    this.vine = img(0, L.vineY - 35, 'vine', DEPTH.vine).setOrigin(0);

    const skin = this.save.pungi in CONFIG.skins.pungi ? this.save.pungi : 'classic';
    this.pungi = img(this.pungiX, L.fluteY - 22, `pungi_${skin}`, DEPTH.pungi).setOrigin(0.5, 0);

    const fx = (key: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) =>
      this.add.particles(0, 0, key, { emitting: false, ...cfg }).setDepth(DEPTH.fx);
    this.notes = fx('note', {
      speedY: { min: -110, max: -70 },
      speedX: { min: -30, max: 30 },
      lifespan: 1300,
      scale: { start: 0.55, end: 0.3 },
      alpha: { start: 1, end: 0 },
      rotate: { min: -25, max: 25 },
    });
    this.sparks = fx('spark', {
      speed: { min: 40, max: 180 },
      lifespan: { min: 300, max: 700 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
    });
    this.stars = fx('star', {
      speed: { min: 80, max: 220 },
      angle: { min: 180, max: 360 },
      gravityY: 300,
      lifespan: { min: 400, max: 800 },
      scale: { start: 0.55, end: 0 },
      rotate: { min: 0, max: 360 },
      alpha: { start: 1, end: 0.2 },
    });
    this.dust = fx('dust', {
      speedX: { min: -90, max: 90 },
      speedY: { min: -40, max: -5 },
      lifespan: 450,
      scale: { start: 0.7, end: 1.6 },
      alpha: { start: 0.7, end: 0 },
    });
    this.petals = fx('petal', {
      speedX: { min: -80, max: 80 },
      speedY: { min: -120, max: 20 },
      gravityY: 140,
      lifespan: { min: 1200, max: 2200 },
      rotate: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0.4 },
      alpha: { start: 1, end: 0 },
    });
    this.shards = fx('shard', {
      speed: { min: 100, max: 260 },
      angle: { min: 200, max: 340 },
      gravityY: 700,
      lifespan: { min: 500, max: 900 },
      rotate: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0.4 },
      alpha: { start: 1, end: 0 },
    });

    this.fullFlash = img(0, 0, 'vignette', DEPTH.hud - 1)
      .setOrigin(0)
      .setAlpha(0);

    // HUD
    this.hud = this.add.graphics().setDepth(DEPTH.hud);
    this.scoreText = label(this, L.width / 2, L.safeTop + 4, '0', 40, { stroke: 7, shadow: true })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.hud);
    gradientFill(this.scoreText, '#fff7d6', '#ffc23d');
    this.levelText = label(this, 18, L.safeTop + 17, 'LEVEL 1', 14, { color: '#fff1d6', stroke: 4 })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.hud);
    this.comboText = label(this, L.width / 2, L.safeTop + 62, '', 15, { color: '#ffe9a8', stroke: 4 })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.muteText = label(this, L.width - 16, L.safeTop + 17, '', 13, { color: '#e7c9ff', stroke: 4 })
      .setOrigin(1, 0.5)
      .setPadding(16, 14, 4, 14)
      .setDepth(DEPTH.hud)
      .setInteractive({ useHandCursor: true });
    this.muteText.on('pointerdown', () => this.toggleMute());
    this.updateMuteLabel();
    this.hintText = label(this, L.width / 2, 594, '', 14, { color: '#ffe3c2', stroke: 4 })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.flowersPill = flowerPill(this, 50, L.safeTop + 50, DEPTH.hud, '+');
    this.flowersPill.set(0);
    this.setHint(
      this.auto
        ? 'DEMO · tap to play'
        : night
          ? 'moon snakes are out tonight · hold under a pot to charm'
          : 'hold under a pot to charm its snake up to the vine',
    );

    bindHold(
      this,
      (x, y) => this.laneAt(x, y),
      (lane) => {
        if (this.auto || this.state.over) return;
        setHeld(this.state, lane);
        this.sfx.charm(lane);
      },
      LANES,
    );
    if (this.auto) this.input.once('pointerdown', () => this.leaveDemo());
    this.events.once('shutdown', () => {
      this.sfx.charm(null);
      this.bank(); // leaving mid-run still keeps the flowers
    });
    this.cameras.main.fadeIn(250, 18, 8, 40);
    this.time0 = this.time.now;
  }

  /** Put this run's flowers in the wallet, once. The demo earns nothing. */
  private bank(): void {
    if (this.banked || this.auto) return;
    this.banked = true;
    if (this.state.flowers > 0) this.save = updateSave((s) => bankFlowers(s, this.state.flowers));
  }

  private makeLane(i: number): LaneView {
    const x = laneX(i);
    const img = (key: string, depth: number) =>
      this.add
        .image(x, 0, key)
        .setScale(1 / R)
        .setDepth(depth)
        .setVisible(false);
    const part = (key: string, px: number, py: number) => this.add.image(px, py, key).setScale(1 / R);
    const shadow = img('potShadow', DEPTH.potShadow).setY(L.rimY + 78);
    const back = img('potBack_green', DEPTH.potBack).setOrigin(0.5, 0);
    const front = img('potFront_green', DEPTH.potFront).setOrigin(0.5, 0);
    const pts = Array.from({ length: ROPE_POINTS }, (_, k) => ({ x: x * R, y: (L.rimY + k) * R }));
    const rope = this.add
      .rope(0, 0, 'body_green', undefined, pts, false)
      .setScale(1 / R)
      .setDepth(DEPTH.body);
    rope.setVisible(false);
    const hood = part('hood_green', 0, 4).setOrigin(0.5, 0);
    const tongue = part('tongue', 0, 33).setOrigin(0.5, 0).setVisible(false);
    const head = part('head_green', 0, -2).setOrigin(0.5, 0);
    const eyes = [-1, 1].map((s) => part('eye', s * EYE_X, EYE_Y));
    const pupils = [-1, 1].map((s) => part('pupil', s * EYE_X, EYE_Y + 0.5));
    const eyelids = [-1, 1].map((s) => part('eyelid_sleepy', s * EYE_X, EYE_Y - 4.5));
    const crown = part('crown', 0, -1).setOrigin(0.5, 1).setVisible(false);
    const headBox = this.add
      .container(x, L.rimY, [hood, tongue, head, ...eyes, ...pupils, ...eyelids, crown])
      .setDepth(DEPTH.head)
      .setVisible(false);
    const lid = img('lid_clay', DEPTH.lid).setOrigin(0.5, 0);
    const tendril = img('tendril', DEPTH.tendril)
      .setOrigin(0.5, 0)
      .setY(L.vineY - 35 + vineCurve(x) - 2);
    const lidShadow = img('lidShadow', DEPTH.lidShadow).setY(L.rimY + 1);
    const alert = img('alert', DEPTH.fx).setY(L.lidTop + 12);
    return {
      i,
      x,
      kind: 'green',
      shadow,
      back,
      front,
      rope,
      headBox,
      hood,
      head,
      eyes,
      pupils,
      eyelids,
      tongue,
      crown,
      lid,
      tendril,
      lidShadow,
      alert,
      bloom: null,
      pot: null,
      drawnH: 0,
      peek: 0,
      charmAmt: 0,
      hoodOpen: 0,
      phase: Math.random() * TAU,
      enter: null,
      exit: null,
      squash: 0,
      bonk: 0,
      wobble: 0,
      wobbleMs: 1,
      lidSpin: 0,
      blinkT: Math.random() * F.blinkEveryMs,
      tongueT: Math.random() * 1500,
    };
  }

  private laneAt(x: number, y: number): number | null {
    if (y < L.vineY - 40 || y > L.height - 30) return null;
    return Phaser.Math.Clamp(Math.floor((x - L.sidePad) / PITCH), 0, LANES - 1);
  }

  private leaveDemo(): void {
    this.cameras.main.fadeOut(200, 18, 8, 40);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('menu'));
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

  private setHint(text: string): void {
    this.hintText.setText(text);
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta, F.maxFrameMs); // a background tab must not fast-forward the game
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
    this.sfx.tick(dt);
    const t = (time - this.time0) / 1000;
    for (const v of this.lanes) this.drawLane(v, t, dt);
    this.drawPungi(t, dt);
    this.drawHud(dt);
  }

  // ------------------------------------------------------------ events

  private play(e: GameEvent): void {
    switch (e.type) {
      case 'level':
        this.levelText.setText(`LEVEL ${e.level}`);
        this.banner(`LEVEL ${e.level}`, e.level === 1 ? 'charm every snake up to the vine' : '');
        if (e.level === 2 && !this.auto) this.setHint('a raised snake knocks a falling lid back up');
        if (e.level === 3 && !this.auto) this.setHint('');
        break;
      case 'spawn':
        this.spawn(e.lane, e.pot, e.from);
        break;
      case 'wobble': {
        const v = this.lanes[e.lane];
        v.wobble = e.ms;
        v.wobbleMs = e.ms;
        this.sfx.rattle();
        break;
      }
      case 'fall':
        this.lanes[e.lane].lidSpin = Phaser.Math.FloatBetween(-1, 1);
        break;
      case 'save': {
        const v = this.lanes[e.lane];
        const y = headTopAt(e.y);
        v.bonk = 1;
        this.stars.explode(10, v.x, y);
        this.ring(v.x, y, C.save);
        this.floatText(v.x, y - 24, `+${e.points}`, '#bff6ff');
        if (e.combo >= 2) this.floatText(v.x, y - 46, `x${e.combo}`, '#ffe27a', 16);
        this.sfx.boing(e.combo);
        break;
      }
      case 'seal': {
        const v = this.lanes[e.lane];
        v.squash = 1;
        v.wobble = 0;
        this.dust.explode(12, v.x, L.rimY);
        this.cameras.main.shake(F.shakeMs, F.shake);
        this.sfx.clunk();
        break;
      }
      case 'reopen': {
        const v = this.lanes[e.lane];
        this.sparks.explode(6, v.x, L.rimY - 10);
        this.sfx.pop(1.4);
        break;
      }
      case 'charm':
        this.charmed(e.lane, e.pot, e.points, e.combo);
        this.flowersEarned(e.flowers, laneX(e.lane), HUNG_BOTTOM + 10);
        this.tame(e.pot.kind);
        break;
      case 'clear':
        this.levelClear(e.level, e.bonus, e.perfect);
        if (e.flowers) this.time.delayedCall(700, () => this.flowersEarned(e.flowers, L.width / 2, 480));
        break;
      case 'over':
        this.gameOver(e.lane);
        break;
      case 'revive':
        for (const lane of e.lanes) this.blowAway(lane);
        this.banner('ONE MORE TUNE!', 'the lids are back on the vine');
        this.cameras.main.flash(200, 255, 220, 160);
        this.sfx.fanfare();
        break;
    }
  }

  /** Flowers fly from where they were earned to the counter. */
  private flowersEarned(n: number, x: number, y: number): void {
    if (n <= 0 || this.auto) return;
    const target = this.flowersPill.iconAt();
    const total = this.state.flowers;
    for (let i = 0; i < n; i++) {
      const f = this.add
        .image(x + Phaser.Math.Between(-12, 12), y, 'flower')
        .setScale(1 / R)
        .setDepth(DEPTH.text);
      this.tweens.add({
        targets: f,
        x: target.x,
        y: target.y,
        scale: 0.55 / R,
        angle: 180,
        delay: 250 + i * 90,
        duration: 600,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          f.destroy();
          this.flowersPill.set(total, true);
        },
      });
    }
  }

  /** Count the charm toward taming its breed; announce a breed tamed just now. */
  private tame(kind: SnakeKind): void {
    if (this.auto) return;
    const r = recordCharm(this.save, kind);
    this.save = r.save;
    writeSave(this.save);
    if (!r.tamedNow) return;
    this.time.delayedCall(600, () => {
      this.banner('NEW SNAKE!', `${SNAKE_NAMES[kind]} tamed · it joins your title screen`);
      this.sfx.tamed();
      const face = snakeFace(this, L.width / 2, 300, kind, 1.4)
        .setDepth(DEPTH.text)
        .setAlpha(0);
      this.tweens.add({ targets: face, alpha: 1, y: 290, duration: 300, ease: 'Back.easeOut' });
      this.tweens.add({
        targets: face,
        alpha: 0,
        y: 260,
        delay: 1400,
        duration: 400,
        onComplete: () => face.destroy(),
      });
    });
  }

  /** A continue blew this pot away: the snake dives back in and the pot pops, no flower, no points. */
  private blowAway(lane: number): void {
    const v = this.lanes[lane];
    v.pot = null;
    v.exit = null;
    v.wobble = 0;
    v.alert.setVisible(false);
    v.lidShadow.setVisible(false);
    this.sparks.explode(14, v.x, L.rimY - 20);
    this.dust.explode(10, v.x, L.rimY + 30);
    this.shards.explode(8, v.x, L.rimY + 20);
    this.tweens.add({ targets: v.lid, scale: 1.6 / R, alpha: 0, duration: 260, ease: 'Quad.easeOut' });
    this.tweens.add({
      targets: [v.front, v.back],
      scaleX: 1.25 / R,
      scaleY: 0.2 / R,
      alpha: 0,
      duration: 280,
      ease: 'Back.easeIn',
      delay: 120,
    });
    this.tweens.add({ targets: v.shadow, alpha: 0, duration: 300, delay: 120 });
    this.sfx.pop(0.7);
  }

  private spawn(lane: number, pot: Pot, from: number | null): void {
    const v = this.lanes[lane];
    v.exit = null;
    v.pot = pot;
    v.kind = pot.kind;
    v.drawnH = 0;
    v.peek = 0;
    v.charmAmt = 0;
    v.hoodOpen = 0;
    v.wobble = 0;
    v.squash = 0;
    v.bonk = 0;
    v.back.setTexture(`potBack_${pot.kind}`);
    v.front.setTexture(`potFront_${pot.kind}`);
    v.rope.setTexture(`body_${pot.kind}`);
    v.hood.setTexture(`hood_${pot.kind}`);
    v.head.setTexture(`head_${pot.kind}`);
    v.eyelids.forEach((e) => e.setTexture(`eyelid_${pot.kind}`).setVisible(pot.kind === 'sleepy'));
    v.crown.setVisible(pot.kind === 'king');
    v.lid.setTexture(`lid_${pot.lid.kind}`);
    for (const o of [v.shadow, v.back, v.front, v.rope, v.headBox, v.lid, v.tendril]) o.setVisible(true).setAlpha(1);
    v.front.setScale(1 / R);
    v.back.setScale(1 / R);
    v.lid.setScale(0);
    this.tweens.add({ targets: v.lid, scale: 1 / R, duration: 380, ease: 'Back.easeOut', delay: 150 });
    const hop = from !== null;
    v.enter = { t: 0, dur: hop ? 520 : 650, fromX: hop ? laneX(from) : v.x, hop };
    if (hop) {
      this.floatText(v.x, L.rimY - 70, '+1 POT', '#ff9a9a', 18);
      this.sfx.pop(0.8);
    } else {
      v.enter.t = -lane * 70; // pots of a new level arrive one after another
      this.time.delayedCall(lane * 70 + 450, () => this.sfx.pop(1 + lane * 0.1));
    }
  }

  private charmed(lane: number, pot: Pot, points: number, combo: number): void {
    const v = this.lanes[lane];
    v.pot = null;
    v.exit = { t: 0, top: headTopAt(1) };
    v.wobble = 0;
    v.alert.setVisible(false);
    v.lidShadow.setVisible(false);
    this.sparks.explode(18, v.x, HUNG_BOTTOM);
    // the snake tugs the vine as it climbs in (the model shakes the neighbouring lids loose)
    this.tweens.add({
      targets: this.vine,
      y: { from: L.vineY - 35 + 5, to: L.vineY - 35 },
      duration: 600,
      ease: 'Elastic.easeOut',
    });
    this.ring(v.x, L.vineY, C.charm);
    this.dust.explode(10, v.x, L.rimY + 30);
    this.shards.explode(8, v.x, L.rimY + 20);
    this.tweens.add({ targets: v.lid, scale: 1.6 / R, alpha: 0, duration: 260, ease: 'Quad.easeOut' });
    this.tweens.add({
      targets: [v.front, v.back],
      scaleX: 1.25 / R,
      scaleY: 0.2 / R,
      alpha: 0,
      duration: 280,
      ease: 'Back.easeIn',
      delay: 120,
    });
    this.tweens.add({ targets: v.shadow, alpha: 0, duration: 300, delay: 120 });
    // the snake leaves a flower on the vine
    v.bloom?.destroy();
    const by = L.vineY - 35 + vineCurve(v.x) - 2;
    v.bloom = this.add.image(v.x, by, `bloom_${pot.kind}`).setScale(0).setDepth(DEPTH.bloom);
    this.tweens.add({ targets: v.bloom, scale: 1 / R, angle: 30, duration: 450, ease: 'Back.easeOut', delay: 200 });
    this.petals.setParticleTint(pot.kind === 'gold' ? 0xffe27a : pot.kind === 'sleepy' ? 0xc9d2ff : 0xffb3d9);
    this.petals.explode(10, v.x, by);
    this.floatText(v.x, HUNG_BOTTOM + 40, `+${points}`, '#fff1a8', 22);
    if (combo >= 2) this.comboWord(combo, v.x);
    this.sfx.chime(combo);
  }

  private levelClear(level: number, bonus: number, perfect: boolean): void {
    this.time.delayedCall(450, () => {
      this.banner('LEVEL CLEAR!', `+${bonus}${perfect ? '   PERFECT!' : ''}`);
      this.sfx.fanfare();
      for (const v of this.lanes) {
        if (!v.bloom) continue;
        const b = v.bloom;
        v.bloom = null;
        this.petals.setParticleTint(0xffd1e8);
        this.petals.explode(14, b.x, b.y);
        this.tweens.add({ targets: b, scale: 0, angle: 180, duration: 400, delay: 600, onComplete: () => b.destroy() });
      }
    });
    if (level % 5 === 0) this.cameras.main.flash(220, 255, 230, 180);
  }

  private gameOver(lane: number): void {
    const v = this.lanes[lane];
    this.floatText(v.x, L.rimY - 80, 'NO ROOM!', '#ff8a8a', 24);
    this.cameras.main.shake(300, 0.012);
    this.sfx.charm(null);
    this.time.delayedCall(450, () => this.sfx.sad());
    if (!this.auto && canContinue(this.save, this.state.flowers, this.state.revived)) {
      this.time.delayedCall(900, () => this.offerContinue(lane));
    } else this.time.delayedCall(1100, () => this.showGameOver());
  }

  /** One more tune? Spend flowers to blow two pots away and play on. Stays up for meta.continueOfferMs. */
  private offerContinue(lane: number): void {
    if (this.offer || this.overShown) return;
    this.save = updateSave((s) => ({ ...s, stats: { ...s.stats, offers: s.stats.offers + 1 } }));
    const cx = L.width / 2;
    const cy = 400;
    const price = CONFIG.meta.continuePrice;
    const have = this.save.flowers + this.state.flowers;
    const dim = this.add
      .rectangle(cx, L.height / 2, L.width, L.height, 0x0c0420, 0.5)
      .setDepth(DEPTH.overlay)
      .setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 250 });
    const card = panel(this, cx, cy, 310, 330, DEPTH.overlay + 1);
    const title = label(this, cx, cy - 118, 'ONE MORE TUNE?', 30, { stroke: 6, shadow: true })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay + 2);
    gradientFill(title, '#fff6c9', '#ff9a2e');
    const pungi = this.add
      .image(cx - 70, cy - 20, this.pungi.texture.key)
      .setScale(1.1 / R)
      .setDepth(DEPTH.overlay + 2)
      .setAngle(-12);
    const what = label(
      this,
      cx + 20,
      cy - 46,
      `blow away ${CONFIG.meta.continueClears} pots\nlids back on the vine\nsame level, same score`,
      15,
      { color: '#fff1d6', stroke: 4, align: 'left' },
    )
      .setOrigin(0, 0.5)
      .setLineSpacing(4)
      .setDepth(DEPTH.overlay + 2);
    const wallet = label(this, cx + 20, cy + 14, `you have ${have}`, 13, { color: '#e7c9ff', stroke: 3 })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.overlay + 2);
    const walletIcon = this.add
      .image(cx + 20 + wallet.width + 12, cy + 14, 'flower')
      .setScale(0.8 / R)
      .setDepth(DEPTH.overlay + 2);
    // the clock
    const bar = this.add.graphics().setDepth(DEPTH.overlay + 2);
    const parts: Phaser.GameObjects.GameObject[] = [dim, card, title, pungi, what, wallet, walletIcon, bar];
    const total = CONFIG.meta.continueOfferMs;
    let left = total;
    let lastTick = Math.ceil(total / 1000);
    const timer = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        left -= 50;
        const f = Math.max(0, left / total);
        bar.clear();
        bar.fillStyle(0x0c0420, 0.7).fillRoundedRect(cx - 120, cy + 40, 240, 10, 5);
        bar
          .fillStyle(f > 0.3 ? 0xffd36b : 0xff6b6b, 1)
          .fillRoundedRect(cx - 120, cy + 40, Math.max(10, 240 * f), 10, 5);
        const sec = Math.ceil(left / 1000);
        if (sec < lastTick) {
          lastTick = sec;
          this.sfx.tick2();
        }
        if (left <= 0) decline();
      },
    });
    const close = () => {
      if (!this.offer) return;
      this.offer.timer.remove();
      this.offer.buttons.forEach((b) => b.destroy());
      this.offer.parts.forEach((p) => p.destroy());
      this.offer = null;
    };
    const decline = () => {
      close();
      this.showGameOver();
    };
    const accept = () => {
      const paid = payContinue(this.save, this.state.flowers);
      this.save = paid.save;
      this.state.flowers = paid.runFlowers;
      this.save = updateSave(() => ({
        ...this.save,
        stats: { ...this.save.stats, continues: this.save.stats.continues + 1 },
      }));
      this.flowersPill.set(this.state.flowers, true);
      close();
      this.sfx.coins(4);
      revive(this.state, lane, CONFIG); // its 'revive' event plays the effects next frame
    };
    const yes = button(this, cx, cy + 88, 220, 52, `CONTINUE  ·  ${price}`, accept, {
      size: 19,
      depth: DEPTH.overlay + 2,
      icon: 'flower',
    });
    const no = button(this, cx, cy + 142, 160, 40, 'no thanks', decline, {
      size: 14,
      fill: 0x5a3a8a,
      depth: DEPTH.overlay + 2,
    });
    this.offer = { parts, buttons: [yes, no], timer };
  }

  // ------------------------------------------------------------ per-frame drawing

  private drawLane(v: LaneView, t: number, dt: number): void {
    const pot = v.pot;
    if (!pot && !v.exit) {
      for (const o of [v.shadow, v.back, v.front, v.rope, v.headBox, v.lid, v.tendril, v.lidShadow, v.alert])
        o.setVisible(false);
      return;
    }
    const k = dt / 16.67;
    const held = !!pot && this.state.held === v.i && pot.lid.phase !== 'sealed' && !this.state.over;

    // where the pot stands (it may be arriving)
    let px = v.x;
    let py = 0; // offset of the pot from its rest place
    let tilt = 0;
    if (v.enter) {
      v.enter.t += dt;
      const f = Phaser.Math.Clamp(v.enter.t / v.enter.dur, 0, 1);
      if (v.enter.hop) {
        px = Phaser.Math.Linear(v.enter.fromX, v.x, f);
        py = -Math.sin(f * Math.PI) * 120;
        tilt = Math.sin(f * TAU) * 0.3;
      } else {
        py = -(1 - Phaser.Math.Easing.Bounce.Out(f)) * 700;
      }
      if (f >= 1) {
        v.enter = null;
        v.squash = 0.6;
        this.dust.explode(6, v.x, L.rimY + 76);
      }
    }
    v.squash = Math.max(0, v.squash - dt / 260);
    const sq = Math.sin(v.squash * Math.PI) * 0.12;
    const rattle = pot?.lid.phase === 'sealed' ? Math.sin(t * 60) * 1.2 : 0;
    px += rattle;
    v.front.setPosition(px, POT_TOP + py).setRotation(tilt);
    v.back.setPosition(px, POT_TOP + py).setRotation(tilt);
    if (!v.exit) {
      v.front.setScale((1 + sq) / R, (1 - sq) / R);
      v.back.setScale((1 + sq) / R, (1 - sq) / R);
    }
    v.shadow.setPosition(px, L.rimY + 78).setAlpha(v.exit ? v.shadow.alpha : Phaser.Math.Clamp(1 + py / 300, 0, 1));

    // the snake's height, smoothed, and how far it peeks while resting
    const lid = pot?.lid;
    const threatened = !!lid && (lid.phase === 'fall' ? lid.y < 0.55 : lid.phase === 'sealed');
    v.charmAmt += ((held ? 1 : 0) - v.charmAmt) * Math.min(1, 0.15 * k);
    let top: number;
    if (v.exit) {
      v.exit.t += dt;
      const f = Math.min(1, v.exit.t / 420);
      top = Phaser.Math.Linear(v.exit.top, L.vineY - 30, Phaser.Math.Easing.Quadratic.In(f));
      if (f >= 1) {
        v.exit = null;
        return;
      }
    } else {
      const h = pot ? pot.h : 0;
      v.drawnH += (h - v.drawnH) * Math.min(1, F.headLerp * k);
      v.peek += ((threatened || v.enter ? 0 : 1) - v.peek) * Math.min(1, (threatened ? 0.4 : 0.08) * k);
      const peekTop = L.rimY - L.headPeek * v.peek + (threatened ? 12 : 0);
      top = Math.min(peekTop, headTopAt(v.drawnH)) + py;
    }

    // body: a rope from inside the pot up to the neck, swaying like a charmed snake
    const tailY = TAIL_Y + py + (v.exit ? (v.exit.t / 420) * -(TAIL_Y - L.vineY) : 0);
    const neckY = top + 22;
    const len = Math.max(12, tailY - neckY);
    const amp = Phaser.Math.Linear(F.swayIdle, F.swayCharm, v.charmAmt) * Phaser.Math.Clamp(len / 160, 0.2, 1);
    const w = t * F.swayHz * TAU * (1 + v.charmAmt * 0.4) + v.phase;
    const sway = (s: number) => amp * Math.sin(w - s * 3.2) * Math.pow(s, 1.3);
    const pts = v.rope.points as { x: number; y: number }[];
    for (let j = 0; j < ROPE_POINTS; j++) {
      const s = 1 - j / (ROPE_POINTS - 1);
      pts[j] = { x: (px + sway(s)) * R, y: (tailY - s * len) * R };
    }
    v.rope.setFrame(this.bodyFrame(v.kind, len));
    v.rope.setPoints(pts);
    v.rope.setVisible(true);
    const hx = px + sway(1);
    const slope = (sway(1) - sway(0.94)) / (0.06 * len);
    v.bonk = Math.max(0, v.bonk - dt / 220);
    const bonk = Math.sin(v.bonk * Math.PI) * 0.22;
    v.headBox
      .setPosition(hx, top)
      .setRotation(Math.atan(slope) * 0.6 + tilt)
      .setScale(1 + bonk * 0.5, 1 - bonk)
      .setVisible(true);
    const out = (L.rimY - top) / 60; // 0 at the rim, 1 a head-height out
    v.hoodOpen += (v.charmAmt * Phaser.Math.Clamp(out - 0.6, 0, 1) - v.hoodOpen) * Math.min(1, F.hoodLerp * k);
    if (v.exit) v.hoodOpen = 1;
    const big = v.kind === 'king' ? 1.15 : 1;
    v.hood.setScale(((0.4 + 0.6 * v.hoodOpen) * big) / R, ((0.78 + 0.22 * v.hoodOpen) * big) / R);
    this.drawFace(v, dt, lid?.phase === 'wobble' || lid?.phase === 'fall', pot?.lid.phase === 'sealed');

    // lid
    if (!pot || !lid) {
      v.tendril.setVisible(false);
      return;
    }
    let rot = 0;
    if (lid.phase === 'wobble') {
      v.wobble = Math.max(0, v.wobble - dt);
      const f = 1 - v.wobble / v.wobbleMs;
      rot = Math.sin(t * (18 + f * 26)) * (0.08 + f * 0.16);
    } else if (lid.phase === 'fall') {
      v.lidSpin *= 0.98;
      rot = Math.sin(t * 9) * 0.06 + v.lidSpin * 0.1;
    }
    const lidY = lid.phase === 'hung' || lid.phase === 'wobble' ? L.lidTop : lidTopAt(lid.y);
    v.lid
      .setPosition(lid.phase === 'sealed' ? px : v.x, lidY + (lid.phase === 'sealed' ? py : 0))
      .setRotation(rot)
      .setVisible(true);
    const onVine = lid.phase === 'hung' || lid.phase === 'wobble';
    const ts = v.tendril.scaleY * R;
    v.tendril.setScale(1 / R, Phaser.Math.Linear(ts, onVine ? 1 : 0.45, 0.25) / R).setRotation(rot * 0.6);
    const falling = lid.phase === 'fall';
    v.lidShadow
      .setVisible(falling)
      .setAlpha(falling ? Phaser.Math.Clamp(1 - lid.y, 0.15, 1) : 0)
      .setScale((0.5 + 0.6 * (1 - lid.y)) / R, 1 / R);
    const warn = lid.phase === 'wobble';
    v.alert
      .setVisible(warn)
      .setPosition(v.x + 26, L.lidTop + 4)
      .setScale((0.9 + Math.sin(t * 20) * 0.12) / R);
  }

  /** Eyes follow the danger, blink now and then; a charmed snake opens its eyes wide and flicks its tongue. */
  private drawFace(v: LaneView, dt: number, lidMoving: boolean, sealed: boolean): void {
    v.blinkT -= dt;
    if (v.blinkT < -130) v.blinkT = F.blinkEveryMs * (0.6 + Math.random() * 0.8);
    const blink = v.blinkT < 0 ? 0.12 : 1;
    let lx = 0;
    let ly = 0;
    if (lidMoving) ly = -2.6;
    else if (v.charmAmt > 0.5) ly = -2;
    else if (this.state.held !== null) lx = Phaser.Math.Clamp((laneX(this.state.held) - v.x) / 60, -2, 2);
    const squint = sealed ? 0.15 : 1;
    v.eyes.forEach((e, s) => {
      e.setScale(1 / R, (blink * squint) / R);
      v.pupils[s].setPosition((s ? 1 : -1) * EYE_X + lx, EYE_Y + 0.5 + ly).setScale(1 / R, (blink * squint) / R);
    });
    const sleepy = v.kind === 'sleepy' && v.charmAmt < 0.5;
    v.eyelids.forEach((e) => e.setVisible(sleepy));
    v.tongueT -= dt;
    if (v.tongueT < 0) v.tongueT = v.charmAmt > 0.5 ? 900 + Math.random() * 600 : 2500 + Math.random() * 3000;
    const flick = v.tongueT < 260 ? Math.sin((v.tongueT / 260) * Math.PI) : 0;
    v.tongue.setVisible(flick > 0.05).setScale(1 / R, flick / R);
  }

  private bodyFrame(kind: SnakeKind, len: number): string {
    const n = Phaser.Math.Clamp(Math.round(len / 4) * 4, 8, A.bodyLength);
    const name = `L${n}`;
    const tex = this.textures.get(`body_${kind}`);
    if (!tex.has(name)) tex.add(name, 0, 0, 0, A.bodyWidth * R, n * R);
    return name;
  }

  private drawPungi(t: number, dt: number): void {
    const held = this.state.held;
    const k = dt / 16.67;
    if (held !== null) this.pungiX += (laneX(held) - this.pungiX) * Math.min(1, 0.35 * k);
    const playing = held !== null && !this.state.over;
    this.pungi
      .setPosition(this.pungiX, L.fluteY - 22 + (playing ? Math.sin(t * 9) * 1.5 : 4))
      .setRotation(playing ? Math.sin(t * 5) * 0.08 : 0)
      .setAlpha(playing ? 1 : 0.85);
    this.beam.setX(held !== null ? laneX(held) : this.beam.x);
    this.beam.alpha += ((playing ? 1 : 0) - this.beam.alpha) * Math.min(1, 0.2 * k);
    if (!playing) return;
    this.noteTimer += dt;
    if (this.noteTimer >= F.noteEveryMs) {
      this.noteTimer = 0;
      this.notes.setParticleTint(Phaser.Utils.Array.GetRandom(NOTE_TINTS));
      this.notes.emitParticleAt(this.pungiX + Phaser.Math.Between(-6, 6), L.fluteY - 18);
    }
  }

  private drawHud(dt: number): void {
    const s = this.state;
    const g = this.hud;
    g.clear();
    if (this.shownScore !== s.score) {
      const step = Math.max(1, Math.ceil((Math.abs(s.score - this.shownScore) * dt) / F.scoreCountMs));
      this.shownScore = Math.min(s.score, this.shownScore + step);
      this.scoreText.setText(String(this.shownScore));
    }
    // level pill
    g.fillStyle(0x1a0b2e, 0.55).fillRoundedRect(8, L.safeTop + 4, this.levelText.width + 20, 26, 13);
    if (s.combo >= 2) {
      this.comboText.setText(`COMBO x${s.combo}`).setVisible(true);
      const f = Phaser.Math.Clamp(s.comboTimer / CONFIG.scoring.comboMs, 0, 1);
      g.fillStyle(0x1a0b2e, 0.6).fillRoundedRect(L.width / 2 - 50, L.safeTop + 74, 100, 6, 3);
      g.fillStyle(0xffd36b, 1).fillRoundedRect(L.width / 2 - 50, L.safeTop + 74, 100 * f, 6, 3);
    } else this.comboText.setVisible(false);
    // a full rug: the next lid that lands ends the game
    const full = s.lanes.every((p) => p !== null) && !s.over;
    const target = full ? 0.55 + 0.35 * Math.sin(this.time.now / 140) : 0;
    this.fullFlash.alpha += (target - this.fullFlash.alpha) * 0.2;
    if (full && !this.auto) this.setHint('NO ROOM LEFT — don’t let a lid land!');
    else if (this.hintText.text.startsWith('NO ROOM')) this.setHint('');
  }

  // ------------------------------------------------------------ effects

  private ring(x: number, y: number, tint: number): void {
    const r = this.add
      .image(x, y, 'ring')
      .setScale(0.2 / R)
      .setTint(tint)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.fx);
    this.tweens.add({ targets: r, scale: 1.4 / R, alpha: 0, duration: 420, onComplete: () => r.destroy() });
  }

  private floatText(x: number, y: number, text: string, color: string, size = 18): void {
    const t = label(this, Phaser.Math.Clamp(x, 40, L.width - 40), y, text, size, { color, stroke: 5 })
      .setOrigin(0.5)
      .setDepth(DEPTH.text);
    this.tweens.add({
      targets: t,
      y: y - 46,
      alpha: { from: 1, to: 0 },
      scale: { from: 1.25, to: 1 },
      duration: F.floatTextMs,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  private comboWord(combo: number, x: number): void {
    const word = COMBO_WORDS[Math.min(combo, COMBO_WORDS.length - 1)];
    const t = label(this, Phaser.Math.Clamp(x, 110, L.width - 110), 330, `${word} x${combo}`, 32, {
      stroke: 7,
      shadow: true,
    })
      .setOrigin(0.5)
      .setAngle(-6)
      .setDepth(DEPTH.text);
    gradientFill(t, '#fff6c9', '#ff8a3d');
    this.tweens.add({
      targets: t,
      scale: { from: 0.4, to: 1 },
      duration: 260,
      ease: 'Back.easeOut',
    });
    this.tweens.add({ targets: t, alpha: 0, y: 300, delay: 650, duration: 350, onComplete: () => t.destroy() });
    this.cameras.main.shake(F.shakeMs, F.shake * Math.min(combo, 4) * 0.5);
  }

  private banner(text: string, sub: string): void {
    const y = 380;
    const t = label(this, L.width / 2, y, text, 44, { stroke: 8, shadow: true })
      .setOrigin(0.5)
      .setDepth(DEPTH.text);
    gradientFill(t, '#fff6c9', '#ff9a2e');
    const parts: Phaser.GameObjects.Text[] = [t];
    if (sub) {
      parts.push(
        label(this, L.width / 2, y + 42, sub, 16, { color: '#fff1d6', stroke: 5 })
          .setOrigin(0.5)
          .setDepth(DEPTH.text),
      );
    }
    this.tweens.add({ targets: parts, scale: { from: 0.3, to: 1 }, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: parts,
      alpha: 0,
      y: '-=30',
      delay: 1100,
      duration: 380,
      onComplete: () => parts.forEach((p) => p.destroy()),
    });
  }

  private showGameOver(): void {
    if (this.overShown) return;
    this.overShown = true;
    const s = this.state;
    const earned = s.flowers;
    const prevBest = this.save.best;
    const best = this.auto ? prevBest : recordBest(s.score);
    this.bank();
    if (!this.auto) this.save = updateSave((sv) => ({ ...sv, stats: { ...sv.stats, runs: sv.stats.runs + 1 } }));
    const cx = L.width / 2;
    const cy = 410;
    const h = 430;
    const dim = this.add
      .rectangle(cx, L.height / 2, L.width, L.height, 0x0c0420, 0.55)
      .setDepth(DEPTH.overlay)
      .setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 300 });
    panel(this, cx, cy, 320, h, DEPTH.overlay + 1);
    const top = cy - h / 2;
    const title = label(this, cx, top + 44, 'NO ROOM ON THE RUG!', 24, { stroke: 6, shadow: true })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay + 2);
    gradientFill(title, '#fff6c9', '#ff9a2e');
    const score = label(this, cx, top + 96, String(s.score), 50, { stroke: 7, shadow: true })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay + 2);
    gradientFill(score, '#fff7d6', '#ffc23d');
    const newBest = s.score >= best && s.score > 0 && !this.auto && s.score > prevBest;
    label(
      this,
      cx,
      top + 136,
      `LEVEL ${s.level}  ·  ${s.charmed} charmed  ·  ${s.saves} saved${newBest ? '' : `  ·  BEST ${best}`}`,
      13,
      { color: '#efe6ff', stroke: 4 },
    )
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay + 2);
    if (newBest) {
      const nb = label(this, cx + 120, top + 70, 'NEW BEST!', 16, { stroke: 5 })
        .setOrigin(0.5)
        .setAngle(12)
        .setDepth(DEPTH.overlay + 3);
      gradientFill(nb, '#ffffff', '#7dfcb0');
      this.tweens.add({ targets: nb, scale: { from: 1, to: 1.15 }, yoyo: true, repeat: -1, duration: 420 });
    }
    // flowers banked
    const fl = label(this, cx + 12, top + 170, this.auto ? 'demo: no flowers' : `+${earned} flowers banked`, 17, {
      color: '#ffe3c2',
      stroke: 4,
    })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay + 2);
    this.add
      .image(cx - fl.width / 2 - 2, top + 170, 'flower')
      .setScale(1 / R)
      .setDepth(DEPTH.overlay + 2);
    // taming progress for the breeds charmed this run (up to three)
    const kinds = (Object.keys(s.charmedByKind) as SnakeKind[])
      .sort((a, b) => (s.charmedByKind[b] ?? 0) - (s.charmedByKind[a] ?? 0))
      .slice(0, 3);
    kinds.forEach((kind, i) => {
      const y = top + 206 + i * 40;
      const x0 = cx - 128;
      snakeFace(this, x0 + 16, y + 8, kind, 0.55).setDepth(DEPTH.overlay + 2);
      const count = this.save.tamed[kind] ?? 0;
      const need = tameThreshold(kind);
      const tamed = count >= need;
      label(this, x0 + 44, y - 8, SNAKE_NAMES[kind], 13, { color: '#fff1d6', stroke: 3 })
        .setOrigin(0, 0.5)
        .setDepth(DEPTH.overlay + 2);
      const g = this.add.graphics().setDepth(DEPTH.overlay + 2);
      const bw = 150;
      g.fillStyle(0x0c0420, 0.7).fillRoundedRect(x0 + 44, y + 2, bw, 9, 4.5);
      g.fillStyle(tamed ? 0x7dfcb0 : 0xffd27a, 1).fillRoundedRect(
        x0 + 44,
        y + 2,
        Math.max(9, bw * Math.min(1, count / need)),
        9,
        4.5,
      );
      label(this, x0 + 44 + bw + 8, y + 6, tamed ? 'TAMED' : `${Math.min(count, need)}/${need}`, 11, {
        color: tamed ? '#7dfcb0' : '#e7c9ff',
        stroke: 3,
      })
        .setOrigin(0, 0.5)
        .setDepth(DEPTH.overlay + 2);
    });
    if (!kinds.length) {
      label(this, cx, top + 216, 'charm a snake to start taming its breed', 12, { color: '#e7c9ff', stroke: 3 })
        .setOrigin(0.5)
        .setDepth(DEPTH.overlay + 2);
    }

    const restart = () => {
      this.input.removeAllListeners();
      this.cameras.main.fadeOut(200, 18, 8, 40);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart({ auto: this.auto }));
    };
    const menu = () => {
      this.input.removeAllListeners();
      this.cameras.main.fadeOut(200, 18, 8, 40);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('menu'));
    };
    if (this.auto) {
      label(this, cx, top + h - 60, 'demo · restarting', 16, { color: '#ffffff', stroke: 5 })
        .setOrigin(0.5)
        .setDepth(DEPTH.overlay + 2);
      this.time.delayedCall(F.restartGuardMs * 4, restart);
      this.input.once('pointerdown', menu);
      return;
    }
    // A short guard so the finger that was holding a pot does not restart the game instantly.
    this.time.delayedCall(F.restartGuardMs, () => {
      button(this, cx, top + h - 92, 230, 50, 'PLAY AGAIN', restart, { size: 21, depth: DEPTH.overlay + 2 });
      button(this, cx - 66, top + h - 40, 112, 40, 'SHARE', () => this.shareRun(best), {
        size: 14,
        fill: 0x2e8b57,
        depth: DEPTH.overlay + 2,
      });
      button(this, cx + 66, top + h - 40, 112, 40, 'MENU', menu, {
        size: 14,
        fill: 0x5a3a8a,
        depth: DEPTH.overlay + 2,
      });
      this.input.keyboard?.once('keydown-SPACE', restart);
    });
  }

  private shareRun(best: number): void {
    const s = this.state;
    const card = buildShareCard(this, {
      score: s.score,
      level: s.level,
      charmed: s.charmed,
      best,
      tamed: tamedKinds(this.save),
      theme: this.theme,
    });
    void shareCard(card, `I scored ${s.score} in Snake Song (level ${s.level}). Can you charm more snakes?`).then(
      (r) => {
        const msg = r === 'shared' ? 'shared!' : r === 'saved' ? 'picture saved' : 'could not share';
        this.floatText(L.width / 2, 700, msg, '#bff6ff', 16);
      },
    );
  }
}
