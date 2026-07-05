import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { COMBO_TIERS, comboMultiplierFor as engineMultiplierFor } from '@/game/engine/combo-tiers';

/**
 * We test the actual exported comboMultiplierFor() from combo-tiers.ts —
 * the same function the engine's private getComboMultiplier() delegates to.
 * No local mirror, so if the two ever drift the tests catch it directly.
 */
const comboMultiplierFor = engineMultiplierFor;

// ── Tier table ───────────────────────────────────────────────────────

describe('combo multiplier tiers', () => {
  it('COMBO_TIERS is ascending and non-empty', () => {
    assert.ok(COMBO_TIERS.length > 0, 'COMBO_TIERS must not be empty');
    for (let i = 1; i < COMBO_TIERS.length; i++) {
      assert.ok(
        COMBO_TIERS[i] > COMBO_TIERS[i - 1],
        `COMBO_TIERS must be ascending: ${COMBO_TIERS[i]} > ${COMBO_TIERS[i - 1]}`,
      );
    }
  });

  it('every tier threshold is a positive integer >= 2', () => {
    for (const t of COMBO_TIERS) {
      assert.ok(Number.isInteger(t), `tier ${t} must be an integer`);
      assert.ok(t >= 2, `tier ${t} must be >= 2 (you need >=2 kills for a combo)`);
    }
  });

  it('returns multiplier 1 for zero kills', () => {
    assert.equal(comboMultiplierFor(0), 1);
  });

  it('returns multiplier 1 just below the first tier', () => {
    assert.equal(comboMultiplierFor(COMBO_TIERS[0] - 1), 1);
  });

  it('reaching a tier increases the multiplier by exactly 1', () => {
    for (let i = 0; i < COMBO_TIERS.length; i++) {
      const tier = COMBO_TIERS[i];
      const below = comboMultiplierFor(tier - 1);
      const at = comboMultiplierFor(tier);
      assert.equal(
        at - below,
        1,
        `multiplier should increase by exactly 1 at tier ${tier} (${below} -> ${at})`,
      );
    }
  });

  it('each tier maps to a strictly higher multiplier than the previous', () => {
    const mults = COMBO_TIERS.map((t) => comboMultiplierFor(t));
    for (let i = 1; i < mults.length; i++) {
      assert.ok(mults[i] > mults[i - 1], `multiplier must increase across tiers: ${mults}`);
    }
  });

  it('multiplier matches the documented 1/2/3/4/5 schedule', () => {
    // The historical schedule: <3 ->1, <6 ->2, <10 ->3, <15 ->4, >=15 ->5
    assert.equal(comboMultiplierFor(0), 1);
    assert.equal(comboMultiplierFor(2), 1);
    assert.equal(comboMultiplierFor(3), 2);
    assert.equal(comboMultiplierFor(5), 2);
    assert.equal(comboMultiplierFor(6), 3);
    assert.equal(comboMultiplierFor(9), 3);
    assert.equal(comboMultiplierFor(10), 4);
    assert.equal(comboMultiplierFor(14), 4);
    assert.equal(comboMultiplierFor(15), 5);
    assert.equal(comboMultiplierFor(50), 5);
  });

  it('multiplier is monotonically non-decreasing', () => {
    let prev = 0;
    for (let k = 0; k <= 100; k++) {
      const m = comboMultiplierFor(k);
      assert.ok(m >= prev, `multiplier decreased at ${k} kills: ${m} < ${prev}`);
      prev = m;
    }
  });
});

// ── Milestone boundary ───────────────────────────────────────────────

describe('combo milestone detection', () => {
  /**
   * Replicates the milestone check in awardEnemyDefeat():
   *   const prevMultiplier = getComboMultiplier(comboCount);
   *   comboCount += 1;
   *   const multiplier = getComboMultiplier(comboCount);
   *   milestone = multiplier > prevMultiplier && multiplier >= 2;
   */
  function milestoneAt(killsBeforeIncrement: number): boolean {
    const prev = comboMultiplierFor(killsBeforeIncrement);
    const next = comboMultiplierFor(killsBeforeIncrement + 1);
    return next > prev && next >= 2;
  }

  it('fires exactly at each tier threshold (kills before increment)', () => {
    for (const tier of COMBO_TIERS) {
      assert.ok(
        milestoneAt(tier - 1),
        `milestone should fire when going from ${tier - 1} to ${tier} kills`,
      );
    }
  });

  it('does NOT fire between thresholds', () => {
    for (let k = 0; k <= 50; k++) {
      const isThreshold = COMBO_TIERS.includes(k + 1 as (typeof COMBO_TIERS)[number]);
      const fires = milestoneAt(k);
      assert.equal(
        fires,
        isThreshold,
        `milestone should ${isThreshold ? 'fire' : 'NOT fire'} at ${k} -> ${k + 1} kills`,
      );
    }
  });

  it('does not fire at zero or one kills', () => {
    assert.equal(milestoneAt(0), false);
    assert.equal(milestoneAt(1), false);
  });
});
