import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createRng } from '@/game/world/rng';
import { getTerrainHeight, isUnderground } from '@/game/world/terrain';

/**
 * Characterization tests for the seeded world RNG and terrain generator.
 *
 * Nothing else in the repo unit-tested these directly. Both are pure and
 * determinism-critical: chunk layout, enemy spawns and terrain all flow from
 * createRng(seed) + getTerrainHeight(x, seed). If a sequence changes here,
 * every player's world changes — pin it.
 */

describe('createRng (mulberry32)', () => {
  it('same seed produces an identical sequence', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 1000; i++) {
      assert.equal(a.next(), b.next(), `diverges at draw ${i}`);
    }
  });

  it('different seeds produce different sequences', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    assert.notDeepEqual(seqA, seqB);
  });

  it('next() stays in [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 10000; i++) {
      const v = rng.next();
      assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
    }
  });

  it('nextInt() is inclusive of both bounds and always in range', () => {
    const rng = createRng(9);
    let sawMin = false, sawMax = false;
    for (let i = 0; i < 5000; i++) {
      const v = rng.nextInt(3, 7);
      assert.ok(v >= 3 && v <= 7, `out of range: ${v}`);
      assert.ok(Number.isInteger(v));
      if (v === 3) sawMin = true;
      if (v === 7) sawMax = true;
    }
    assert.ok(sawMin && sawMax, 'inclusive bounds are reachable');
  });

  it('nextFloat() stays in [min, max)', () => {
    const rng = createRng(11);
    for (let i = 0; i < 5000; i++) {
      const v = rng.nextFloat(-2.5, 4.5);
      assert.ok(v >= -2.5 && v < 4.5, `out of range: ${v}`);
    }
  });

  it('chance() honors the extremes and is boolean', () => {
    const rng = createRng(13);
    for (let i = 0; i < 100; i++) assert.equal(rng.chance(1), true);
    for (let i = 0; i < 100; i++) assert.equal(rng.chance(0), false);
    const p = rng.chance(0.5);
    assert.equal(typeof p, 'boolean');
  });

  it('negative seed is coerced to int32 without throwing', () => {
    const a = createRng(-12345);
    const b = createRng(-12345);
    assert.equal(a.next(), b.next());
  });
});

describe('getTerrainHeight', () => {
  it('is deterministic for the same (x, seed)', () => {
    assert.equal(
      getTerrainHeight(1234, 42),
      getTerrainHeight(1234, 42),
    );
  });

  it('changes with the seed', () => {
    // At any sampled x, some seed pair must differ — terrain is seed-driven.
    let differs = false;
    for (let x = 0; x < 3000 && !differs; x += 137) {
      if (getTerrainHeight(x, 1) !== getTerrainHeight(x, 2)) differs = true;
    }
    assert.ok(differs, 'different seeds produce different terrain');
  });

  it('flat with zero hilliness at exactly BASE_HEIGHT 400', () => {
    for (const x of [0, 500, 12345, 999999]) {
      assert.equal(getTerrainHeight(x, 42, 60, 0), 400);
    }
  });

  it('stays within the physical amplitude budget', () => {
    // Max combined variation: variation * hilliness * (1 + 0.4 + 0.15) = 1.55 * v * h
    for (const [variation, hilliness] of [[60, 0.3], [60, 1], [120, 0.8]]) {
      const amp = variation * hilliness * 1.55;
      for (let x = 0; x < 50000; x += 333) {
        const h = getTerrainHeight(x, 77, variation, hilliness);
        assert.ok(
          h <= 400 && h >= 400 - amp - 0.001,
          `height ${h} outside [${400 - amp}, 400] at x=${x}`,
        );
      }
    }
  });

  it('is locally smooth: neighboring columns differ by a bounded step', () => {
    let prev = getTerrainHeight(0, 42);
    for (let x = 1; x <= 20000; x++) {
      const h = getTerrainHeight(x, 42);
      assert.ok(Math.abs(h - prev) < 12, `1px step too steep at x=${x}`);
      prev = h;
    }
  });
});

describe('isUnderground', () => {
  it('marks points well below the surface as underground', () => {
    for (let x = 0; x < 5000; x += 250) {
      const surface = getTerrainHeight(x, 42);
      assert.equal(isUnderground(x, surface + 200, 42), true, `below at x=${x}`);
    }
  });

  it('marks points well above the surface as open air', () => {
    for (let x = 0; x < 5000; x += 250) {
      const surface = getTerrainHeight(x, 42);
      assert.equal(isUnderground(x, surface - 200, 42), false, `above at x=${x}`);
    }
  });
});
