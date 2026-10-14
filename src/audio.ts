/**
 * Synthesized sound only (no files, no network): a reedy pungi melody while a snake is charmed, and short
 * effects for lids, saves, charms and levels. Starts on the first touch, as mobile browsers require. Every call
 * is safe without audio.
 */
import { CONFIG } from './config';
import type { PungiSkin } from './meta';

const LANE_STEP = [0, 2, 4, 5, 7, 9, 11]; // each lane's tonic, a step up the major scale

interface Voice {
  osc: OscillatorNode;
  osc2: OscillatorNode;
  gain: GainNode;
  lfo: OscillatorNode;
  drone: OscillatorNode;
  droneGain: GainNode;
}

export class Sound {
  private ctx: AudioContext | null = null;
  private voice: Voice | null = null;
  private noise: AudioBuffer | null = null;
  private lane: number | null = null;
  private degree = 4;
  private noteTimer = 0;
  private skin = CONFIG.skins.pungi.classic;
  muted = false;

  /** Each pungi skin has its own scale and timbre (CONFIG.skins.pungi). */
  setSkin(skin: PungiSkin): void {
    this.skin = CONFIG.skins.pungi[skin] ?? CONFIG.skins.pungi.classic;
    if (this.voice && this.lane !== null) {
      const lane = this.lane;
      this.stopVoice();
      this.charm(lane);
    }
  }

