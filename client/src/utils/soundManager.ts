type SoundName =
  | 'CARD_PLAY'
  | 'CARD_DRAW'
  | 'MISSION_LAUNCH'
  | 'COMBAT_HIT'
  | 'AP_GAIN'
  | 'TURN_START'
  | 'VICTORY'
  | 'DEFEAT'
  | 'TIMER_WARNING'
  | 'MINION_DEATH'
  | 'SPELL_CAST'
  | 'ATTACK_WHOOSH';

const STORAGE_KEY = 'spero-sound-settings';

class SoundManager {
  private ctx: AudioContext | null = null;
  private _volume = 0.5;
  private _muted = false;

  constructor() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { volume, muted } = JSON.parse(saved);
        if (typeof volume === 'number') this._volume = volume;
        if (typeof muted === 'boolean') this._muted = muted;
      }
    } catch { /* ignore */ }
  }

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  get volume() { return this._volume; }
  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    this.persist();
  }

  get muted() { return this._muted; }
  set muted(m: boolean) {
    this._muted = m;
    this.persist();
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume: this._volume, muted: this._muted }));
    } catch { /* ignore */ }
  }

  private gain(): GainNode {
    const ctx = this.getCtx();
    const g = ctx.createGain();
    g.gain.value = this._muted ? 0 : this._volume;
    g.connect(ctx.destination);
    return g;
  }

  private sweep(startHz: number, endHz: number, durationMs: number, type: OscillatorType = 'sine') {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const g = this.gain();
    osc.type = type;
    osc.frequency.setValueAtTime(startHz, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(endHz, ctx.currentTime + durationMs / 1000);
    g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + durationMs / 1000);
    osc.connect(g);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  }

  private tone(hz: number, durationMs: number, type: OscillatorType = 'sine') {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const g = this.gain();
    osc.type = type;
    osc.frequency.value = hz;
    g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + durationMs / 1000);
    osc.connect(g);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  }

  play(name: SoundName) {
    if (this._muted) return;
    try {
      switch (name) {
        case 'CARD_PLAY':
          this.sweep(400, 200, 200);
          break;
        case 'CARD_DRAW':
          this.sweep(300, 600, 150);
          break;
        case 'MISSION_LAUNCH':
          this.sweep(300, 800, 400);
          break;
        case 'COMBAT_HIT': {
          const ctx = this.getCtx();
          const bufferSize = ctx.sampleRate * 0.1;
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
          const noise = ctx.createBufferSource();
          noise.buffer = buffer;
          const g = this.gain();
          g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
          noise.connect(g);
          noise.start();
          noise.stop(ctx.currentTime + 0.1);
          break;
        }
        case 'AP_GAIN':
          this.tone(800, 300);
          setTimeout(() => this.tone(1200, 200), 50);
          break;
        case 'TURN_START':
          this.tone(500, 150);
          setTimeout(() => this.tone(700, 150), 100);
          break;
        case 'VICTORY': {
          const notes = [523, 659, 784, 1047]; // C-E-G-C
          notes.forEach((hz, i) => setTimeout(() => this.tone(hz, 300), i * 120));
          break;
        }
        case 'DEFEAT': {
          const notes = [523, 415, 349, 294]; // C-Ab-F-D
          notes.forEach((hz, i) => setTimeout(() => this.tone(hz, 400), i * 150));
          break;
        }
        case 'TIMER_WARNING':
          this.tone(1000, 50, 'square');
          break;
        case 'MINION_DEATH': {
          // Low-frequency white noise burst (deeper than COMBAT_HIT)
          const ctx2 = this.getCtx();
          const bufferSize2 = ctx2.sampleRate * 0.15;
          const buffer2 = ctx2.createBuffer(1, bufferSize2, ctx2.sampleRate);
          const data2 = buffer2.getChannelData(0);
          for (let i = 0; i < bufferSize2; i++) data2[i] = Math.random() * 2 - 1;
          const noise2 = ctx2.createBufferSource();
          noise2.buffer = buffer2;
          // Low-pass filter for deeper sound
          const lp = ctx2.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 600;
          const g2 = this.gain();
          g2.gain.linearRampToValueAtTime(0, ctx2.currentTime + 0.15);
          noise2.connect(lp);
          lp.connect(g2);
          noise2.start();
          noise2.stop(ctx2.currentTime + 0.15);
          break;
        }
        case 'SPELL_CAST':
          // Ascending frequency sweep (triangle wave)
          this.sweep(500, 1200, 300, 'triangle');
          break;
        case 'ATTACK_WHOOSH':
          // Fast descending sweep before combat hit
          this.sweep(800, 200, 100);
          break;
      }
    } catch { /* audio errors are non-critical */ }
  }
}

export const soundManager = new SoundManager();
