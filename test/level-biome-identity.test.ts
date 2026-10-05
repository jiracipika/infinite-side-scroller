import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveBiomeIdentity,
  deriveMixedIdentity,
  type BiomeIdentityInput,
} from '@/game/level-biome-identity';

// Authored fixtures — values mirror the biome registry in
// src/game/world/biomes.ts (BIOMES). The registry itself uses a TS enum and
// is therefore not Node-importable under type stripping; the grep-source
// contract (scripts/test-level-select-biome-preview.mjs) pins the wiring
// from the registry into these pure derivations.
const FOREST: BiomeIdentityInput = {
  name: 'Forest',
  colors: { ground: '#8be65a', groundDark: '#0b2415', platform: '#c7ff4d' },
};
const DESERT: BiomeIdentityInput = {
  name: 'Desert',
  colors: { ground: '#ffd166', groundDark: '#3d1f2e', platform: '#c7ff4d' },
};
const SKY: BiomeIdentityInput = {
  name: 'Sky Islands',
  colors: { ground: '#b8c7ff', groundDark: '#1d2440', platform: '#c7ff4d' },
};
const VOLCANIC: BiomeIdentityInput = {
  name: 'Volcanic',
  colors: { ground: '#ff7166', groundDark: '#2b0a18', platform: '#ffb000' },
};

/** First-appearance order of unique biomes along the authored BIOME_ORDER. */
const SHIFTING_SEQUENCE: BiomeIdentityInput[] = [
  { name: 'Grassland', colors: { ground: '#a9f25b', groundDark: '#0f2d1a', platform: '#c7ff4d' } },
  FOREST,
  DESERT,
  { name: 'Rocky Mountains', colors: { ground: '#a08cff', groundDark: '#191631', platform: '#c7ff4d' } },
  SKY,
  VOLCANIC,
  { name: 'Dark Caves', colors: { ground: '#9570ff', groundDark: '#120a26', platform: '#c7ff4d' } },
];

describe('deriveBiomeIdentity', () => {
  test('identity accents are the authored ground colors (distinct per biome)', () => {
    assert.equal(deriveBiomeIdentity('forest', FOREST).accent, '#8be65a');
    assert.equal(deriveBiomeIdentity('desert', DESERT).accent, '#ffd166');
    assert.equal(deriveBiomeIdentity('ice', SKY).accent, '#b8c7ff');
    assert.equal(deriveBiomeIdentity('volcano', VOLCANIC).accent, '#ff7166');
    const accents = new Set(
      [FOREST, DESERT, SKY, VOLCANIC].map((b) => deriveBiomeIdentity('forest', b).accent),
    );
    assert.equal(accents.size, 4, 'each biome must read as its own color');
  });

  test('stripe gradient is built from the authored palette (dark → ground → platform)', () => {
    const stripe = deriveBiomeIdentity('volcano', VOLCANIC).stripe;
    assert.match(stripe, /^linear-gradient\(90deg, /);
    for (const stop of ['#2b0a18', '#ff7166', '#ffb000']) {
      assert.ok(stripe.includes(stop), `stripe missing authored stop ${stop}`);
    }
  });

  test('authored registry name passes through for aria/labelling', () => {
    assert.equal(deriveBiomeIdentity('ice', SKY).name, 'Sky Islands');
    assert.equal(deriveBiomeIdentity('volcano', VOLCANIC).name, 'Volcanic');
  });

  test('pure: same input, same identity (no RNG, no clock)', () => {
    const a = deriveBiomeIdentity('forest', FOREST);
    assert.deepEqual(a, deriveBiomeIdentity('forest', FOREST));
  });
});

describe('deriveMixedIdentity (shifting endless sequence)', () => {
  test('stripe composes one stop per unique authored ground color', () => {
    const mixed = deriveMixedIdentity(SHIFTING_SEQUENCE);
    assert.match(mixed.stripe, /^linear-gradient\(90deg, /);
    for (const stop of ['#a9f25b', '#8be65a', '#ffd166', '#a08cff', '#b8c7ff', '#ff7166', '#9570ff']) {
      assert.ok(mixed.stripe.includes(stop), `mixed stripe missing ${stop}`);
    }
  });

  test('mixed is distinct from every single-biome stripe', () => {
    const mixed = deriveMixedIdentity(SHIFTING_SEQUENCE).stripe;
    const singles = [FOREST, DESERT, SKY, VOLCANIC].map(
      (b) => deriveBiomeIdentity('forest', b).stripe,
    );
    for (const s of singles) assert.notEqual(mixed, s);
  });

  test('mixed labels itself and stays deterministic', () => {
    const a = deriveMixedIdentity(SHIFTING_SEQUENCE);
    assert.equal(a.name, 'Shifting Worlds');
    assert.deepEqual(a, deriveMixedIdentity(SHIFTING_SEQUENCE));
  });
});
