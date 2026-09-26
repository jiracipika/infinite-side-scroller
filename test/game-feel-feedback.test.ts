import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Player, DEFAULT_PLAYER_CONFIG } from '@/game/entities/player';
import {
  ParticleSystem,
  landingIntensityFor,
  type Particle,
} from '@/game/entities/particles';
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

describe('Jump-kind feedback (lastJumpKind)', () => {
  let p: Player;
  let input: InputManager;

  beforeEach(() => {
    input = makeInput();
    // Ninja has innate double jump — the mid-air tests need it available.
    p = new Player({ ...DEFAULT_PLAYER_CONFIG });
    p.applyCharacter(getCharacterById('ninja'));
  });

  function step(n = 1): void {
    for (let i = 0; i < n; i++) p.update(DT, input, GROUND_Y);
  }

  it('ground jump reports kind "ground"', () => {
    p.y = GROUND_Y - p.height;
    p.onGround = true;
    input.press('Space');
    step(1);
    input.clearPressed();
    assert.ok(p.vy < 0, 'player actually jumped');
    assert.equal(p.consumeJumpKind(), 'ground');
  });

  it('mid-air jump after coyote expiry reports kind "double"', () => {
    // Airborne, falling, past the 0.1s coyote window → press resolves as
    // the double jump.
    p.x = 100;
    p.y = GROUND_Y - 120;
    p.vy = 120;
    p.onGround = false;
    step(8); // ~0.13s of falling → coyote exhausted
    input.press('Space');
    step(1);
    input.clearPressed();
    assert.equal(p.hasDoubleJumped, true, 'double jump was spent');
    assert.equal(p.consumeJumpKind(), 'double');
  });

  it('consumeJumpKind clears after reading', () => {
    p.y = GROUND_Y - p.height;
    p.onGround = true;
    input.press('Space');
    step(1);
    input.clearPressed();
    assert.equal(p.consumeJumpKind(), 'ground');
    assert.equal(p.consumeJumpKind(), null, 'second read is null');
  });

  it('idle steps report no jump kind', () => {
    p.y = GROUND_Y - p.height;
    p.onGround = true;
    step(3);
    assert.equal(p.consumeJumpKind(), null);
  });
});

describe('Landing impact tracking (lastLandingVy)', () => {
  let p: Player;
  let input: InputManager;

  beforeEach(() => {
    input = makeInput();
    p = new Player({ ...DEFAULT_PLAYER_CONFIG });
  });

  function step(n = 1): void {
    for (let i = 0; i < n; i++) p.update(DT, input, GROUND_Y);
  }

  it('a fresh landing records the pre-collision fall speed', () => {
    p.x = 100;
    p.y = GROUND_Y - 200; // high drop
    p.vy = 0;
    p.onGround = false;
    for (let i = 0; i < 60 && !p.onGround; i++) step(1);
    assert.ok(p.onGround, 'player landed');
    assert.ok(p.lastLandingVy > 100, 'impact vy recorded, got ' + p.lastLandingVy);
  });

  it('standing frames do not report an impact', () => {
    p.y = GROUND_Y - p.height;
    p.onGround = true;
    step(3);
    assert.equal(p.lastLandingVy, 0);
  });
});

describe('Landing intensity mapping', () => {
  it('maps fall speed to a clamped intensity', () => {
    assert.ok(landingIntensityFor(0) >= 0.6, 'floor of 0.6 for gentle touches');
    assert.equal(landingIntensityFor(-50), landingIntensityFor(0),
      'negative/upward vy is not a fall — clamp to floor');
    const normal = landingIntensityFor(520); // standard jump arc fall
    assert.ok(normal > 1.2 && normal < 1.4, 'normal arc near 1.3, got ' + normal);
    assert.ok(landingIntensityFor(200) < normal, 'soft landing < normal');
    assert.ok(landingIntensityFor(900) > normal, 'terminal fall > normal');
    assert.equal(landingIntensityFor(5000), 1.9, 'cap at 1.9');
  });
});

