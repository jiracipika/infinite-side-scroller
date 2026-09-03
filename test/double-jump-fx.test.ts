import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Player, DEFAULT_PLAYER_CONFIG } from '@/game/entities/player';
import { getCharacterById } from '@/game/data/characters';
import type { InputManager } from '@/game/input/input';

// Minimal mock of InputManager (same pattern as player.test.ts).
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
const DT = 1 / 60;
const GROUND_Y = 400;

describe('Double-jump feedback state (airbornePose)', () => {
  let p: Player;
  let input: InputManager;

  beforeEach(() => {
    input = makeInput();
    // Ninja has innate double jump — the mid-air tests need it available.
    // (applyCharacter is the real API; config spread drops characterId.)
    p = new Player({ ...DEFAULT_PLAYER_CONFIG });
    p.applyCharacter(getCharacterById('ninja'));
  });

  function step(n = 1): void {
    for (let i = 0; i < n; i++) p.update(DT, input, GROUND_Y);
  }

  function doubleJumpMidAir(): void {
    // Put the player airborne and let the coyote window (0.1s) expire so the
    // buffered press is consumed as a DOUBLE jump, not a coyote ground jump.
    p.x = 100;
    p.y = GROUND_Y - 120;   // well above ground
    p.vy = 120;             // falling
    p.onGround = false;
    step(8);                // ~0.13s of falling → coyote exhausted
    input.press('Space');   // jump press → buffered → double jump mid-air
    step(1);
    input.clearPressed();
  }

  it('ground jump leaves airbornePose at 0 (no spin on the first jump)', () => {
    p.y = GROUND_Y - p.height;
    p.onGround = true;
    input.press('Space');
    step(1);
    input.clearPressed();
    assert.ok(p.vy < 0, 'player actually jumped');
    assert.equal(p.hasDoubleJumped, false);
    assert.equal(p.airbornePose, 0, 'single jump must not spin');
  });

  it('double jump sets airbornePose and it decays to 0 within ~0.6s', () => {
    doubleJumpMidAir();
    assert.ok(p.hasDoubleJumped, 'double jump consumed');
    assert.ok(p.airbornePose > 0, 'airborne pose engaged');
    step(Math.ceil(0.6 / DT));
    assert.equal(p.airbornePose, 0, 'pose decays back to 0');
  });

  it('airbornePose decays smoothly (no discontinuity > 0.5 per frame)', () => {
    doubleJumpMidAir();
    let last = p.airbornePose;
    let maxJump = 0;
    for (let i = 0; i < 60; i++) {
      step(1);
      maxJump = Math.max(maxJump, Math.abs(p.airbornePose - last));
      last = p.airbornePose;
    }
    assert.ok(maxJump <= 0.5, `pose jumped by ${maxJump} in one frame`);
  });

  it('landing resets airbornePose so spins never stack', () => {
    doubleJumpMidAir();
    assert.ok(p.airbornePose > 0);
    // Land: snap to ground, then step a frame with ground contact.
    p.y = GROUND_Y - p.height;
    p.vy = 0;
    p.onGround = true;
    step(2);
    assert.equal(p.airbornePose, 0, 'pose clears on landing');
  });
});
