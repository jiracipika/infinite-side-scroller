import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { ParticleSystem } from '@/game/entities/particles';

describe('ParticleSystem lifecycle', () => {
  let ps: ParticleSystem;

  beforeEach(() => {
    ps = new ParticleSystem();
  });

  it('starts empty', () => {
    assert.equal(ps.getParticles().length, 0);
  });

  it('clear() empties all particles', () => {
    ps.spawnJumpDust(100, 200);
    assert.ok(ps.getParticles().length > 0);
    ps.clear();
    assert.equal(ps.getParticles().length, 0);
  });

  it('spawnJumpDust creates gameplay particles', () => {
    ps.spawnJumpDust(0, 0);
    const particles = ps.getParticles();
    assert.ok(particles.length >= 4, 'should spawn at least 4 jump dust particles');
    for (const p of particles) {
      assert.equal(p.type, 'jump_dust');
      assert.ok(p.life > 0);
    }
  });

  it('spawnLanding creates landing particles', () => {
    ps.spawnLanding(50, 100);
    const particles = ps.getParticles();
    assert.ok(particles.length >= 6);
    for (const p of particles) {
      assert.equal(p.type, 'landing');
    }
  });

  it('spawnCoinSparkle creates coin_sparkle particles', () => {
    ps.spawnCoinSparkle(0, 0);
    const particles = ps.getParticles();
    assert.ok(particles.length >= 4);
    for (const p of particles) {
      assert.equal(p.type, 'coin_sparkle');
    }
  });

  it('spawnEnemyDeath creates enemy_death particles with given color', () => {
    ps.spawnEnemyDeath(0, 0, '#ff0000');
    const particles = ps.getParticles();
    assert.ok(particles.length >= 6);
    for (const p of particles) {
      assert.equal(p.type, 'enemy_death');
      assert.equal(p.color, '#ff0000');
    }
  });

  it('spawnScorePopup creates exactly one popup with text', () => {
    ps.spawnScorePopup(100, 200, '+50');
    const particles = ps.getParticles();
    assert.equal(particles.length, 1);
    assert.equal(particles[0].type, 'score_popup');
    assert.equal(particles[0].text, '+50');
  });
});

describe('ParticleSystem update lifecycle', () => {
  it('removes particles when life expires', () => {
    const ps = new ParticleSystem();
    ps.spawnScorePopup(0, 0, 'test');
    assert.equal(ps.getParticles().length, 1);

    // The popup has life=1.0; advance time beyond that.
    // No ambient spawn because Math.random is not controlled, but
    // gameplay particles should die after their life expires.
    // Use a camera that's far away to minimize ambient spawning.
    ps.update(0, 0, 100, 100, 'dark_caves', 2.0);
    // Particle should be gone (life was 1.0, we advanced 2.0s)
    const popups = ps.getParticles().filter((p) => p.type === 'score_popup');
    assert.equal(popups.length, 0, 'score_popup should expire after life runs out');
  });

  it('reducedParticles mode spawns fewer particles', () => {
    const psNormal = new ParticleSystem();
    const psReduced = new ParticleSystem();
    psReduced.setReducedParticles(true);

    psNormal.spawnJumpDust(0, 0);
    psReduced.spawnJumpDust(0, 0);

    assert.ok(
      psReduced.getParticles().length < psNormal.getParticles().length,
      'reduced mode should spawn fewer particles',
    );
  });

  it('setReducedParticles is idempotent', () => {
    const ps = new ParticleSystem();
    ps.setReducedParticles(true);
    ps.setReducedParticles(true);
    ps.spawnJumpDust(0, 0);
    // Should still work normally
    assert.ok(ps.getParticles().length > 0);
  });
});
