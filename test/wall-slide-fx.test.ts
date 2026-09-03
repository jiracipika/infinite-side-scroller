import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { ParticleSystem } from '@/game/entities/particles';

describe('spawnWallSlideDust', () => {
  let ps: ParticleSystem;

  beforeEach(() => {
    ps = new ParticleSystem();
  });

  function live(): number {
    // Ambient spawner is idle until update() runs, so all particles present
    // are the ones the spawn call pushed.
    // @ts-expect-error accessing private field for verification
    return ps['particles'].length;
  }

  it('pushes a dust burst tagged wall_slide', () => {
    ps.spawnWallSlideDust(100, 200, true);
    assert.equal(live(), 6, 'full-rate burst spawns 6 particles');
    // @ts-expect-error accessing private field for verification
    for (const p of ps['particles']) {
      assert.equal(p.type, 'wall_slide');
      assert.ok(p.life > 0 && p.life <= 0.5, 'short-lived dust');
    }
  });

  it('dust kicks AWAY from the wall (facing right = wall on the right)', () => {
    ps.spawnWallSlideDust(100, 200, true);
    // @ts-expect-error accessing private field for verification
    for (const p of ps['particles']) {
      assert.ok(p.vx < 0, 'facing right → wall on right → dust kicks left');
      assert.ok(p.vy < 0, 'dust drifts up along the wall');
    }
  });

  it('mirrors the kick when facing left (wall on the left)', () => {
    ps.spawnWallSlideDust(100, 200, false);
    // @ts-expect-error accessing private field for verification
    for (const p of ps['particles']) {
      assert.ok(p.vx > 0, 'facing left → wall on left → dust kicks right');
    }
  });

  it('caps the burst under reducedParticles', () => {
    ps.setReducedParticles(true);
    ps.spawnWallSlideDust(100, 200, true);
    assert.equal(live(), 3, 'reduced mode halves the burst');
  });
});