  private context(): AudioContext | null {
    if (this.muted) return null;
    try {
      if (!this.ctx) this.ctx = new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private hz(semis: number): number {
    return CONFIG.feel.noteBaseHz * Math.pow(2, semis / 12);
  }

  private tonic(lane: number): number {
    return LANE_STEP[lane % LANE_STEP.length];
  }

  /** Start, move or stop (lane = null) the pungi. */
  charm(lane: number | null): void {
    this.lane = lane;
    const ctx = this.context();
    if (!ctx || lane === null) {
      this.stopVoice();
      return;
    }
    const base = this.tonic(lane);
    if (this.voice) {
      this.voice.drone.frequency.setTargetAtTime(this.hz(base - 12), ctx.currentTime, 0.05);
      this.glide();
      return;
    }
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const nasal = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const sk = this.skin;
    osc.type = sk.waves[0] as OscillatorType;
    osc2.type = sk.waves[1] as OscillatorType;
    osc2.detune.value = 8;
    lfo.frequency.value = sk.vibrato; // vibrato
    lfoGain.gain.value = 7;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfoGain.connect(osc2.frequency);
    filter.type = 'lowpass';
    filter.frequency.value = sk.filter;
    nasal.type = 'peaking';
    nasal.frequency.value = sk.nasal;
    nasal.gain.value = 9;
    nasal.Q.value = 2;
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.07, ctx.currentTime, 0.04);
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(nasal).connect(gain).connect(ctx.destination);
    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    drone.type = 'triangle';
    drone.frequency.value = this.hz(base - 12);
    droneGain.gain.value = 0;
    droneGain.gain.setTargetAtTime(0.05, ctx.currentTime, 0.1);
    drone.connect(droneGain).connect(ctx.destination);
    this.voice = { osc, osc2, gain, lfo, drone, droneGain };
    this.degree = 4;
    this.glide(true);
    for (const o of [osc, osc2, lfo, drone]) o.start();
  }

  private glide(jump = false): void {
    const ctx = this.ctx;
    if (!ctx || !this.voice || this.lane === null) return;
    const scale = this.skin.scale;
    const f = this.hz(this.tonic(this.lane) + scale[Math.min(this.degree, scale.length - 1)]);
    const t = ctx.currentTime;
    for (const o of [this.voice.osc, this.voice.osc2]) {
      if (jump) o.frequency.setValueAtTime(f, t);
      else o.frequency.setTargetAtTime(f, t, 0.025);
    }
  }

  /** Call every frame: the melody wanders up and down the scale while the flute plays. */
  tick(dt: number): void {
    if (!this.voice) return;
    this.noteTimer += dt;
    if (this.noteTimer < CONFIG.feel.noteStepMs) return;
    this.noteTimer = 0;
    const r = Math.random();
    const move = r < 0.4 ? -1 : r < 0.8 ? 1 : r < 0.9 ? 2 : -2;
    this.degree = Math.max(0, Math.min(this.skin.scale.length - 1, this.degree + move));
    this.glide();
  }

  private stopVoice(): void {
    if (!this.voice || !this.ctx) return;
    const v = this.voice;
    const t = this.ctx.currentTime;
    v.gain.gain.setTargetAtTime(0, t, 0.05);
    v.droneGain.gain.setTargetAtTime(0, t, 0.08);
    for (const o of [v.osc, v.osc2, v.lfo, v.drone]) o.stop(t + 0.4);
    this.voice = null;
  }

  private tone(type: OscillatorType, from: number, to: number, start: number, len: number, vol: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime + start;
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + len);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + len);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + len + 0.05);
  }

  private hiss(start: number, len: number, vol: number, cutoff: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const t = ctx.currentTime + start;
    src.buffer = this.noise;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t);
    src.stop(t + len + 0.05);
  }

  /** A lid rattles on the vine. */
  rattle(): void {
    if (!this.context()) return;
    for (let i = 0; i < 4; i++) this.tone('square', 900 + i * 60, 700, i * 0.07, 0.04, 0.025);
  }

  /** A lid bounces off a snake's head. */
  boing(combo: number): void {
    if (!this.context()) return;
    const up = 1 + combo * 0.08;
    this.tone('sine', 260 * up, 780 * up, 0, 0.16, 0.18);
    this.tone('triangle', 780 * up, 520 * up, 0.12, 0.14, 0.08);
  }

  /** A lid lands on a pot. */
  clunk(): void {
    if (!this.context()) return;
    this.tone('sine', 180, 45, 0, 0.25, 0.35);
    this.hiss(0, 0.18, 0.25, 900);
  }

  /** A pot arrives or a lid pops off. */
  pop(pitch = 1): void {
    if (!this.context()) return;
    this.tone('sine', 420 * pitch, 900 * pitch, 0, 0.09, 0.14);
  }

  /** A snake climbs into the vine. */
  chime(combo: number): void {
    if (!this.context()) return;
    const base = 5 + Math.min(combo, 6) * 2;
    [0, 4, 7, 12].forEach((st, i) =>
      this.tone('triangle', this.hz(base + st + 12), this.hz(base + st + 12), i * 0.06, 0.28, 0.11),
    );
    this.hiss(0, 0.3, 0.04, 6000);
  }

  /** Level cleared. */
  fanfare(): void {
    if (!this.context()) return;
    [0, 4, 7, 12, 16, 19, 24].forEach((st, i) =>
      this.tone('triangle', this.hz(12 + st), this.hz(12 + st), i * 0.08, 0.3, 0.12),
    );
  }

  /** Flowers banked or a pouch opened: a little glissando of chimes. */
  coins(n = 3): void {
    if (!this.context()) return;
    for (let i = 0; i < Math.min(n, 8); i++)
      this.tone('sine', this.hz(19 + i * 2), this.hz(19 + i * 2), i * 0.05, 0.18, 0.1);
  }

  /** A new breed tamed. */
  tamed(): void {
    if (!this.context()) return;
    [0, 7, 12, 19, 24].forEach((st, i) =>
      this.tone('triangle', this.hz(st + 7), this.hz(st + 7), i * 0.09, 0.35, 0.13),
    );
    this.hiss(0.3, 0.5, 0.05, 7000);
  }

  /** The continue offer's clock. */
  tick2(): void {
    if (!this.context()) return;
    this.tone('square', 1100, 900, 0, 0.04, 0.03);
  }

  /** Game over. */
  sad(): void {
    if (!this.context()) return;
    [12, 11, 8, 7, 4].forEach((st, i) => this.tone('triangle', this.hz(st), this.hz(st) * 0.97, i * 0.16, 0.3, 0.12));
  }

  setMuted(m: boolean): void {
    if (m) this.stopVoice();
    this.muted = m;
  }
}
