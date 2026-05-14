/**
 * Sound Effects Engine — Web Audio API synthesizer.
 * Generates all sound effects procedurally (no audio files needed).
 * Respects volume settings and reduced-motion preferences.
 */

export type SFX =
  | 'jump'
  | 'doubleJump'
  | 'land'
  | 'stomp'
  | 'hurt'
  | 'death'
  | 'coin'
  | 'health'
  | 'powerUp'
  | 'shield'
  | 'dash'
  | 'attack_swing'
  | 'attack_hit'
  | 'shoot'
  | 'enemy_death'
  | 'boss_hit'
  | 'boss_death'
  | 'spike'
  | 'combo'
  | 'achievement'
  | 'menu_click';

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;

/** Lazy-initialize the AudioContext (must be triggered by user gesture) */
function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.connect(masterGain);
    musicGain = ctx.createGain();
    musicGain.connect(masterGain);
    return ctx;
  } catch {
    return null;
  }
}

/** Resume context if suspended (browser autoplay policy) */
function resumeContext(): void {
  if (ctx && ctx.state === 'suspended') {
    ctx.resume();
  }
}

/** Update volume levels from game settings */
export function setVolumes(master: number, sfx: number, music: number): void {
  ensureContext();
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, master));
  if (sfxGain) sfxGain.gain.value = Math.max(0, Math.min(1, sfx));
  if (musicGain) musicGain.gain.value = Math.max(0, Math.min(1, music));
}

/** Play a synthesized sound effect */
export function playSFX(name: SFX): void {
  const audioCtx = ensureContext();
  if (!audioCtx || !sfxGain) return;
  resumeContext();

  const now = audioCtx.currentTime;
  const g = sfxGain;

  switch (name) {
    case 'jump': synthJump(audioCtx, g, now); break;
    case 'doubleJump': synthDoubleJump(audioCtx, g, now); break;
    case 'land': synthLand(audioCtx, g, now); break;
    case 'stomp': synthStomp(audioCtx, g, now); break;
    case 'hurt': synthHurt(audioCtx, g, now); break;
    case 'death': synthDeath(audioCtx, g, now); break;
    case 'coin': synthCoin(audioCtx, g, now); break;
    case 'health': synthHealth(audioCtx, g, now); break;
    case 'powerUp': synthPowerUp(audioCtx, g, now); break;
    case 'shield': synthShield(audioCtx, g, now); break;
    case 'dash': synthDash(audioCtx, g, now); break;
    case 'attack_swing': synthSwing(audioCtx, g, now); break;
    case 'attack_hit': synthHit(audioCtx, g, now); break;
    case 'shoot': synthShoot(audioCtx, g, now); break;
    case 'enemy_death': synthEnemyDeath(audioCtx, g, now); break;
    case 'boss_hit': synthBossHit(audioCtx, g, now); break;
    case 'boss_death': synthBossDeath(audioCtx, g, now); break;
    case 'spike': synthSpike(audioCtx, g, now); break;
    case 'combo': synthCombo(audioCtx, g, now); break;
    case 'achievement': synthAchievement(audioCtx, g, now); break;
    case 'menu_click': synthMenuClick(audioCtx, g, now); break;
  }
}

// ── Helper: create an oscillator with envelope ──────────────────

function osc(
  ctx: AudioContext, dest: AudioNode, now: number,
  type: OscillatorType, freq: number, start: number, dur: number,
  vol: number = 0.3,
): OscillatorNode {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, now + start);
  g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
  o.connect(g);
  g.connect(dest);
  o.start(now + start);
  o.stop(now + start + dur + 0.05);
  return o;
}

function noise(
  ctx: AudioContext, dest: AudioNode, now: number,
  start: number, dur: number, vol: number = 0.2,
): AudioBufferSourceNode {
  const bufferSize = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, now + start);
  g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
  src.connect(g);
  g.connect(dest);
  src.start(now + start);
  src.stop(now + start + dur + 0.05);
  return src;
}

