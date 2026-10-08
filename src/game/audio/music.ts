/**
 * Procedural music engine — zero-asset background music via the Web Audio API.
 *
 * Layered generative soundtrack that grows from moody to FULL 8-BIT ANTHEM
 * as the run heats up: a warm pad chords progression (Am–F–C–G), a bass that
 * switches from sine pulses to a driving square walk, a pentatonic arpeggio,
 * a COMPOSED square-wave lead melody (the 8-bit hook), kick/snare/hat drums,
 * and a tempo that ramps 120 → ~158 BPM with intensity. All sounds are
 * synthesised at runtime with oscillators and gain envelopes, so there are
 * no audio files to download.
 *
 * The engine is SSR-safe (guards every access to AudioContext) and lazily
 * creates its context on first use, which satisfies browser autoplay policies
 * when started from a user gesture. It owns a dedicated AudioContext separate
 * from SfxEngine so the two can be disposed independently on mobile.
 *
 * Volume is masterVolume × musicVolume from the existing GameSettings sliders.
 * The layer mix is driven by setIntensity() each frame from run distance:
 *   pad        — always (when playing)
 *   bass       — intensity > 0.15 (square walk eighths above 0.6)
 *   lead       — intensity > 0.45 (authored square melody, the hype hook)
 *   snare      — intensity > 0.5 (backbeat on 2 and 4)
 *   kick       — intensity > 0.55 (downbeats)
 *   arpeggio   — intensity > 0.35 (probability scales up to ~0.85)
 *   hi-hat     — intensity > 0.7 (off-eighths)
 *
 * The track is a 16-bar SONG FORM — 8-bar verse (the authored hook), a
 * 4-bar bridge lift (F–G–Am–E), then the verse's first phrase again — with
 * snare fills rolling into each section seam and a crash on the new
 * section's downbeat. The kick pumps the pad bus (sidechain separation),
 * lead/arp/hat/crash sit across the stereo field, and the last eighth of
 * each phrase walks the bass into the next chord's root.
 *
 * setScene("menu") idles the same soundtrack as a mellow ambience under the
 * menus (pads + bass + sparse arp; no hook, no drums) so starting a run
 * ignites the anthem the menu was teasing.
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

/**
 * The 8-bit lead hook: an AUTHORED melody (not a random walk) over the
 * progression — two four-bar phrases, 8 eighths per bar, 0 = rest. First
 * pass stays mid-register and groovy; the answer phrase jumps an octave
 * for the hype peak. Chord tones on the strong eighths, rests on the off.
 */
const LEAD_MELODY: number[][] = [
  [69, 0, 72, 76, 0, 72, 69, 67], // Am
  [65, 0, 69, 72, 0, 69, 65, 64], // F
  [64, 0, 67, 72, 0, 76, 72, 67], // C
  [62, 0, 67, 71, 0, 74, 71, 67], // G
  [81, 79, 76, 79, 81, 0, 84, 81], // Am (answer, octave up)
  [77, 76, 72, 76, 77, 0, 81, 77], // F
  [76, 72, 67, 72, 76, 0, 79, 84], // C
  [74, 71, 67, 71, 74, 0, 74, 79], // G
];

/**
 * The bridge hook: a four-bar climb over F–G–Am that peaks on the high A,
 * then the E chord drags it back down the dominant to hand off to the verse.
 */
const BRIDGE_MELODY: number[][] = [
  [65, 0, 69, 72, 74, 72, 69, 65], // F
  [67, 0, 71, 74, 76, 74, 71, 67], // G
  [69, 72, 76, 0, 81, 0, 76, 72], // Am (the peak)
  [76, 0, 80, 76, 74, 71, 68, 0], // E (dominant descent)
];

/**
 * The bridge lift: IV–V–i–V (F–G–Am–E) — a four-bar harmonic rise that
 * pulls back into the home progression. The E chord borrows G# from the
 * harmonic minor for a proper dominant-edge resolve.
 */
const BRIDGE_PROGRESSION: ProgressionChord[] = [
  { bassMidi: 41, padMidis: [53, 57, 60], scaleMidis: [53, 57, 60, 65, 69, 72, 77] }, // F
  { bassMidi: 43, padMidis: [55, 59, 62], scaleMidis: [55, 59, 62, 67, 71, 74, 79] }, // G
  { bassMidi: 45, padMidis: [57, 60, 64], scaleMidis: [57, 60, 64, 69, 72, 76, 81] }, // Am
  { bassMidi: 40, padMidis: [56, 59, 64], scaleMidis: [56, 59, 64, 68, 71, 76, 80] }, // E
];

const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** Conductor timing — scheduler runs on a coarse timer, audio on the clock. */
const TICK_MS = 100;
const LOOKAHEAD_SEC = 0.3;
/** Eighth-note duration range: 0.25s (120 BPM) → 0.19s (~158 BPM) at full intensity. */
const EIGHTH_SLOW_SEC = 0.25;
const EIGHTH_FAST_SEC = 0.19;
const BAR_EIGHTHS = 8;

