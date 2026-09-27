import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  rateLevelDifficulty,
} from '@/game/level-difficulty';
import { ADVENTURE_LEVELS } from '@/game/data/levels';

describe('rateLevelDifficulty', () => {
  test('returns all three tiers across a label->tier mapping', () => {
    assert.equal(rateLevelDifficulty({
      ...ADVENTURE_LEVELS[0], enemyDensity: 0.1, hazardDensity: 0.1, enemies: ['walker'], boss: false,
    }).label, 'CALM');
    assert.equal(rateLevelDifficulty({
      ...ADVENTURE_LEVELS[0], enemyDensity: 0.5, hazardDensity: 0.5, enemies: ['walker', 'shooter'], boss: false,
    }).tier, 2);
    assert.equal(rateLevelDifficulty({
      ...ADVENTURE_LEVELS[0], enemyDensity: 0.9, hazardDensity: 0.9, enemies: ['walker', 'shooter', 'diver', 'turret', 'charger'], boss: true,
    }).label, 'WILD');
  });

  test('tier boundaries match the exported cut-offs (no off-by-one)', () => {
    const base = ADVENTURE_LEVELS[0];
    // Variety 1 (5 enemy types) contributes 0.2, so:
    //   load = enemyDensity*0.5 + hazardDensity*0.3 + 0.2
    const FIVE = ['walker', 'shooter', 'diver', 'turret', 'charger'];
    const mk = (enemyDensity: number, hazardDensity: number, enemies: string[], boss: boolean) =>
      rateLevelDifficulty({ ...base, enemyDensity, hazardDensity, enemies, boss });
    // Exactly at a cut-off counts as the higher tier (>= semantics).
    // steady: 0.5*0.5 + 0*0.3 + 0.2 = 0.45 exactly.
    assert.equal(mk(0.5, 0, FIVE, false).tier, 2);
    // wild: 0.8*0.5 + 0.4*0.3 + 0.2 = 0.72 exactly.
    assert.equal(mk(0.8, 0.4, FIVE, false).tier, 3);
    // Just below each cut-off stays in the lower tier.
    assert.equal(mk(0.49, 0, FIVE, false).tier, 1);
    assert.equal(mk(0.79, 0.4, FIVE, false).tier, 2);
  });

  test('boss flag alone can lift a mid load one tier', () => {
    const base = ADVENTURE_LEVELS[0];
    // 0.6*0.5 + 0.4*0.3 + 0.08 = 0.5 -> STEADY; +0.25 boss -> 0.75 -> WILD.
    const noBoss = rateLevelDifficulty({ ...base, enemyDensity: 0.6, hazardDensity: 0.4, enemies: ['walker', 'shooter'], boss: false });
    const withBoss = rateLevelDifficulty({ ...base, enemyDensity: 0.6, hazardDensity: 0.4, enemies: ['walker', 'shooter'], boss: true });
    assert.equal(noBoss.tier, 2);
    assert.equal(withBoss.label, 'WILD');
  });

  test('every authored adventure level rates 1..3 and levels generally trend harder', () => {
    const ratings = ADVENTURE_LEVELS.map((l) => rateLevelDifficulty(l));
    for (const r of ratings) {
      assert.ok([1, 2, 3].includes(r.tier));
      assert.equal(r.label, r.tier === 3 ? 'WILD' : r.tier === 2 ? 'STEADY' : 'CALM');
    }
    // The final stretch should never be calmer than the opening on average.
    const first = ratings.slice(0, 5).reduce((s, r) => s + r.tier, 0) / 5;
    const last = ratings.slice(-5).reduce((s, r) => s + r.tier, 0) / 5;
    assert.ok(last >= first, `late levels (${last}) should not be calmer than early (${first})`);
  });

  test('pure function: same input, same rating (no RNG/save reads)', () => {
    const level = ADVENTURE_LEVELS[3];
    assert.deepEqual(rateLevelDifficulty(level), rateLevelDifficulty(level));
  });
});
