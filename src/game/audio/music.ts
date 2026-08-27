/**
 * Procedural music engine — zero-asset background music via the Web Audio API.
 *
 * Layered generative soundtrack: a warm pad chords progression (Am–F–C–G),
 * a sine bass, and a pentatonic arpeggio whose density — plus hi-hat ticks —
 * scale with run intensity. All sounds are synthesised at runtime with
 * oscillators and gain envelopes, so there are no audio files to download.
 *
 * The engine is SSR-safe (guards every access to AudioContext) and lazily
 * creates its context on first use, which satisfies browser autoplay policies
 * when started from a user gesture. It owns a dedicated AudioContext separate
 * from SfxEngine so the two can be disposed independently on mobile.
 *
 * Volume is masterVolume × musicVolume from the existing GameSettings sliders.
 * The layer mix is driven by setIntensity() each frame from run distance:
 *   pad      — always (when playing)
 *   bass     — intensity > 0.15
 *   arpeggio — intensity > 0.35 (probability scales up to ~0.85)
 *   hi-hat   — intensity > 0.7
 */

/** Chord of the four-bar loop, expressed in MIDI note numbers. */
interface ProgressionChord {
  bassMidi: number;
  padMidis: [number, number, number];
  /** Pentatonic-leaning pool the arpeggio random-walks through. */
  scaleMidis: number[];
}

/** i – VI – III – VII in A minor — moody but resolute. */
const PROGRESSION: ProgressionChord[] = [
  { bassMidi: 45, padMidis: [57, 60, 64], scaleMidis: [57, 60, 62, 64, 67, 69, 72, 76] }, // Am
  { bassMidi: 41, padMidis: [53, 57, 60], scaleMidis: [53, 57, 60, 64, 65, 69, 72, 77] }, // F
  { bassMidi: 48, padMidis: [55, 60, 64], scaleMidis: [55, 60, 64, 67, 72, 76, 79, 84] }, // C
  { bassMidi: 43, padMidis: [55, 59, 62], scaleMidis: [55, 59, 62, 67, 71, 74, 79, 83] }, // G
];

const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** Conductor timing — scheduler runs on a coarse timer, audio on the clock. */
const TICK_MS = 100;
const LOOKAHEAD_SEC = 0.3;
const EIGHTH_SEC = 0.25; // 120 BPM
const BAR_EIGHTHS = 8;

export class MusicEngine {
  private ctx: AudioContext | null = null;
  /** masterVolume × musicVolume — the only gain audibility rides on. */
  private masterGain: GainNode | null = null;
  /** Warmth filter for the pad bus. */
  private padFilter: BiquadFilterNode | null = null;
  private _masterVolume = 0.7;
  private _musicVolume = 0.6;
  private _intensity = 0;
  /** Player intent: start() requested. Audibility also requires a live ctx. */
  private _playing = false;
  private _enabled = true;
  private schedulerId: number | null = null;
  private nextNoteTime = 0;
  private eighthIndex = 0;
  /** Random-walk cursor into the current chord's scale pool. */
  private arpStep = 0;

  get masterVolume(): number {
    return this._masterVolume;
  }

  get musicVolume(): number {
    return this._musicVolume;
  }

  get intensity(): number {
    return this._intensity;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  /** True when playback is intended AND the audio clock is actually running. */
  get isPlaying(): boolean {
    return this._playing && this.ctx !== null && this.ctx.state === "running";
  }

  setVolume(master: number, music: number): void {
    this._masterVolume = clamp01(master);
    this._musicVolume = clamp01(music);
    this.applyGain();
  }

  /** 0..1 run intensity — gates the bass/arp/hat layers. */
  setIntensity(intensity: number): void {
    this._intensity = clamp01(intensity);
  }

  /**
   * Master mute (tab hidden). Pauses scheduling but remembers play intent so
   * re-enabling resumes the soundtrack without a fresh start() call.
   */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (!enabled) {
      this.stopScheduler();
      this.applyGain();
    } else if (this._playing) {
      this.applyGain();
      this.startScheduler();
    }
  }

  /**
   * Attempt to (re)initialise the AudioContext. Must be called from a user
   * gesture on browsers that enforce autoplay policies. Safe to call multiple
   * times. Returns true when audio is ready to play.
   */
  resume(): boolean {
    if (!this.ensureContext()) return false;
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return true;
  }

  /** Begin the soundtrack (no-op without a usable AudioContext). */
  start(): void {
    this._playing = true;
    if (!this.ensureContext()) return;
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    this.applyGain();
    this.startScheduler();
  }

