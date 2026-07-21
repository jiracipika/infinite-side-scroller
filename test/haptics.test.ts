import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveHapticPattern,
  fireHaptic,
  HAPTIC_PATTERNS,
  COMBO_MILESTONE_STEP,
  type HapticEvent,
} from '@/game/input/haptics';
import { DEFAULT_SETTINGS } from '@/game/state/game-state';

/**
 * Gameplay haptics resolver.
 *
 * resolveHapticPattern is a pure function (no DOM) that maps a HapticEvent to a
 * navigator.vibrate pattern. These tests cover:
 *   - every event resolves to its declared pattern (exhaustive over the union)
 *   - unknown/undefined inputs do not throw and fall back to 0
 *   - the master `enabled` switch forces 0 regardless of event
 *   - fireHaptic is a safe no-op outside the browser (no navigator object)
 *   - combo milestone constant is a sane power-of-ten step
 *
 * We do NOT test useGameHaptics here: it is a React hook that calls
 * navigator.vibrate and belongs in component-level tests, not the pure
 * resolver suite.
 */
describe('resolveHapticPattern', () => {
  it('is enabled by default and respects the settings gate', () => {
    assert.equal(DEFAULT_SETTINGS.hapticsEnabled, true);
    assert.deepEqual(resolveHapticPattern('damage', true), HAPTIC_PATTERNS.damage);
    assert.equal(resolveHapticPattern('damage', false), 0);
  });

  it('returns the declared pattern for every known HapticEvent (exhaustive)', () => {
    const allEvents = Object.keys(HAPTIC_PATTERNS) as HapticEvent[];
    // Sanity: the constants table covers the events we care about.
    assert.ok(allEvents.length >= 8, 'expected at least 8 haptic events');
    for (const event of allEvents) {
      const pattern = resolveHapticPattern(event, true);
      // Each pattern is either a positive number or a non-empty array of
      // non-negative numbers (vibration API spec).
      assert.ok(
        typeof pattern === 'number' || Array.isArray(pattern),
        `${event} should resolve to number | number[]`,
      );
      if (typeof pattern === 'number') {
        assert.ok(pattern > 0, `${event} pattern should be positive`);
      } else {
        assert.ok(pattern.length > 0, `${event} pattern array should be non-empty`);
        for (const segment of pattern) {
          assert.ok(
            typeof segment === 'number' && segment >= 0,
            `${event} pattern segments should be non-negative numbers`,
          );
        }
      }
    }
  });

  it('damage resolves to a multi-segment sting pattern', () => {
    const p = resolveHapticPattern('damage', true);
    assert.ok(Array.isArray(p) && p.length >= 2, 'damage should be a multi-tap pattern');
  });

  it('coin resolves to a short single tick (subtle, fires often)', () => {
    const p = resolveHapticPattern('coin', true);
    assert.equal(typeof p, 'number');
    assert.ok((p as number) <= 10, 'coin haptic should be very short');
  });

  it('death resolves to the longest pattern (dramatic fade)', () => {
    const deathPattern = resolveHapticPattern('death', true);
    const coinPattern = resolveHapticPattern('coin', true);
    const deathTotal = Array.isArray(deathPattern)
      ? deathPattern.reduce((a, b) => a + b, 0)
      : deathPattern;
    const coinTotal = Array.isArray(coinPattern)
      ? coinPattern.reduce((a, b) => a + b, 0)
      : coinPattern;
    assert.ok(
      deathTotal > coinTotal * 5,
      'death should be dramatically longer than the coin tick',
    );
  });

  it('returns 0 when disabled, regardless of event', () => {
    const events = Object.keys(HAPTIC_PATTERNS) as HapticEvent[];
    for (const event of events) {
      assert.equal(resolveHapticPattern(event, false), 0);
    }
  });

  it('combo milestone step is a positive integer >= 5', () => {
    assert.ok(
      Number.isInteger(COMBO_MILESTONE_STEP) && COMBO_MILESTONE_STEP >= 5,
      'milestone step must be a sensible integer',
    );
  });
});

describe('fireHaptic (no-op outside browser)', () => {
  it('does not throw when navigator/vibrate are unavailable', () => {
    // In the Node test runner there is no navigator.vibrate, so this is the
    // real production path for SSR / unsupported browsers. It must swallow
    // silently rather than throw.
    assert.doesNotThrow(() => fireHaptic('damage'));
    assert.doesNotThrow(() => fireHaptic('death'));
    assert.doesNotThrow(() => fireHaptic('coin'));
    assert.doesNotThrow(() => fireHaptic('combo-milestone'));
  });

  it('does not throw when explicitly disabled', () => {
    assert.doesNotThrow(() => fireHaptic('damage', false));
    assert.doesNotThrow(() => fireHaptic('death', false));
  });
});