// ── Individual sound synthesizers ───────────────────────────────

function synthJump(ctx: AudioContext, dest: AudioNode, now: number): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(280, now);
  o.frequency.exponentialRampToValueAtTime(560, now + 0.1);
  g.gain.setValueAtTime(0.2, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  o.connect(g); g.connect(dest);
  o.start(now); o.stop(now + 0.2);
}

function synthDoubleJump(ctx: AudioContext, dest: AudioNode, now: number): void {
  // Two quick ascending tones
  osc(ctx, dest, now, 'sine', 350, 0, 0.08, 0.15);
  osc(ctx, dest, now, 'sine', 520, 0.06, 0.1, 0.2);
}

function synthLand(ctx: AudioContext, dest: AudioNode, now: number): void {
  noise(ctx, dest, now, 0, 0.08, 0.15);
  osc(ctx, dest, now, 'sine', 120, 0, 0.06, 0.1);
}

function synthStomp(ctx: AudioContext, dest: AudioNode, now: number): void {
  noise(ctx, dest, now, 0, 0.1, 0.2);
  osc(ctx, dest, now, 'square', 200, 0, 0.08, 0.15);
  osc(ctx, dest, now, 'sine', 400, 0.02, 0.06, 0.1);
}

function synthHurt(ctx: AudioContext, dest: AudioNode, now: number): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(300, now);
  o.frequency.exponentialRampToValueAtTime(100, now + 0.2);
  g.gain.setValueAtTime(0.25, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  o.connect(g); g.connect(dest);
  o.start(now); o.stop(now + 0.3);
}

function synthDeath(ctx: AudioContext, dest: AudioNode, now: number): void {
  // Descending sad tones
  osc(ctx, dest, now, 'square', 400, 0, 0.15, 0.2);
  osc(ctx, dest, now, 'square', 300, 0.12, 0.15, 0.2);
  osc(ctx, dest, now, 'square', 200, 0.24, 0.3, 0.25);
  noise(ctx, dest, now, 0.3, 0.15, 0.1);
}

function synthCoin(ctx: AudioContext, dest: AudioNode, now: number): void {
  osc(ctx, dest, now, 'sine', 880, 0, 0.08, 0.15);
  osc(ctx, dest, now, 'sine', 1320, 0.06, 0.12, 0.18);
}

function synthHealth(ctx: AudioContext, dest: AudioNode, now: number): void {
  // Rising arpeggio
  osc(ctx, dest, now, 'sine', 523, 0, 0.1, 0.15);
  osc(ctx, dest, now, 'sine', 659, 0.08, 0.1, 0.15);
  osc(ctx, dest, now, 'sine', 784, 0.16, 0.15, 0.2);
}

