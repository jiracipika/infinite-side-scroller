import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Player } from '@/game/entities/player';

/**
 * Power-up timer snapshot tests — verifies getActivePowerUpTimers()
 * reports the correct remaining duration for each timed effect and
 * that expired/unused effects are omitted.
 *
 * The Player's tick logic (shieldTimer -= dt etc.) is private, so we
 * simulate elapsed time by calling update() with a mock input on a
 * flat ground plane — same approach as player.test.ts.
 */
import type { InputManager } from '@/game/input/input';

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

function makeInput(): InputManager {
  return new MockInput() as unknown as InputManager;
}

const DT = 1 / 60;
const GROUND_Y = 500;

function tickPlayer(p: Player, frames: number): void {
  const input = makeInput();
  for (let i = 0; i < frames; i++) {
    p.update(DT, input, GROUND_Y);
  }
}

describe('Player.getActivePowerUpTimers', () => {
  let p: Player;

  beforeEach(() => {
    p = new Player();
  });

  it('returns an empty array when no power-ups are active', () => {
    assert.deepEqual(p.getActivePowerUpTimers(), []);
  });

  it('reports shield timer after applyShield', () => {
    p.applyShield(8);
    const timers = p.getActivePowerUpTimers();
    assert.equal(timers.length, 1);
    assert.equal(timers[0].type, 'shield');
    assert.ok(timers[0].remaining > 7 && timers[0].remaining <= 8);
  });

  it('reports speed boost timer after applySpeedBoost', () => {
    p.applySpeedBoost(1.5, 5);
    const timers = p.getActivePowerUpTimers();
    assert.equal(timers.length, 1);
    assert.equal(timers[0].type, 'speedBoost');
    assert.ok(timers[0].remaining > 4 && timers[0].remaining <= 5);
  });

  it('reports magnet timer after applyMagnet', () => {
    p.applyMagnet(8);
    const timers = p.getActivePowerUpTimers();
    assert.equal(timers.length, 1);
    assert.equal(timers[0].type, 'magnet');
  });

  it('reports weapon timer after equipWeapon (slingshot)', () => {
    p.equipWeapon('slingshot', 10);
    const timers = p.getActivePowerUpTimers();
    assert.equal(timers.length, 1);
    assert.equal(timers[0].type, 'slingshot');
  });

  it('reports weapon timer after equipWeapon (bow)', () => {
    p.equipWeapon('bow', 10);
    const timers = p.getActivePowerUpTimers();
    assert.equal(timers.length, 1);
    assert.equal(timers[0].type, 'bow');
  });

  it('reports healing aura timer after applyHealingAura', () => {
    p.applyHealingAura(10);
    const timers = p.getActivePowerUpTimers();
    assert.equal(timers.length, 1);
    assert.equal(timers[0].type, 'healingAura');
  });

  it('reports multiple active power-ups simultaneously', () => {
    p.applyShield(8);
    p.applySpeedBoost(1.5, 5);
    p.applyMagnet(8);
    const timers = p.getActivePowerUpTimers();
    assert.equal(timers.length, 3);
    const types = timers.map(t => t.type).sort();
    assert.deepEqual(types, ['magnet', 'shield', 'speedBoost']);
  });

  it('counts down remaining time as frames elapse', () => {
    p.applyShield(4);
    const initial = p.getActivePowerUpTimers()[0].remaining;
    // Simulate ~1 second of gameplay (60 frames)
    tickPlayer(p, 60);
    const after = p.getActivePowerUpTimers();
    assert.equal(after.length, 1);
    assert.ok(
      after[0].remaining < initial,
      `remaining (${after[0].remaining}) should be less than initial (${initial})`,
    );
  });

  it('omits shield from results after it expires', () => {
    p.applyShield(0.5); // very short
    // Simulate ~1 second — enough to expire
    tickPlayer(p, 60);
    // Shield may still be technically active if timer just hit 0;
    // after enough frames it should be gone
    tickPlayer(p, 30);
    const timers = p.getActivePowerUpTimers();
    const hasShield = timers.some(t => t.type === 'shield');
    assert.equal(hasShield, false, 'shield should be expired after ~1.5s');
  });

  it('omits speed boost after it expires', () => {
    p.applySpeedBoost(1.5, 0.5);
    tickPlayer(p, 90); // ~1.5s
    const timers = p.getActivePowerUpTimers();
    const hasSpeed = timers.some(t => t.type === 'speedBoost');
    assert.equal(hasSpeed, false, 'speed boost should be expired');
  });
});
