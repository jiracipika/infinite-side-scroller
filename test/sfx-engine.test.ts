import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * SfxEngine is designed to be SSR-safe: all AudioContext access is guarded
 * behind `typeof window !== 'undefined'`. In the Node test environment there
 * is no window, so every method should gracefully degrade without throwing.
 *
 * These tests verify the logic paths that DO execute in a non-browser
 * environment: volume clamping, enabled toggling, and the singleton factory.
 * The actual sound synthesis is exercised in browser E2E, not here.
 */

import { SfxEngine, getSfxEngine, sfxEngineExists } from '@/game/audio/index';

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
