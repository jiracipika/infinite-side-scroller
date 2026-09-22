import { it } from 'node:test';
import assert from 'node:assert/strict';
import { registerProjectileHit } from '@/game/combat/projectile-hit';
import type { PlayerProjectile } from '@/game/entities/player';

function bolt(pierce: number): PlayerProjectile {
  return { x: 0, y: 0, vx: 460, life: 1.8, damage: 2, radius: 6,
    color: '#a855f7', glowColor: '#a855f7', pierce };
}
it('a magic bolt hits two distinct enemies and never repeats damage on an overlapping enemy', () => {
  const p = bolt(1);
  const first = {}, second = {};
  assert.equal(registerProjectileHit(p, first), true);
  assert.ok(p.life > 0);
  assert.equal(registerProjectileHit(p, first), false);
  assert.ok(p.life > 0);
  assert.equal(registerProjectileHit(p, second), true);
  assert.equal(p.life, 0);
  assert.equal(registerProjectileHit(p, {}), false);
});
it('ordinary shots stop at the first target', () => {
  const p = bolt(0);
  assert.equal(registerProjectileHit(p, {}), true);
  assert.equal(registerProjectileHit(p, {}), false);
});
