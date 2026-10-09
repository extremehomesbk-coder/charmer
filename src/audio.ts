/**
 * Synthesized sound only (no files, no network): a breathy flute note while a column is charmed, and a rising
 * pop per cascade step. Starts on the first touch, as mobile browsers require. Every call is safe without audio.
 */
import { CONFIG } from './config';

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19]; // pentatonic steps, one per column

export class Sound {
  private ctx: AudioContext | null = null;
  private flute: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode } | null = null;
  muted = false;

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

  private hz(step: number): number {
    return CONFIG.feel.noteBaseHz * Math.pow(2, step / 12);
  }

  /** Start, retune or stop (lane = null) the flute. */
  charm(lane: number | null): void {
    const ctx = this.context();
    if (!ctx || lane === null) {
      this.stopFlute();
      return;
    }
    const freq = this.hz(SCALE[lane % SCALE.length]);
    if (this.flute) {
      this.flute.osc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.03);
      return;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    lfo.frequency.value = 5.5; // vibrato
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.12, ctx.currentTime, 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    lfo.start();
    this.flute = { osc, gain, lfo };
  }

  private stopFlute(): void {
    if (!this.flute || !this.ctx) return;
    const { osc, gain, lfo } = this.flute;
    const t = this.ctx.currentTime;
    gain.gain.setTargetAtTime(0, t, 0.05);
    osc.stop(t + 0.3);
    lfo.stop(t + 0.3);
    this.flute = null;
  }

  pop(chain: number): void {
    const ctx = this.context();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.hz(12 + 3 * chain), t);
    osc.frequency.exponentialRampToValueAtTime(this.hz(24 + 3 * chain), t + 0.12);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  thud(): void {
    const ctx = this.context();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = 'square';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
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

  /** Gold pot: a bright sweep. */
  blast(): void {
    if (!this.context()) return;
    this.tone('sawtooth', 200, 1600, 0, 0.35, 0.06);
    this.tone('sine', 900, 1800, 0.05, 0.3, 0.1);
  }

  /** Fever starts: a quick rising arpeggio. */
  fanfare(): void {
    if (!this.context()) return;
    [0, 4, 7, 12, 16].forEach((st, i) =>
      this.tone('triangle', this.hz(12 + st), this.hz(12 + st), i * 0.07, 0.22, 0.12),
    );
  }

  /** Stage clear. */
  stage(): void {
    if (!this.context()) return;
    [0, 7, 12].forEach((st, i) => this.tone('sine', this.hz(7 + st), this.hz(7 + st), i * 0.1, 0.3, 0.14));
  }

  setMuted(m: boolean): void {
    if (m) this.stopFlute();
    this.muted = m;
  }
}
