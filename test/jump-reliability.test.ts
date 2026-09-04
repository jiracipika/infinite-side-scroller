/**
 * Jump reliability — regression tests for the input press-latch pipeline and
 * the player jump-buffer fixes. Every test here encodes a formerly broken
 * scenario where a jump press could be silently dropped or mis-spent:
 *
 *  1. Sub-frame tap: keydown+keyup completing between two frames.
 *  2. No-update frames: press on a rendered-but-not-simulated frame
 *     (120Hz displays, paused, hit-stop).
 *  3. Press consumed exactly once (no double-fire on catch-up frames).
 *  4. Jump pressed during a dash is buffered, not dropped (dash-jump combo).
 *  5. Press just above the ground resolves as a ground jump and preserves
 *     the double jump instead of wasting it mid-air.
 *  6. Press well above the ground still spends the double jump (air control).
 *  7. Buffered jump fires on the landing step.
 *  8. Buffer expires so stale presses never ghost-fire on landing.
 */
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InputManager } from '@/game/input/input';
import { Player, DEFAULT_PLAYER_CONFIG } from '@/game/entities/player';
import { getCharacterById } from '@/game/data/characters';

// ── window/document mocks (same pattern as input-focus.test.ts) ────────────
class TestDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
}

let testWindow: EventTarget;
let testDocument: TestDocument;
let originalWindow: PropertyDescriptor | undefined;
let originalDocument: PropertyDescriptor | undefined;

function dispatchKey(type: string, code: string): void {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, 'code', { value: code });
  testWindow.dispatchEvent(event);
}

beforeEach(() => {
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  testWindow = new EventTarget();
  testDocument = new TestDocument();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: testWindow });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: testDocument });
});

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else Reflect.deleteProperty(globalThis, 'document');
});

const DT = 1 / 60;

// ── InputManager press-latch pipeline ───────────────────────────────────────
describe('InputManager press latch (jump reliability)', () => {
  it('never loses a sub-frame tap (keydown+keyup between frames)', () => {
    const input = new InputManager();
    // Entire press + release happen before any frame runs.
    dispatchKey('keydown', 'Space');
    dispatchKey('keyup', 'Space');
    // The press must still be visible to the next simulation step.
    input.beginFrame();
    assert.equal(input.isPressed('Space'), true, 'sub-frame tap must survive until a simulation step consumes it');
    input.endUpdate();
    assert.equal(input.isPressed('Space'), false, 'latch must be consumed by the update');
    input.destroy();
  });

  it('press survives rendered frames with no simulation step (120Hz / pause)', () => {
    const input = new InputManager();
    dispatchKey('keydown', 'Space');
    // Rendered frame where the fixed-timestep loop produced zero updates.
    input.beginFrame();
    input.endFrame();
    assert.equal(input.isPressed('Space'), true, 'press must survive a no-update frame');
    // More no-update frames must not eat it either.
    for (let i = 0; i < 5; i++) {
      input.beginFrame();
      input.endFrame();
      assert.equal(input.isPressed('Space'), true, `press must survive no-update frame ${i + 2}`);
    }
    // First actual simulation step consumes it.
    input.beginFrame();
    input.endUpdate();
    assert.equal(input.isPressed('Space'), false);
    input.destroy();
  });

  it('press is consumed by exactly one update step (no catch-up double-fire)', () => {
    const input = new InputManager();
    dispatchKey('keydown', 'Space');
    input.beginFrame();
    assert.equal(input.isPressed('Space'), true, 'step 1 sees the press');
    input.endUpdate();
    // Simulate a catch-up frame: second update step in the SAME rAF frame.
    assert.equal(input.isPressed('Space'), false, 'step 2 must NOT re-fire the same press');
    input.endUpdate();
    assert.equal(input.isPressed('Space'), false);
    input.destroy();
  });

  it('keyup does not clear the latch but blur does', () => {
    const input = new InputManager();
    dispatchKey('keydown', 'Space');
    dispatchKey('keyup', 'Space');
    assert.equal(input.isPressed('Space'), true, 'release must not erase the press');
    // Losing focus clears everything (safety, mirrors releaseAll contract).
    testWindow.dispatchEvent(new Event('blur'));
    assert.equal(input.isPressed('Space'), false, 'blur must clear latched presses');
    input.destroy();
  });
});

// ── Player jump buffer ──────────────────────────────────────────────────────
// Minimal mock mirroring player.test.ts so player physics get deterministic
// per-frame input.
class MockInput {
  private down = new Set<string>();
  private pressed = new Set<string>();
  hold(code: string): void { this.down.add(code); }
  release(code: string): void { this.down.delete(code); }
  press(code: string): void { this.pressed.add(code); }
  clearPressed(): void { this.pressed.clear(); }
  isDown(code: string): boolean { return this.down.has(code); }
  isPressed(code: string): boolean { return this.pressed.has(code); }
}
const makeInput = (): InputManager => new MockInput() as unknown as InputManager;

/** Fall long enough (with no input) to be safely outside the coyote window. */
function ageOutOfCoyote(p: Player, input: InputManager, groundY: number, steps = 10): void {
  for (let i = 0; i < steps; i++) {
    input.clearPressed();
    p.update(DT, input, groundY);
  }
}