  /** Fade the soundtrack out and stop scheduling. */
  stop(fadeSec = 0.5): void {
    this._playing = false;
    this.stopScheduler();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, Math.max(0.01, fadeSec / 3));
    }
  }

  /**
   * Quick dip (e.g. so a game-over stinger reads clearly), recovering on its
   * own. Safe to call when not playing.
   */
  duck(): void {
    if (!this.masterGain || !this.ctx || !this._enabled) return;
    const t = this.ctx.currentTime;
    const peak = this.targetGain() * 0.35;
    this.masterGain.gain.cancelScheduledValues(t);
    this.masterGain.gain.setTargetAtTime(peak, t, 0.05);
    this.masterGain.gain.setTargetAtTime(this.targetGain(), t + 0.5, 0.25);
  }

  /** Release the AudioContext. Safe to call when already closed. */
  dispose(): void {
    this._playing = false;
    this.stopScheduler();
    if (this.ctx) {
      try {
        void this.ctx.close();
      } catch {
        /* already closed */
      }
      this.ctx = null;
      this.masterGain = null;
      this.padFilter = null;
    }
  }

  // ── Context + gain management ───────────────────────────────

  private targetGain(): number {
    return this._enabled ? this._masterVolume * this._musicVolume : 0;
  }

  private applyGain(): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setTargetAtTime(this.targetGain(), this.ctx.currentTime, 0.05);
    }
  }

  private ensureContext(): boolean {
    if (typeof window === "undefined") return false;
    if (this.ctx) return true;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return false;
    try {
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.targetGain();
      this.masterGain.connect(this.ctx.destination);
      this.padFilter = this.ctx.createBiquadFilter();
      this.padFilter.type = "lowpass";
      this.padFilter.frequency.value = 1100;
      this.padFilter.Q.value = 0.4;
      this.padFilter.connect(this.masterGain);
      return true;
    } catch {
      this.ctx = null;
      this.masterGain = null;
      this.padFilter = null;
      return false;
    }
  }

  // ── Conductor ───────────────────────────────────────────────

  private startScheduler(): void {
    if (!this.ctx || this.schedulerId !== null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.schedulerId = window.setInterval(() => this.tick(), TICK_MS);
  }

  private stopScheduler(): void {
    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  private tick(): void {
    if (!this.ctx || !this._playing || !this._enabled) return;
    while (this.nextNoteTime < this.ctx.currentTime + LOOKAHEAD_SEC) {
      this.scheduleEighth(this.eighthIndex, this.nextNoteTime);
      this.eighthIndex++;
      this.nextNoteTime += EIGHTH_SEC;
    }
  }

  private scheduleEighth(index: number, t: number): void {
    const bar = Math.floor(index / BAR_EIGHTHS);
    const pos = index % BAR_EIGHTHS;
    const chord = PROGRESSION[bar % PROGRESSION.length];
    const intensity = this._intensity;

    // Bar downbeat — pad chord + bass root.
    if (pos === 0) {
      for (const midi of chord.padMidis) {
        this.pad(midiToHz(midi), t);
      }
      if (intensity > 0.15) this.bass(midiToHz(chord.bassMidi), t, 0.5);
    }
    // Half-bar bass pulse keeps momentum without clutter.
    if (pos === 4 && intensity > 0.15) {
      this.bass(midiToHz(chord.bassMidi), t, 0.4, 0.8);
    }

    // Arpeggio pluck — probability and brightness scale with intensity.
    if (intensity > 0.35) {
      const probability = Math.min(0.85, 0.3 + intensity * 0.55);
      if (Math.random() < probability) {
        this.arpStep = clampInt(
          this.arpStep + (Math.random() < 0.5 ? -1 : 1),
          0,
          chord.scaleMidis.length - 1,
        );
        const midi = chord.scaleMidis[this.arpStep] + (intensity > 0.7 ? 12 : 0);
        this.pluck(midiToHz(midi), t, 0.07 + intensity * 0.05);
      }
    }

    // Off-eighth hi-hats only in the high-intensity mix.
    if (intensity > 0.7 && pos % 2 === 1) {
      this.hat(t);
    }
  }

  // ── Voices ──────────────────────────────────────────────────

  /** Soft sustained pad tone into the lowpass bus. */
  private pad(freq: number, t: number): void {
    if (!this.ctx || !this.padFilter) return;
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.6);
    gain.gain.setValueAtTime(0.05, t + EIGHTH_SEC * BAR_EIGHTHS - 0.5);
    gain.gain.linearRampToValueAtTime(0, t + EIGHTH_SEC * BAR_EIGHTHS);
    osc.connect(gain);
    gain.connect(this.padFilter);
    osc.start(t);
    osc.stop(t + EIGHTH_SEC * BAR_EIGHTHS + 0.05);
  }

  /** Sine bass note with a fast attack. */
  private bass(freq: number, t: number, duration: number, gainScale = 1): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12 * gainScale, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  /** Short triangle pluck for the arpeggio layer. */
  private pluck(freq: number, t: number, peak: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  /** Filtered noise tick — the hi-hat layer. */
  private hat(t: number): void {
    if (!this.ctx || !this.masterGain) return;
    const length = Math.floor(this.ctx.sampleRate * 0.04);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 6000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.035, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
    src.stop(t + 0.05);
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clampInt(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