/**
 * Song form: 8 bars of the verse (the authored hook), 4 bars of bridge,
 * 4 bars of the verse's first phrase — then the cycle repeats. The last
 * bar of each section rolls a snare fill; the new section opens with a
 * crash once the anthem is fully lit.
 */
const FORM_BARS = 16;
const BRIDGE_START = 8;
const A2_START = 12;

/** Fixed intensity of the menu ambience — pads + bass + sparse arp, no hook. */
const MENU_INTENSITY = 0.38;

/** Stereo placement (−1 left .. +1 right); centre voices skip the panner. */
const LEAD_PAN = 0.2;
const ARP_PAN = -0.35;
const HAT_PAN = 0.3;
const CRASH_PAN = -0.15;

/** What one bar of the 16-bar form contributes to the schedule. */
export interface FormSlot {
  chord: ProgressionChord;
  melodyBar: number[];
  isFillBar: boolean;
  isSectionDownbeat: boolean;
}

/**
 * Pure bar → form mapping (exported for the arrangement tests). Form bar
 * 0-7 = verse, 8-11 = bridge, 12-15 = the verse's first phrase again.
 */
export function formSlotForBar(bar: number): FormSlot {
  const formBar = ((bar % FORM_BARS) + FORM_BARS) % FORM_BARS;
  if (formBar < BRIDGE_START) {
    return {
      chord: PROGRESSION[formBar % PROGRESSION.length],
      melodyBar: LEAD_MELODY[formBar],
      isFillBar: formBar === 7,
      isSectionDownbeat: false,
    };
  }
  if (formBar < A2_START) {
    const bridgeBar = formBar - BRIDGE_START;
    return {
      chord: BRIDGE_PROGRESSION[bridgeBar],
      melodyBar: BRIDGE_MELODY[bridgeBar],
      isFillBar: formBar === 11,
      isSectionDownbeat: formBar === BRIDGE_START,
    };
  }
  const a2Bar = formBar - A2_START;
  return {
    chord: PROGRESSION[a2Bar],
    melodyBar: LEAD_MELODY[a2Bar],
    isFillBar: false,
    isSectionDownbeat: a2Bar === 0,
  };
}

export class MusicEngine {
  private ctx: AudioContext | null = null;
  /** masterVolume × musicVolume — the only gain audibility rides on. */
  private masterGain: GainNode | null = null;
  /** Warmth filter for the pad bus. */
  private padFilter: BiquadFilterNode | null = null;
  /** Pad-only gain node — the kick pumps it for sidechain separation. */
  private padBus: GainNode | null = null;
  private _masterVolume = 0.7;
  private _musicVolume = 0.6;
  private _intensity = 0;
  /** Which mix the soundtrack is in: "menu" idles low, "run" follows intensity. */
  private _scene: "menu" | "run" = "run";
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

  /** Eighth-note duration shrinks as intensity rises — the track speeds up. */
  private eighthDuration(): number {
    return EIGHTH_SLOW_SEC - (EIGHTH_SLOW_SEC - EIGHTH_FAST_SEC) * this._intensity;
  }

  /** Readable tempo for tests/UI: 120 BPM calm → ~158 BPM at full hype. */
  get tempoBpm(): number {
    return Math.round(30 / this.eighthDuration());
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
   * Select the mix: "run" follows setIntensity, "menu" pins a mellow
   * ambience (pads + bass + sparse arp — the hook and drums stay dark).
   */
  setScene(scene: "menu" | "run"): void {
    this._scene = scene;
  }

  get scene(): "menu" | "run" {
    return this._scene;
  }

  /** Layer intensity actually used for scheduling this tick. */
  private effectiveIntensity(): number {
    return this._scene === "menu" ? MENU_INTENSITY : this._intensity;
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
      this.padBus = null;
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
      this.padBus = this.ctx.createGain();
      this.padBus.gain.value = 1;
      this.padFilter.connect(this.padBus);
      this.padBus.connect(this.masterGain);
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
      this.nextNoteTime += this.eighthDuration();
    }
  }

