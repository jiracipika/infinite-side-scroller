import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * SfxEngine is designed to be SSR-safe: all AudioContext access is guarded
 * behind `typeof window !== 'undefined'`. In the Node test environment there
 * is no window, so every method should gracefully degrade without throwing.
 *
 * These tests verify the logic paths that DO execute in a non-browser
 * environment: volume clamping, enabled toggling, and the singleton factory.
 * The actual sound synthesis is exercised in browser E2E, not here.
 */

import { SfxEngine, getSfxEngine, sfxEngineExists, landingGainScale } from '@/game/audio/index';

describe('SfxEngine', () => {
  let sfx: SfxEngine;

  beforeEach(() => {
    sfx = new SfxEngine();
  });

  it('clamps volumes to [0, 1]', () => {
    sfx.setVolumes(1.5, -0.5);
    assert.ok(sfx.masterVolume <= 1, 'master should be clamped to 1');
    assert.ok(sfx.sfxVolume >= 0, 'sfx should be clamped to 0');
    assert.equal(sfx.masterVolume, 1);
    assert.equal(sfx.sfxVolume, 0);
  });

  it('clamps volumes via setVolumes boundary values', () => {
    sfx.setVolumes(0, 1);
    assert.equal(sfx.masterVolume, 0);
    assert.equal(sfx.sfxVolume, 1);

    sfx.setVolumes(0.5, 0.5);
    assert.equal(sfx.masterVolume, 0.5);
    assert.equal(sfx.sfxVolume, 0.5);
  });

  it('starts enabled', () => {
    assert.equal(sfx.enabled, true);
  });

  it('toggles enabled state', () => {
    sfx.setEnabled(false);
    assert.equal(sfx.enabled, false);
    sfx.setEnabled(true);
    assert.equal(sfx.enabled, true);
  });

  it('play() never throws in non-browser environment', () => {
    assert.doesNotThrow(() => {
      sfx.play('jump');
      sfx.play('coin');
      sfx.play('click');
      sfx.play('gameOver');
      sfx.play('redeemSuccess');
      sfx.play('redeemReject');
    });
  });

  it('play() is safe when disabled', () => {
    sfx.setEnabled(false);
    assert.doesNotThrow(() => sfx.play('jump'));
  });

  it('play() is safe when sfxVolume is 0', () => {
    sfx.setVolumes(0.5, 0);
    assert.doesNotThrow(() => sfx.play('jump'));
  });

  it('resume() returns false in non-browser environment', () => {
    assert.equal(sfx.resume(), false);
  });

  it('dispose() is safe to call multiple times', () => {
    assert.doesNotThrow(() => {
      sfx.dispose();
      sfx.dispose();
    });
  });
});

describe('SfxEngine singleton', () => {
  it('getSfxEngine returns a new instance on first call', () => {
    // sfxEngineExists may be true if a prior test created the singleton.
    // What matters is that getSfxEngine never returns null/undefined.
    const engine = getSfxEngine();
    assert.ok(engine instanceof SfxEngine);
  });

  it('getSfxEngine returns the same instance on subsequent calls', () => {
    const a = getSfxEngine();
    const b = getSfxEngine();
    assert.equal(a, b, 'singleton should return same reference');
  });

  it('sfxEngineExists returns true after getSfxEngine', () => {
    getSfxEngine();
    assert.equal(sfxEngineExists(), true);
  });
});

describe('SfxEngine: double jump tone', () => {
  it('plays without throwing in the Node (no AudioContext) environment', () => {
    const sfx = new SfxEngine();
    assert.doesNotThrow(() => sfx.play('doubleJump'));
    assert.doesNotThrow(() => sfx.play('doubleJump')); // throttle path too
  });
});

describe('landingGainScale + per-call gain scale', () => {
  it('maps landing intensity to a 0.7–1.3 gain scale', () => {
    assert.equal(landingGainScale(0.6), 0.7, 'softest landing floor');
    assert.equal(landingGainScale(1.9), 1.3, 'terminal-velocity ceiling');
    const mid = landingGainScale(1.25);
    assert.ok(mid > 0.7 && mid < 1.3, 'mid intensity between bounds');
    // Out-of-range intensities clamp to the same bounds.
    assert.equal(landingGainScale(0), 0.7);
    assert.equal(landingGainScale(99), 1.3);
    assert.equal(landingGainScale(-5), 0.7);
  });

  it('play() with a gain scale degrades safely without AudioContext', () => {
    const sfx = new SfxEngine();
    assert.doesNotThrow(() => sfx.play('land', 1.3));
    assert.doesNotThrow(() => sfx.play('land', 0.2));
    assert.doesNotThrow(() => sfx.play('land', 99)); // clamped
    // Subsequent calls revert to unity scale without throwing.
    assert.doesNotThrow(() => sfx.play('jump'));
  });
});

