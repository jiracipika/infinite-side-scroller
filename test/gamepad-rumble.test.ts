import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveRumbleEffect,
  fireGamepadRumble,
  fireHaptic,
  HAPTIC_PATTERNS,
  type HapticEvent,
  type GamepadRumbleEffect,
} from '@/game/input/haptics';

const ALL_EVENTS = Object.keys(HAPTIC_PATTERNS) as HapticEvent[];

function isEffect(value: GamepadRumbleEffect | 0): value is GamepadRumbleEffect {
  return value !== 0;
}

describe('resolveRumbleEffect (gamepad dual-rumble bridge)', () => {
  it('resolves every haptic event — the vocabularies stay in lockstep', () => {
    for (const event of ALL_EVENTS) {
      assert.ok(isEffect(resolveRumbleEffect(event)), `${event} must rumble`);
    }
  });

  it('derives duration from the phone pattern so one retune retunes both', () => {
    const total = (pattern: number | number[]) =>
      typeof pattern === 'number' ? pattern : pattern.reduce((a, b) => a + b, 0);
    for (const event of ALL_EVENTS) {
      const effect = resolveRumbleEffect(event);
      assert.ok(isEffect(effect));
      assert.equal(effect.durationMs, total(HAPTIC_PATTERNS[event]), event);
    }
  });

  it('keeps magnitudes in the API-mandated [0, 1] range with real character', () => {
    for (const event of ALL_EVENTS) {
      const effect = resolveRumbleEffect(event);
      assert.ok(isEffect(effect));
      assert.ok(effect.strongMagnitude >= 0 && effect.strongMagnitude <= 1, event);
      assert.ok(effect.weakMagnitude >= 0 && effect.weakMagnitude <= 1, event);
    }
    // Damage should thump the heavy motor far harder than a coin tick.
    const damage = resolveRumbleEffect('damage');
    const coin = resolveRumbleEffect('coin');
    assert.ok(isEffect(damage) && isEffect(coin));
    assert.ok(damage.strongMagnitude > coin.strongMagnitude + 0.5);
    // Death rumbles longest — the one dramatic exception, matching the phone.
    let longest = '';
    let longestMs = 0;
    for (const event of ALL_EVENTS) {
      const effect = resolveRumbleEffect(event);
      assert.ok(isEffect(effect));
      if (effect.durationMs > longestMs) { longestMs = effect.durationMs; longest = event; }
    }
    assert.equal(longest, 'death');
  });

  it('respects the enabled gate and unknown events', () => {
    assert.equal(resolveRumbleEffect('coin', false), 0);
    assert.equal(resolveRumbleEffect('not-a-real-event' as HapticEvent), 0);
    assert.equal(resolveRumbleEffect('death', true) !== 0, true);
  });

  it('fire paths are safe no-ops outside a browser (no navigator)', () => {
    assert.doesNotThrow(() => fireGamepadRumble('damage'));
    assert.doesNotThrow(() => fireGamepadRumble('death', false));
    assert.doesNotThrow(() => fireHaptic('power-up'));
  });
});
