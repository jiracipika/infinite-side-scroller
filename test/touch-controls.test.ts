import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SETTINGS,
  normalizeSettings,
} from '@/game/state/game-state';
import {
  resolveTouchButtonDimension,
  resolveTouchControlPlacement,
} from '@/game/input/touch-controls';

describe('touch control preferences', () => {
  it('uses a default visibility value aligned with the five-percent settings step', () => {
    assert.equal(DEFAULT_SETTINGS.touchControlOpacity, 0.8);
    assert.equal((Math.round(DEFAULT_SETTINGS.touchControlOpacity * 100) - 55) % 5, 0);
  });

  it('defaults older or malformed settings to a usable control layout', () => {
    assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);

    const normalized = normalizeSettings({
      masterVolume: 4,
      sfxVolume: -2,
      musicVolume: Number.NaN,
      hapticsEnabled: 'yes',
      cameraMode: 'diagonal',
      reducedMotion: 'sometimes',
      touchControlLayout: 'upside-down',
      touchControlSize: 'huge',
      touchControlOpacity: 0.1,
    });

    assert.equal(normalized.masterVolume, 1);
    assert.equal(normalized.sfxVolume, 0);
    assert.equal(normalized.musicVolume, DEFAULT_SETTINGS.musicVolume);
    assert.equal(normalized.hapticsEnabled, DEFAULT_SETTINGS.hapticsEnabled);
    assert.equal(normalized.cameraMode, 'auto');
    assert.equal(normalized.reducedMotion, 'auto');
    assert.equal(normalized.touchControlLayout, 'standard');
    assert.equal(normalized.touchControlSize, 'standard');
    assert.equal(normalized.touchControlOpacity, 0.55);
  });

  it('preserves valid mirrored, large, and visibility preferences', () => {
    const normalized = normalizeSettings({
      ...DEFAULT_SETTINGS,
      touchControlLayout: 'mirrored',
      touchControlSize: 'large',
      touchControlOpacity: 0.7,
    });

    assert.equal(normalized.touchControlLayout, 'mirrored');
    assert.equal(normalized.touchControlSize, 'large');
    assert.equal(normalized.touchControlOpacity, 0.7);
  });

  it('places movement and actions on opposite sides', () => {
    assert.deepEqual(resolveTouchControlPlacement('standard'), {
      movement: 'left',
      actions: 'right',
    });
    assert.deepEqual(resolveTouchControlPlacement('mirrored'), {
      movement: 'right',
      actions: 'left',
    });
  });

  it('scales targets predictably and caps split-screen movement buttons', () => {
    assert.equal(resolveTouchButtonDimension('lg', 'compact', false), 57);
    assert.equal(resolveTouchButtonDimension('lg', 'standard', false), 66);
    assert.equal(resolveTouchButtonDimension('lg', 'large', false), 77);
    assert.equal(resolveTouchButtonDimension('md', 'large', true), 62);
    assert.equal(resolveTouchButtonDimension('xs', 'large', true), 49);
  });
});
