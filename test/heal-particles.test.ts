import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { ParticleSystem } from '@/game/entities/particles';

describe('ParticleSystem.spawnHeal', () => {
  let ps: ParticleSystem;

  beforeEach(() => {
    ps = new ParticleSystem();
  });

  it('spawns at least 4 heal particles', () => {
    ps.spawnHeal(100, 200);
    const heals = ps.getParticles().filter((p) => p.type === 'heal');
    assert.ok(heals.length >= 4, `expected >= 4 heal particles, got ${heals.length}`);
  });

  it('all heal particles use green tones', () => {
    ps.spawnHeal(0, 0);
    const heals = ps.getParticles().filter((p) => p.type === 'heal');
    for (const p of heals) {
      assert.ok(
        p.color === '#22c55e' || p.color === '#86efac',
        `unexpected heal color: ${p.color}`,
      );
    }
  });

  it('heal particles rise upward (negative vy)', () => {
    ps.spawnHeal(50, 100);
    const heals = ps.getParticles().filter((p) => p.type === 'heal');
    for (const p of heals) {
      assert.ok(p.vy < 0, `heal particle should rise, vy=${p.vy}`);
    }
  });

  it('heal particles have positive life', () => {
    ps.spawnHeal(0, 0);
    const heals = ps.getParticles().filter((p) => p.type === 'heal');
    for (const p of heals) {
      assert.ok(p.life > 0, `heal particle life should be > 0, got ${p.life}`);
      assert.ok(p.maxLife > 0);
    }
  });

  it('respects reduced-particles mode (fewer particles)', () => {
    const psNormal = new ParticleSystem();
    const psReduced = new ParticleSystem();
    psReduced.setReducedParticles(true);

    psNormal.spawnHeal(0, 0);
    psReduced.spawnHeal(0, 0);

    const normalCount = psNormal.getParticles().filter((p) => p.type === 'heal').length;
    const reducedCount = psReduced.getParticles().filter((p) => p.type === 'heal').length;
    assert.ok(
      reducedCount < normalCount,
      `reduced mode (${reducedCount}) should spawn fewer than normal (${normalCount})`,
    );
  });

  it('heal particles expire after life runs out', () => {
    ps.spawnHeal(0, 0);
    assert.ok(ps.getParticles().some((p) => p.type === 'heal'));
    // Advance well beyond max life (1.2s)
    ps.update(0, 0, 100, 100, 'forest', 2.0);
    const heals = ps.getParticles().filter((p) => p.type === 'heal');
    assert.equal(heals.length, 0, 'heal particles should expire');
  });
});
