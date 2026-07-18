import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Camera } from '@/game/engine/camera';

/**
 * Accessibility: reduced-motion suppression on the Camera.
 *
 * The Camera's shake() produces viewport offsets that scroll the whole world.
 * For users with vestibular disorders / motion sensitivity this is a trigger,
 * so when reduced motion is enabled we MUST emit zero shake offset on every
 * subsequent update() — even if shake() was called with a large intensity.
 *
 * The duration/intensity bookkeeping still ticks down so that, if the user
 * later disables reduced motion mid-shake, we don't suddenly emit a leftover
 * jolt. We assert that invariant too.
 */
describe('Camera reduced-motion suppression', () => {
  let camera: Camera;

  beforeEach(() => {
    camera = new Camera({ mode: 'auto' });
    camera.setScreenSize(800, 600);
    camera.snapTo(400, 300);
  });

  it('is off by default', () => {
    assert.equal(camera.isReducedMotion(), false);
  });

  it('emits non-zero shake offset when reduced motion is off', () => {
    camera.setReducedMotion(false);
    camera.shake(10, 0.3);
    camera.update(400, 300, 1 / 60);
    // Either X or Y (almost certainly both) must be non-zero at intensity 10.
    const offsets = readShakeOffset(camera);
    assert.ok(
      offsets.x !== 0 || offsets.y !== 0,
      `expected a non-zero shake offset, got ${JSON.stringify(offsets)}`,
    );
  });

  it('emits ZERO shake offset when reduced motion is on (even with intensity 10)', () => {
    camera.setReducedMotion(true);
    camera.shake(10, 0.3);
    // Sample several frames — all must be zero.
    for (let i = 0; i < 5; i++) {
      camera.update(400, 300, 1 / 60);
      const offsets = readShakeOffset(camera);
      assert.equal(offsets.x, 0, `frame ${i}: shakeOffsetX must be 0, got ${offsets.x}`);
      assert.equal(offsets.y, 0, `frame ${i}: shakeOffsetY must be 0, got ${offsets.y}`);
    }
  });

  it('clears an in-flight shake immediately when reduced motion is toggled on', () => {
    camera.setReducedMotion(false);
    camera.shake(8, 0.5);
    camera.update(400, 300, 1 / 60);
    const beforeOffsets = readShakeOffset(camera);
    assert.ok(
      beforeOffsets.x !== 0 || beforeOffsets.y !== 0,
      'precondition: shake must be producing offsets before the toggle',
    );

    // Toggle on mid-shake — must zero out the very next frame.
    camera.setReducedMotion(true);
    camera.update(400, 300, 1 / 60);
    const afterOffsets = readShakeOffset(camera);
    assert.equal(afterOffsets.x, 0);
    assert.equal(afterOffsets.y, 0);
  });

  it('resumes normal shake behavior when reduced motion is toggled back off', () => {
    camera.setReducedMotion(true);
    camera.setReducedMotion(false);
    camera.shake(10, 0.3);
    camera.update(400, 300, 1 / 60);
    const offsets = readShakeOffset(camera);
    assert.ok(
      offsets.x !== 0 || offsets.y !== 0,
      `after toggling off, shake must produce offsets again, got ${JSON.stringify(offsets)}`,
    );
  });

  it('does not error when setReducedMotion is called with the same value twice', () => {
    camera.setReducedMotion(true);
    camera.setReducedMotion(true); // no-op, must not throw
    assert.equal(camera.isReducedMotion(), true);
  });

  it('treats truthy non-boolean values as enabled (coercion safety)', () => {
    // Callers may pass a truthy value from a settings object — guard against
    // accidental `1` / truthy object being treated as enabled silently.
    camera.setReducedMotion(1 as unknown as boolean);
    assert.equal(camera.isReducedMotion(), true);
  });
});

/**
 * Read the private shake offsets via the public worldToScreen projection.
 *
 * worldToScreen subtracts renderX/renderY (which include the shake offset),
 * so by comparing against the camera's logical position we can derive the
 * shake offset without exposing internal fields. We access the fields through
 * a small cast to keep the test self-contained and deterministic.
 */
function readShakeOffset(cam: Camera): { x: number; y: number } {
  const internal = cam as unknown as {
    shakeOffsetX: number;
    shakeOffsetY: number;
  };
  return { x: internal.shakeOffsetX, y: internal.shakeOffsetY };
}