  private scheduleEighth(index: number, t: number): void {
    const bar = Math.floor(index / BAR_EIGHTHS);
    const pos = index % BAR_EIGHTHS;
    const slot = formSlotForBar(bar);
    const chord = slot.chord;
    const intensity = this.effectiveIntensity();
    const eighth = this.eighthDuration();
    const barDur = eighth * BAR_EIGHTHS;

    // Bar downbeat — pad chord + bass root.
    if (pos === 0) {
      for (const midi of chord.padMidis) {
        this.pad(midiToHz(midi), t, barDur);
      }
      if (intensity > 0.15) this.bass(midiToHz(chord.bassMidi), t, 0.5, 1, intensity > 0.6);
    }
    // Half-bar bass pulse keeps momentum without clutter.
    if (pos === 4 && intensity > 0.15) {
      this.bass(midiToHz(chord.bassMidi), t, 0.4, 0.8, intensity > 0.6);
    }
    // Hype bass: walking eighths on 2 and 6 (root, then octave jump).
    if (intensity > 0.6 && (pos === 2 || pos === 6)) {
      this.bass(midiToHz(chord.bassMidi + (pos === 6 ? 12 : 0)), t, eighth * 0.8, 0.7, true);
    }
    // Walk-up: the last eighth of a phrase leans on the NEXT chord's root
    // so each section seam pulls forward instead of resetting.
    if (intensity > 0.6 && pos === 7 && bar % 4 === 3) {
      const next = formSlotForBar(bar + 1).chord;
      this.bass(midiToHz(next.bassMidi), t, eighth * 0.7, 0.55, true);
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

    // The composed square-wave hook — the 8-bit anthem rides on top once
    // the run is properly heated.
    if (intensity > 0.45) {
      const midi = slot.melodyBar[pos];
      if (midi > 0) {
        this.lead(midiToHz(midi), t, eighth * 0.92, 0.4 + intensity * 0.6);
      }
    }

    // Drums: snare backbeat, kick downbeats, off-eighth hats on top. The
    // last bar of each section rolls a full snare fill; the new section
    // opens with a crash once the anthem is lit.
    const backbeat = intensity > 0.5 && (pos === 2 || pos === 6);
    const fillRoll = slot.isFillBar && intensity > 0.6;
    if (backbeat || fillRoll) {
      this.snare(t);
    }
    if (intensity > 0.55 && (pos === 0 || pos === 4)) {
      this.kick(t);
    }
    if (intensity > 0.55 && slot.isSectionDownbeat && pos === 0) {
      this.crash(t);
    }
    if (intensity > 0.7 && pos % 2 === 1) {
      this.hat(t);
    }
  }

  // ── Voices ──────────────────────────────────────────────────

  /** Soft sustained pad tone into the lowpass bus. Bar length is tempo-aware. */
  private pad(freq: number, t: number, barDur: number): void {
    if (!this.ctx || !this.padFilter) return;
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.6);
    gain.gain.setValueAtTime(0.05, t + barDur - 0.5);
    gain.gain.linearRampToValueAtTime(0, t + barDur);
    osc.connect(gain);
    gain.connect(this.padFilter);
    osc.start(t);
    osc.stop(t + barDur + 0.05);
  }

  /** Bass note — sine when calm, square when the hype bass walks. */
  private bass(freq: number, t: number, duration: number, gainScale = 1, square = false): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = square ? "square" : "sine";
    osc.frequency.setValueAtTime(freq, t);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime((square ? 0.08 : 0.12) * gainScale, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  /**
   * The 8-bit lead: a bright square with a sub-octave square doubling for
   * thickness — the classic two-pulse chiptune lead.
   */
  private lead(freq: number, t: number, duration: number, gainScale: number): void {
    if (!this.ctx || !this.masterGain) return;
    const voice = (f: number, peak: number) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(f, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain);
      this.connectPanned(gain, LEAD_PAN);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    };
    voice(freq, 0.045 * gainScale);
    voice(freq / 2, 0.02 * gainScale);
  }

  /** Kick: a fast sine pitch-drop on the downbeats, pumping the pad bus. */
  private kick(t: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.1);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.26, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
    // Sidechain pump: duck the pads under the kick so it punches through.
    if (this.padBus) {
      const bus = this.padBus.gain;
      bus.cancelScheduledValues(t);
      bus.setValueAtTime(bus.value, t);
      bus.linearRampToValueAtTime(0.45, t + 0.02);
      bus.linearRampToValueAtTime(1, t + 0.28);
    }
  }

  /**
   * Route a voice through the stereo field when the browser supports it;
   * centre voices (bass/kick/snare/pad) connect straight to the master.
   */
  private connectPanned(node: AudioNode, pan: number): void {
    if (!this.ctx || !this.masterGain) return;
    if (typeof this.ctx.createStereoPanner === "function") {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      node.connect(panner);
      panner.connect(this.masterGain);
      return;
    }
    node.connect(this.masterGain);
  }

  /** Crash: a long bright noise wash marking a new section of the form. */
  private crash(t: number): void {
    if (!this.ctx || !this.masterGain) return;
    const length = Math.floor(this.ctx.sampleRate * 0.9);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 3800;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    src.connect(filter);
    filter.connect(gain);
    this.connectPanned(gain, CRASH_PAN);
    src.start(t);
    src.stop(t + 0.9);
  }

  /** Snare: a bandpassed noise crack on the backbeat. */
  private snare(t: number): void {
    if (!this.ctx || !this.masterGain) return;
    const length = Math.floor(this.ctx.sampleRate * 0.09);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    filter.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
    src.stop(t + 0.1);
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
    this.connectPanned(gain, ARP_PAN);
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
    this.connectPanned(gain, HAT_PAN);
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