describe('New gameplay particle spawns', () => {
  let ps: ParticleSystem;

  beforeEach(() => {
    ps = new ParticleSystem();
  });

  function gameplayByType(type: Particle['type']): Particle[] {
    // Ambient spawner only adds dust/leaf/snow/spark, so any other type in
    // the list came from the spawn call under test. update() is not run, so
    // nothing is culled between spawn and read.
    return (ps as unknown as { particles: Particle[] }).particles.filter(
      (p) => p.type === type,
    );
  }

  it('spawnLanding scales particle count with intensity', () => {
    ps.spawnLanding(0, 0, 0.6);
    const soft = gameplayByType('landing').length;
    ps.spawnLanding(0, 0, 1.9);
    const heavy = gameplayByType('landing').length;
    assert.ok(heavy > soft, `heavy landing (${heavy}) > soft landing (${soft})`);
    ps.setReducedParticles(true);
    ps.spawnLanding(0, 0, 1.9);
    const reduced = gameplayByType('landing').length - heavy;
    assert.ok(reduced < heavy, 'reduced mode spawns fewer particles');
  });

  it('spawnLanding clamps out-of-range intensity', () => {
    const a = new ParticleSystem();
    a.spawnLanding(0, 0, 99);
    const b = new ParticleSystem();
    b.spawnLanding(0, 0, 1.9); // both clamp to 1.9
    const countA = (a as unknown as { particles: Particle[] }).particles.filter(
      (p) => p.type === 'landing',
    ).length;
    const countB = (b as unknown as { particles: Particle[] }).particles.filter(
      (p) => p.type === 'landing',
    ).length;
    assert.equal(countA, countB, '99 clamps to the same count as 1.9');
  });

  it('spawnAirJump emits a lead ring plus flat chips', () => {
    ps.spawnAirJump(10, 20);
    const ring = gameplayByType('air_jump');
    assert.ok(ring.length >= 6, 'ring has particles');
    assert.ok(ring.every((p) => p.color === '#7dd3fc'), 'distinct air-jump color');
    // Exactly one lead stroke ring (size > 10 = renderer radius marker).
    const leads = ring.filter((p) => p.size > 10);
    assert.equal(leads.length, 1, 'one lead ring particle');
    assert.equal(leads[0].vx, 0, 'lead ring does not drift');
    // Chips spread horizontally overall.
    const chips = ring.filter((p) => p.size <= 10);
    const maxVx = Math.max(...chips.map((p) => Math.abs(p.vx)));
    const maxVy = Math.max(...chips.map((p) => Math.abs(p.vy)));
    assert.ok(maxVx > maxVy, `ring spreads horizontally (maxVx ${maxVx} > maxVy ${maxVy})`);
  });

  it('spawnWallJumpPuff kicks away from the wall', () => {
    ps.spawnWallJumpPuff(10, 20, true); // wall on the right → puff left
    const puff = gameplayByType('jump_dust');
    assert.ok(puff.length >= 4);
    assert.ok(puff.every((p) => p.vx < 0), 'puff moves away from a right wall');
  });

  it('spawnStompRing emits a lead ellipse plus outward chips', () => {
    ps.spawnStompRing(0, 0);
    const ring = gameplayByType('stomp_ring');
    assert.ok(ring.length >= 7, 'ring has particles');
    const leads = ring.filter((p) => p.size > 10);
    assert.equal(leads.length, 1, 'one lead ring particle');
    assert.ok(ring.filter((p) => p.size <= 10).every((p) => p.vy <= 0),
      'chips stay flat (no downward spray)');
  });

  it('new spawns respect reducedParticles', () => {
    ps.setReducedParticles(true);
    ps.spawnAirJump(0, 0);
    ps.spawnStompRing(0, 0);
    ps.spawnWallJumpPuff(0, 0, false);
    const total =
      gameplayByType('air_jump').length +
      gameplayByType('stomp_ring').length +
      gameplayByType('jump_dust').length;
    assert.ok(total > 0, 'reduced mode still emits feedback');
    assert.ok(total <= 20, 'reduced mode keeps counts low');
  });
});
