/**
 * Procedural SFX engine — zero-asset sound effects via the Web Audio API.
 *
 * All sounds are synthesised at runtime with oscillators and gain envelopes, so
 * there are no audio files to download. The engine is SSR-safe (guards every
 * access to AudioContext) and lazily creates its context on first use, which
 * satisfies browser autoplay policies when the first sound is triggered by a
 * user gesture (key press / touch).
 *
 * Volume is controlled by the existing GameSettings masterVolume + sfxVolume
 * sliders. A soft per-sound-type throttle prevents the mix from getting muddy
 * when many events fire in the same frame (e.g. burst of coin pickups).
 */

export type SfxName =
  | "jump"
  | "land"
  | "coin"
  | "powerup"
  | "enemyDefeat"
  | "comboTier"
  | "damage"
  | "shieldBreak"
  | "gameOver"
  | "levelComplete"
  | "click";

const MIN_REPEAT_INTERVAL: Partial<Record<SfxName, number>> = {
  coin: 35, // ms — allows fast pickups but caps stacking
  jump: 50,
  land: 60,
  enemyDefeat: 30,
  damage: 120,
  click: 80,
};

export class SfxEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _masterVolume = 0.7;
  private _sfxVolume = 0.8;
  private _enabled = true;
  private lastPlayed: Partial<Record<SfxName, number>> = {};
  /** Hard cap of simultaneously active voices to protect the audio thread. */
  private activeVoices = 0;
  private readonly MAX_VOICES = 16;

  get masterVolume(): number {
    return this._masterVolume;
  }

  get sfxVolume(): number {
    return this._sfxVolume;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  setVolumes(master: number, sfx: number): void {
    this._masterVolume = clamp01(master);
    this._sfxVolume = clamp01(sfx);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this._enabled ? this._masterVolume : 0,
        this.ctx.currentTime,
        0.05,
      );
    }
  }

  /** Disable all sound output (e.g. when tab is hidden). */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        enabled ? this._masterVolume : 0,
        this.ctx.currentTime,
        0.05,
      );
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

  /** True when a usable AudioContext has been created. */
  get isReady(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  play(name: SfxName): void {
    if (!this._enabled || this._sfxVolume <= 0) return;
    if (!this.ensureContext()) return;

    // Throttle repeats
    const now = performance.now();
    const minInterval = MIN_REPEAT_INTERVAL[name];
    if (minInterval !== undefined) {
      const last = this.lastPlayed[name];
      if (last !== undefined && now - last < minInterval) return;
    }
    this.lastPlayed[name] = now;

    if (this.activeVoices >= this.MAX_VOICES) return;
    this.activeVoices++;

    switch (name) {
      case "jump":
        this.playJump();
        break;
      case "land":
        this.playLand();
        break;
      case "coin":
        this.playCoin();
        break;
      case "powerup":
        this.playPowerup();
        break;
      case "enemyDefeat":
        this.playEnemyDefeat();
        break;
      case "comboTier":
        this.playComboTier();
        break;
      case "damage":
        this.playDamage();
        break;
      case "shieldBreak":
        this.playShieldBreak();
        break;
      case "gameOver":
        this.playGameOver();
        break;
      case "levelComplete":
        this.playLevelComplete();
        break;
      case "click":
        this.playClick();
        break;
    }
  }

  /** Release the AudioContext. Safe to call when already closed. */
  dispose(): void {
    if (this.ctx) {
      try {
        void this.ctx.close();
      } catch {
        /* already closed */
      }
      this.ctx = null;
      this.masterGain = null;
    }
  }

  // ── Context management ──────────────────────────────────────

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
      this.masterGain.gain.value = this._enabled ? this._masterVolume : 0;
      this.masterGain.connect(this.ctx.destination);
      return true;
    } catch {
      this.ctx = null;
      this.masterGain = null;
      return false;
    }
  }

  // ── Voice helpers ───────────────────────────────────────────

  private voice(
    config: ToneConfig | ToneConfig[],
    output: GainNode | AudioNode = this.masterGain!,
  ): void {
    if (!this.ctx || !this.masterGain) return;
    const tones = Array.isArray(config) ? config : [config];
    const startAt = this.ctx.currentTime;
    const duration = Math.max(...tones.map((t) => t.duration));
    const out = output;

    for (const tone of tones) {
      const osc = this.ctx.createOscillator();
      osc.type = tone.type;
      osc.frequency.setValueAtTime(tone.startFreq, startAt);
      if (tone.endFreq !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(0.01, tone.endFreq),
          startAt + tone.duration,
        );
      }
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, startAt);
      const peak = clamp01(tone.gain * this._sfxVolume);
      gain.gain.linearRampToValueAtTime(peak, startAt + tone.attack);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        startAt + tone.duration,
      );
      osc.connect(gain);
      gain.connect(out);
      osc.start(startAt);
      osc.stop(startAt + tone.duration + 0.02);
    }

    // Release the active-voice slot once everything finishes.
    const releaseMs = duration * 1000 + 30;
    window.setTimeout(() => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    }, releaseMs);
  }

  private noiseBuffer(seconds: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private noiseBurst(opts: {
    duration: number;
    gain: number;
    filterFreq?: number;
    filterQ?: number;
    type?: BiquadFilterType;
  }): void {
    if (!this.ctx || !this.masterGain) return;
    const buffer = this.noiseBuffer(opts.duration);
    if (!buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    const startAt = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(
      clamp01(opts.gain * this._sfxVolume),
      startAt + 0.005,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + opts.duration);

    let node: AudioNode = src;
    if (opts.filterFreq !== undefined) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = opts.type ?? "bandpass";
      filter.frequency.value = opts.filterFreq;
      filter.Q.value = opts.filterQ ?? 1;
      src.connect(filter);
      node = filter;
    }
    node.connect(gain);
    gain.connect(this.masterGain);
    src.start(startAt);
    src.stop(startAt + opts.duration + 0.02);

    window.setTimeout(() => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    }, opts.duration * 1000 + 30);
  }

  // ── Individual SFX ──────────────────────────────────────────

  private playJump(): void {
    this.voice({
      type: "square",
      startFreq: 280,
      endFreq: 560,
      duration: 0.12,
      attack: 0.005,
      gain: 0.18,
    });
  }

  private playLand(): void {
    this.voice(
      {
        type: "sine",
        startFreq: 160,
        endFreq: 60,
        duration: 0.08,
        attack: 0.002,
        gain: 0.14,
      },
    );
    this.activeVoices++;
    this.noiseBurst({ duration: 0.06, gain: 0.08, filterFreq: 800, filterQ: 0.7, type: "lowpass" });
  }

  private playCoin(): void {
    this.voice([
      { type: "square", startFreq: 988, duration: 0.06, attack: 0.002, gain: 0.12 },
      { type: "square", startFreq: 1319, duration: 0.10, attack: 0.002, gain: 0.12 },
    ]);
  }

  private playPowerup(): void {
    this.voice([
      { type: "triangle", startFreq: 523, endFreq: 784, duration: 0.10, attack: 0.005, gain: 0.16 },
      { type: "triangle", startFreq: 784, endFreq: 1047, duration: 0.14, attack: 0.005, gain: 0.16 },
    ]);
  }

  private playEnemyDefeat(): void {
    this.voice({
      type: "sawtooth",
      startFreq: 420,
      endFreq: 90,
      duration: 0.16,
      attack: 0.003,
      gain: 0.18,
    });
    this.activeVoices++;
    this.noiseBurst({ duration: 0.10, gain: 0.12, filterFreq: 1200, filterQ: 0.6, type: "bandpass" });
  }

  private playComboTier(): void {
    // Bright rising arpeggio to celebrate the multiplier tier-up.
    this.voice([
      { type: "triangle", startFreq: 659, duration: 0.10, attack: 0.003, gain: 0.16 },
      { type: "triangle", startFreq: 880, duration: 0.12, attack: 0.003, gain: 0.16 },
      { type: "triangle", startFreq: 1175, duration: 0.18, attack: 0.003, gain: 0.18 },
    ]);
  }

  private playDamage(): void {
    this.voice({
      type: "sawtooth",
      startFreq: 220,
      endFreq: 70,
      duration: 0.22,
      attack: 0.004,
      gain: 0.22,
    });
    this.activeVoices++;
    this.noiseBurst({ duration: 0.12, gain: 0.14, filterFreq: 500, filterQ: 0.5, type: "lowpass" });
  }

  private playShieldBreak(): void {
    this.voice([
      { type: "sine", startFreq: 1047, endFreq: 1568, duration: 0.08, attack: 0.002, gain: 0.14 },
      { type: "sine", startFreq: 1568, endFreq: 2093, duration: 0.10, attack: 0.002, gain: 0.12 },
    ]);
  }

  private playGameOver(): void {
    // Descending minor scale — sombre but short.
    this.voice([
      { type: "triangle", startFreq: 392, duration: 0.18, attack: 0.01, gain: 0.18 },
      { type: "triangle", startFreq: 349, duration: 0.18, attack: 0.01, gain: 0.18 },
      { type: "triangle", startFreq: 294, duration: 0.36, attack: 0.01, gain: 0.20 },
    ]);
  }

  private playLevelComplete(): void {
    // Ascending major arpeggio — victory fanfare.
    this.voice([
      { type: "triangle", startFreq: 523, duration: 0.12, attack: 0.005, gain: 0.18 },
      { type: "triangle", startFreq: 659, duration: 0.12, attack: 0.005, gain: 0.18 },
      { type: "triangle", startFreq: 784, duration: 0.12, attack: 0.005, gain: 0.18 },
      { type: "triangle", startFreq: 1047, duration: 0.32, attack: 0.005, gain: 0.22 },
    ]);
  }

  private playClick(): void {
    this.voice({
      type: "square",
      startFreq: 660,
      endFreq: 880,
      duration: 0.04,
      attack: 0.001,
      gain: 0.08,
    });
  }
}

interface ToneConfig {
  type: OscillatorType;
  startFreq: number;
  endFreq?: number;
  duration: number;
  /** Attack time in seconds (0 = instant). */
  attack: number;
  /** Peak gain (0..1), before sfxVolume scaling. */
  gain: number;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