describe('Player jump buffer reliability', () => {
  it('a jump pressed mid-dash is honored when the dash ends (dash-jump combo)', () => {
    const p = new Player();
    const groundY = DEFAULT_PLAYER_CONFIG.startY + DEFAULT_PLAYER_CONFIG.height;
    const input = makeInput();

    // Settle on ground.
    for (let i = 0; i < 5; i++) {
      input.clearPressed();
      p.update(DT, input, groundY);
    }
    assert.equal(p.onGround, true);

    // Start a dash.
    input.press('KeyX');
    p.update(DT, input, groundY);
    input.clearPressed();
    assert.equal(p.dashing, true);

    // Jump pressed on a mid-dash frame, then released (one-frame tap).
    input.press('Space');
    p.update(DT, input, groundY); // early-returns into the dash branch
    input.clearPressed();

    // Ride out the dash.
    let sawDashEnd = false;
    for (let i = 0; i < 20 && p.dashing; i++) {
      input.clearPressed();
      p.update(DT, input, groundY);
      sawDashEnd = !p.dashing;
    }
    assert.equal(sawDashEnd, true, 'dash should end within the simulated window');

    // The buffered jump must fire on the step the dash ends.
    input.clearPressed();
    p.update(DT, input, groundY);
    assert.ok(
      p.vy < 0,
      `buffered mid-dash jump must fire after dash ends (vy=${p.vy})`,
    );
  });

  it('press a hair above the ground: ground jump, double jump preserved', () => {
    const p = new Player();
    p.applyCharacter(getCharacterById('ninja')); // innate double jump
    const groundY = 400;
    const input = makeInput();

    // Drop the player from the sky toward the ground.
    p.x = 200;
    p.y = groundY - p.height - 6; // ~6px above ground, falling
    p.vy = 300; // covers 5px this step: lands this step
    p.onGround = false;

    input.press('Space');
    p.update(DT, input, groundY);

    assert.ok(p.vy < 0, `jump must fire (vy=${p.vy})`);
    assert.equal(
      p.canDoubleJump, true,
      'landing-adjacent press must resolve as a ground jump and keep the double jump',
    );
  });

  it('press well above the ground: double jump spent (air control works)', () => {
    const p = new Player();
    p.applyCharacter(getCharacterById('ninja'));
    const groundY = 400;
    const input = makeInput();

    p.x = 200;
    p.onGround = false;
    // Age out of the coyote window (0.1s) by falling with no floor.
    ageOutOfCoyote(p, input, Infinity);
    // Now reposition well above the ground, falling, nowhere near landing
    // (covers ~5px this step; ground is 60px away).
    p.y = groundY - p.height - 60;
    p.vy = 300;

    input.press('Space');
    p.update(DT, input, groundY);

    assert.ok(p.vy < 0, `double jump must fire mid-air (vy=${p.vy})`);
    assert.equal(p.canDoubleJump, false, 'double jump should be spent mid-air');
  });

  it('buffered jump fires on the landing step', () => {
    const p = new Player();
    p.applyCharacter(getCharacterById('knight')); // no double jump
    const groundY = 400;
    const input = makeInput();

    p.x = 200;
    p.onGround = false;
    // Age out of the coyote window with no floor, then reposition 40px above
    // the ground falling at 400px/s: lands in ~6 steps, inside the 0.12s
    // (7-step) buffer window.
    ageOutOfCoyote(p, input, Infinity);
    p.y = groundY - p.height - 40;
    p.vy = 400;

    // Press BEFORE landing.
    input.press('Space');
    p.update(DT, input, groundY);
    input.clearPressed();
    assert.equal(p.onGround, false, 'should still be airborne before touchdown');
    // The buffered jump must fire on the step the player touches down: the
    // first step with upward (negative) velocity after the press.
    let jumpFired = false;
    for (let i = 0; i < 8; i++) {
      p.update(DT, input, groundY);
      if (p.vy < 0) { jumpFired = true; break; }
    }
    assert.equal(jumpFired, true, 'buffered jump should fire on the landing step');
  });

  it('jump buffer expires after 0.12s so old presses do not ghost-fire', () => {
    const p = new Player();
    p.applyCharacter(getCharacterById('knight'));
    const groundY = 400;
    const input = makeInput();

    p.x = 200;
    p.y = groundY - p.height - 200;
    p.vy = 0; // hang in the air (gravity pulls, but press expires first)
    p.onGround = false;

    input.press('Space');
    p.update(DT, input, Infinity); // knight has no double jump — buffer holds
    input.clearPressed();

    // Simulate 20+ frames (~0.33s) of falling: buffer must expire.
    for (let i = 0; i < 25; i++) p.update(DT, input, Infinity);

    // Land: no jump should fire.
    p.update(DT, input, groundY);
    const vyAfterLand = p.vy;
    assert.ok(
      vyAfterLand >= 0,
      `expired buffer must not ghost-fire a jump on landing (vy=${vyAfterLand})`,
    );
  });
});
