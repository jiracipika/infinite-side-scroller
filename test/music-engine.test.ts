import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * MusicEngine is SSR-safe: all AudioContext access is guarded behind
 * `typeof window !== 'undefined'`. In the Node test environment there is no
 * window, so every method must gracefully degrade without throwing.
 *
 * These tests verify the logic paths that DO execute in a non-browser
 * environment: volume clamping, enabled toggling, intensity clamping,
 * play-state gating, and the singleton factory. Actual synthesis is
 * exercised in the browser (see docs/SCRIPTS.md).
 */

import { MusicEngine, getMusicEngine, musicEngineExists } from '@/game/audio/index';

describe('MusicEngine', () => {
  let music: MusicEngine;

  beforeEach(() => {
    music = new MusicEngine();
  });

  it('clamps volumes to [0, 1]', () => {
    music.setVolume(1.5, -0.5);
    assert.ok(music.masterVolume <= 1, 'master should be clamped to 1');
    assert.ok(music.musicVolume >= 0, 'music should be clamped to 0');
    assert.equal(music.masterVolume, 1);
    assert.equal(music.musicVolume, 0);
  });

  it('clamps volume boundary values', () => {
    music.setVolume(0, 1);
    assert.equal(music.masterVolume, 0);
    assert.equal(music.musicVolume, 1);

    music.setVolume(0.5, 0.5);
    assert.equal(music.masterVolume, 0.5);
    assert.equal(music.musicVolume, 0.5);
  });

  it('starts disabled-by-state: not playing and intensity 0', () => {
    assert.equal(music.isPlaying, false);
    assert.equal(music.intensity, 0);
  });

  it('setIntensity clamps to [0, 1]', () => {
    music.setIntensity(1.7);
    assert.equal(music.intensity, 1);
    music.setIntensity(-3);
    assert.equal(music.intensity, 0);
    music.setIntensity(0.42);
    assert.equal(music.intensity, 0.42);
  });

  it('start()/stop() never throw in non-browser environment', () => {
    assert.doesNotThrow(() => {
      music.start();
      music.setIntensity(0.5);
      music.stop();
    });
  });

  it('isPlaying stays false in non-browser environment after start()', () => {
    music.start();
    assert.equal(music.isPlaying, false, 'no AudioContext in Node, so playback cannot begin');
    music.stop();
    assert.equal(music.isPlaying, false);
  });

  it('starts enabled', () => {
    assert.equal(music.enabled, true);
  });

  it('toggles enabled state', () => {
    music.setEnabled(false);
    assert.equal(music.enabled, false);
    music.setEnabled(true);
    assert.equal(music.enabled, true);
  });

  it('duck() never throws in non-browser environment', () => {
    assert.doesNotThrow(() => music.duck());
  });

  it('resume() returns false in non-browser environment', () => {
    assert.equal(music.resume(), false);
  });

  it('dispose() is safe to call multiple times', () => {
    assert.doesNotThrow(() => {
      music.dispose();
      music.dispose();
    });
  });

  it('singleton factory returns the same instance', () => {
    assert.equal(getMusicEngine(), getMusicEngine());
  });

  it('sfx-style existence probe is exported', () => {
    assert.equal(typeof musicEngineExists, 'function');
    assert.equal(musicEngineExists(), true);
  });
});