describe('SfxName inventory (source contract)', () => {
  const src = readFileSync(new URL('../src/game/audio/sfx.ts', import.meta.url), 'utf8');

  it('pins the full 14-sound inventory', () => {
    const union = src.match(/export type SfxName =([\s\S]*?);/)![1];
    const names = [...union.matchAll(/\| "(\w+)"/g)].map((m) => m[1]);
    assert.equal(names.length, 14, `expected 14 SfxName entries, found ${names.length}`);
    assert.deepEqual([...names].sort(), [
      'click', 'coin', 'comboTier', 'damage', 'doubleJump', 'enemyDefeat',
      'gameOver', 'jump', 'land', 'levelComplete', 'powerup',
      'redeemReject', 'redeemSuccess', 'shieldBreak',
    ].sort());
  });

  it('every SfxName has a dispatch case in play()', () => {
    const union = src.match(/export type SfxName =([\s\S]*?);/)![1];
    for (const name of [...union.matchAll(/\| "(\w+)"/g)].map((m) => m[1])) {
      assert.match(src, new RegExp(`case "${name}":`), `missing case for ${name}`);
    }
  });
});

/**
 * Browser-path synthesis checks. A minimal fake AudioContext is installed on
 * globalThis.window so SfxEngine.ensureContext succeeds and voice() runs its
 * real oscillator/gain wiring; every started oscillator is recorded so tests
 * can assert which synth path each SfxName dispatched to.
 */
interface RecordedOsc {
  type: string;
  startFreq: number;
}

function installFakeAudio(): { oscillators: RecordedOsc[] } {
  const oscillators: RecordedOsc[] = [];
  const makeParam = () => {
    const param: {
      value: number;
      setValueAtTime: (v: number) => void;
      linearRampToValueAtTime: (v: number) => void;
      exponentialRampToValueAtTime: (v: number) => void;
      setTargetAtTime: (v: number) => void;
    } = {
      value: 0,
      setValueAtTime(v) { this.value = v; },
      linearRampToValueAtTime() { /* envelope only */ },
      exponentialRampToValueAtTime() { /* envelope only */ },
      setTargetAtTime() { /* envelope only */ },
    };
    return param;
  };
  class FakeOscillator {
    type = 'sine';
    frequency = makeParam();
    connect() { /* graph only */ }
    start() { oscillators.push({ type: this.type, startFreq: this.frequency.value }); }
    stop() { /* scheduled by engine */ }
  }
  class FakeGain {
    gain = makeParam();
    connect() { /* graph only */ }
  }
  class FakeAudioContext {
    state = 'running';
    currentTime = 0;
    sampleRate = 44100;
    destination = {} as unknown as AudioNode;
    createGain() { return new FakeGain() as unknown as GainNode; }
    createOscillator() { return new FakeOscillator() as unknown as OscillatorNode; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  (globalThis as Record<string, unknown>).window = {
    AudioContext: FakeAudioContext,
    setTimeout,
    clearTimeout,
  };
  return { oscillators };
}

describe('SfxEngine browser-path dispatch (fake AudioContext)', () => {
  let sfx: SfxEngine;
  let oscillators: RecordedOsc[];

  beforeEach(() => {
    ({ oscillators } = installFakeAudio());
    sfx = new SfxEngine();
  });

  afterEach(() => {
    sfx.dispose();
    delete (globalThis as Record<string, unknown>).window;
  });

  it('redeemSuccess dispatches the ascending triangle chime', () => {
    sfx.play('redeemSuccess');
    assert.equal(oscillators.length, 3, 'three-tone chime');
    assert.ok(oscillators.every((o) => o.type === 'triangle'), 'triangle voices');
    assert.deepEqual(oscillators.map((o) => o.startFreq), [659, 988, 1319], 'E5 → B5 → E6');
  });

  it('redeemReject dispatches the low sawtooth buzz', () => {
    sfx.play('redeemReject');
    assert.equal(oscillators.length, 2, 'detuned pair');
    assert.ok(oscillators.every((o) => o.type === 'sawtooth'), 'sawtooth voices');
    assert.deepEqual(oscillators.map((o) => o.startFreq), [150, 75], 'low buzz fundamentals');
  });

  it('redeemSuccess and redeemReject take distinct synth paths', () => {
    sfx.play('redeemSuccess');
    const success = JSON.stringify(oscillators);
    oscillators.length = 0;
    sfx.play('redeemReject');
    const reject = JSON.stringify(oscillators);
    assert.notEqual(success, reject, 'the two outcomes must sound different');
  });

  it('click dispatches its short square blip', () => {
    sfx.play('click');
    assert.equal(oscillators.length, 1);
    assert.equal(oscillators[0].type, 'square');
    assert.equal(oscillators[0].startFreq, 660);
  });

  it('plays nothing when disabled', () => {
    sfx.setEnabled(false);
    sfx.play('click');
    sfx.play('redeemSuccess');
    sfx.play('redeemReject');
    assert.equal(oscillators.length, 0, 'no voices may start while disabled');
  });

  it('plays nothing when sfxVolume is 0', () => {
    sfx.setVolumes(0.7, 0);
    sfx.play('click');
    sfx.play('redeemSuccess');
    sfx.play('redeemReject');
    assert.equal(oscillators.length, 0, 'no voices may start at zero sfx volume');
  });

  it('plays when enabled with volume above zero', () => {
    sfx.setVolumes(0.7, 0.8);
    sfx.play('click');
    assert.equal(oscillators.length, 1, 'enabled + audible must actually sound');
  });
});