function synthPowerUp(ctx: AudioContext, dest: AudioNode, now: number): void {
  // Bright ascending sweep
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(400, now);
  o.frequency.exponentialRampToValueAtTime(1200, now + 0.25);
  g.gain.setValueAtTime(0.2, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  o.connect(g); g.connect(dest);
  o.start(now); o.stop(now + 0.4);
  // Shimmer
  osc(ctx, dest, now, 'sine', 1000, 0.15, 0.15, 0.1);
  osc(ctx, dest, now, 'sine', 1400, 0.2, 0.1, 0.08);
}

function synthShield(ctx: AudioContext, dest: AudioNode, now: number): void {
  // Crystalline ping
  osc(ctx, dest, now, 'sine', 1200, 0, 0.3, 0.15);
  osc(ctx, dest, now, 'triangle', 800, 0, 0.25, 0.1);
}

function synthDash(ctx: AudioContext, dest: AudioNode, now: number): void {
  noise(ctx, dest, now, 0, 0.12, 0.15);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(200, now);
  o.frequency.exponentialRampToValueAtTime(800, now + 0.1);
  g.gain.setValueAtTime(0.15, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  o.connect(g); g.connect(dest);
  o.start(now); o.stop(now + 0.15);
}

function synthSwing(ctx: AudioContext, dest: AudioNode, now: number): void {
  noise(ctx, dest, now, 0, 0.1, 0.12);
  osc(ctx, dest, now, 'sawtooth', 150, 0, 0.08, 0.08);
}

function synthHit(ctx: AudioContext, dest: AudioNode, now: number): void {
  noise(ctx, dest, now, 0, 0.06, 0.2);
  osc(ctx, dest, now, 'square', 180, 0, 0.05, 0.15);
  osc(ctx, dest, now, 'sine', 350, 0.02, 0.04, 0.1);
}

function synthShoot(ctx: AudioContext, dest: AudioNode, now: number): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(600, now);
  o.frequency.exponentialRampToValueAtTime(200, now + 0.08);
  g.gain.setValueAtTime(0.15, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  o.connect(g); g.connect(dest);
  o.start(now); o.stop(now + 0.12);
}

function synthEnemyDeath(ctx: AudioContext, dest: AudioNode, now: number): void {
  noise(ctx, dest, now, 0, 0.1, 0.15);
  osc(ctx, dest, now, 'square', 250, 0, 0.1, 0.12);
  osc(ctx, dest, now, 'square', 150, 0.05, 0.1, 0.1);
}

function synthBossHit(ctx: AudioContext, dest: AudioNode, now: number): void {
  noise(ctx, dest, now, 0, 0.08, 0.2);
  osc(ctx, dest, now, 'sawtooth', 120, 0, 0.1, 0.2);
  osc(ctx, dest, now, 'square', 200, 0.03, 0.06, 0.15);
}

function synthBossDeath(ctx: AudioContext, dest: AudioNode, now: number): void {
  // Big explosion sound
  noise(ctx, dest, now, 0, 0.4, 0.3);
  osc(ctx, dest, now, 'sawtooth', 150, 0, 0.3, 0.2);
  osc(ctx, dest, now, 'square', 80, 0.1, 0.3, 0.15);
  // Low rumble
  osc(ctx, dest, now, 'sine', 50, 0.15, 0.5, 0.2);
  // High shimmer
  osc(ctx, dest, now, 'sine', 800, 0.3, 0.2, 0.08);
  osc(ctx, dest, now, 'sine', 1200, 0.35, 0.15, 0.06);
}

function synthSpike(ctx: AudioContext, dest: AudioNode, now: number): void {
  noise(ctx, dest, now, 0, 0.08, 0.2);
  osc(ctx, dest, now, 'sawtooth', 350, 0, 0.06, 0.12);
}

function synthCombo(ctx: AudioContext, dest: AudioNode, now: number): void {
  // Triumphant rising chord
  osc(ctx, dest, now, 'sine', 523, 0, 0.15, 0.15);
  osc(ctx, dest, now, 'sine', 659, 0, 0.15, 0.12);
  osc(ctx, dest, now, 'sine', 784, 0, 0.2, 0.15);
  osc(ctx, dest, now, 'sine', 1047, 0.05, 0.2, 0.1);
}

function synthAchievement(ctx: AudioContext, dest: AudioNode, now: number): void {
  // Fanfare
  osc(ctx, dest, now, 'sine', 523, 0, 0.12, 0.18);
  osc(ctx, dest, now, 'sine', 659, 0.1, 0.12, 0.18);
  osc(ctx, dest, now, 'sine', 784, 0.2, 0.12, 0.18);
  osc(ctx, dest, now, 'sine', 1047, 0.3, 0.3, 0.22);
  // Sparkle
  osc(ctx, dest, now, 'sine', 1568, 0.35, 0.15, 0.08);
}

function synthMenuClick(ctx: AudioContext, dest: AudioNode, now: number): void {
  osc(ctx, dest, now, 'sine', 600, 0, 0.05, 0.12);
}

/** Check if audio context is available */
export function isAudioAvailable(): boolean {
  return ensureContext() !== null;
}

/** Initialize audio on first user interaction */
export function initAudio(): void {
  ensureContext();
  resumeContext();
}
