import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BIOME_SPAWN_PROFILES,
  MIN_GROUP_GAP,
  MAX_GROUP_SPAN,
  MIN_SPIKE_WIDTH,
  MAX_SPIKE_WIDTH,
  MAX_GROUPS_PER_CHUNK,
  generatePatternLayout,
  profileForLevelBiome,
  profileForBiomeName,
  type BiomeSpawnProfile,
} from '@/game/spawn-patterns';
import { spawnHazardsForChunk } from '@/game/hazards/index';
import { spawnEnemiesForChunk } from '@/game/entities/Collectibles';

/**
 * Run-variety slice: per-biome obstacle/spawner pattern profiles.
 *
 * Fairness contract under test (holds for EVERY biome profile, every seed):
 *  - consecutive obstacle GROUPS are >= MIN_GROUP_GAP apart (reaction floor:
 *    ~0.54s at the 280px/s base speed),
 *  - a tight group's total span is <= MAX_GROUP_SPAN so it reads as ONE
 *    jumpable obstacle,
 *  - spike widths stay inside the authored per-biome window, capped by
 *    MAX_SPIKE_WIDTH,
 *  - the chunk-0 safe zone still suppresses early spikes.
 *
 * The rng stub mirrors GameEngine.seededRng exactly so integration tests run
 * the same numbers the engine runs.
 */
const stubRng = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Flat terrain sampled every 4px like Chunk.heights (400 = BASE_HEIGHT). */
const FLAT_HEIGHTS: number[] = new Array(201).fill(400);

const ALL_PROFILES: BiomeSpawnProfile[] = Object.values(BIOME_SPAWN_PROFILES);
const SEEDS = 300;

function mergedBandGaps(xs: number[]): { bandSpans: number[]; bandGaps: number[] } {
  // Merge spikes closer than MIN_GROUP_GAP into "bands" (one jumpable run),
  // then measure band spans and the gaps BETWEEN bands.
  const sorted = [...xs].sort((a, b) => a - b);
  const bandSpans: number[] = [];
  const bandGaps: number[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - prev < MIN_GROUP_GAP) {
      prev = sorted[i];
      continue;
    }
    bandSpans.push(prev - start);
    bandGaps.push(sorted[i] - prev);
    start = sorted[i];
    prev = sorted[i];
  }
  if (sorted.length > 0) bandSpans.push(prev - start);
  return { bandSpans, bandGaps };
}

describe('BIOME_SPAWN_PROFILES', () => {
  it('covers all eight biome keys with archetype weights summing to 1', () => {
    const ids = Object.keys(BIOME_SPAWN_PROFILES).sort();
    assert.deepEqual(ids, [
      'dark_caves', 'desert', 'forest', 'grassland', 'lava', 'mixed', 'rocky', 'sky',
    ]);
    for (const p of ALL_PROFILES) {
      const sum =
        p.archetypes.scatter + p.archetypes.cluster + p.archetypes.rhythm +
        p.archetypes['wide-single'];
      assert.ok(
        Math.abs(sum - 1) < 1e-9,
        `${p.id} archetype weights sum to ${sum}, expected 1`,
      );
    }
  });

  it('every profile respects the global fairness floors', () => {
    for (const p of ALL_PROFILES) {
      assert.ok(p.groupGap >= MIN_GROUP_GAP, `${p.id} groupGap ${p.groupGap} < floor`);
      assert.ok(p.rhythmCadence >= MIN_GROUP_GAP, `${p.id} rhythmCadence ${p.rhythmCadence} < floor`);
      assert.ok(p.clusterSpread <= MAX_GROUP_SPAN, `${p.id} clusterSpread exceeds group-span cap`);
      assert.ok(p.spikeWidth.min >= MIN_SPIKE_WIDTH, `${p.id} spike min width below floor`);
      assert.ok(p.spikeWidth.max <= MAX_SPIKE_WIDTH, `${p.id} spike max width above cap`);
      assert.ok(p.spikeWidth.min <= p.spikeWidth.max, `${p.id} inverted spike width window`);
      assert.ok(p.enemyCountMult >= 0.5 && p.enemyCountMult <= 1.5, `${p.id} enemy mult out of bounds`);
      assert.ok(p.hazardCountMult >= 0.5 && p.hazardCountMult <= 1.5, `${p.id} hazard mult out of bounds`);
      assert.ok(p.spikeChunkChance > 0 && p.spikeChunkChance <= 1, `${p.id} spikeChunkChance out of range`);
    }
  });

  it('every archetype is reachable in every biome (weight >= 0.05)', () => {
    for (const p of ALL_PROFILES) {
      for (const [arch, w] of Object.entries(p.archetypes)) {
        assert.ok(w >= 0.05, `${p.id} ${arch} weight ${w} is effectively unreachable`);
      }
    }
  });

  it('profileForLevelBiome maps the five level biome ids', () => {
    assert.equal(profileForLevelBiome('forest'), BIOME_SPAWN_PROFILES.forest);
    assert.equal(profileForLevelBiome('desert'), BIOME_SPAWN_PROFILES.desert);
    assert.equal(profileForLevelBiome('ice'), BIOME_SPAWN_PROFILES.sky);
    assert.equal(profileForLevelBiome('volcano'), BIOME_SPAWN_PROFILES.lava);
    assert.equal(profileForLevelBiome('mixed'), BIOME_SPAWN_PROFILES.mixed);
  });

  it('profileForBiomeName maps all seven registry names, falling back to mixed', () => {
    assert.equal(profileForBiomeName('Grassland'), BIOME_SPAWN_PROFILES.grassland);
    assert.equal(profileForBiomeName('Forest'), BIOME_SPAWN_PROFILES.forest);
    assert.equal(profileForBiomeName('Desert'), BIOME_SPAWN_PROFILES.desert);
    assert.equal(profileForBiomeName('Rocky Mountains'), BIOME_SPAWN_PROFILES.rocky);
    assert.equal(profileForBiomeName('Dark Caves'), BIOME_SPAWN_PROFILES.dark_caves);
    assert.equal(profileForBiomeName('Sky Islands'), BIOME_SPAWN_PROFILES.sky);
    assert.equal(profileForBiomeName('Volcanic'), BIOME_SPAWN_PROFILES.lava);
    assert.equal(profileForBiomeName('Somewhere Else'), BIOME_SPAWN_PROFILES.mixed);
  });
});

describe('generatePatternLayout', () => {
  it('is deterministic per (profile, seed)', () => {
    for (const p of [BIOME_SPAWN_PROFILES.desert, BIOME_SPAWN_PROFILES.lava]) {
      for (const seed of [0, 1, 7777]) {
        const a = generatePatternLayout(p, stubRng, seed);
        const b = generatePatternLayout(p, stubRng, seed);
        assert.deepEqual(a, b, `divergence at ${p.id}/${seed}`);
      }
    }
  });

  it('all slots stay inside chunk margins for every profile x 300 seeds', () => {
    for (const p of ALL_PROFILES) {
      for (let seed = 0; seed < SEEDS; seed++) {
        const layout = generatePatternLayout(p, stubRng, seed);
        for (const group of layout.groups) {
          for (const slot of group) {
            assert.ok(
              slot.x >= 50 && slot.x <= 750,
              `${p.id} seed ${seed}: slot ${slot.x} outside [50, 750]`,
            );
          }
        }
      }
    }
  });

  it('fairness floor: consecutive groups are >= MIN_GROUP_GAP apart (every profile x 300 seeds)', () => {
    for (const p of ALL_PROFILES) {
      for (let seed = 0; seed < SEEDS; seed++) {
        const layout = generatePatternLayout(p, stubRng, seed);
        const groupStarts = layout.groups.map((g) => Math.min(...g.map((s) => s.x)));
        groupStarts.sort((a, b) => a - b);
        for (let i = 1; i < groupStarts.length; i++) {
          assert.ok(
            groupStarts[i] - groupStarts[i - 1] >= MIN_GROUP_GAP,
            `${p.id} seed ${seed}: groups ${groupStarts[i - 1]} -> ${groupStarts[i]} closer than ${MIN_GROUP_GAP}`,
          );
        }
        assert.ok(
          layout.groups.length <= MAX_GROUPS_PER_CHUNK,
          `${p.id} seed ${seed}: ${layout.groups.length} groups exceeds cap`,
        );
      }
    }
  });

  it('fairness floor: cluster group span stays <= MAX_GROUP_SPAN (every profile x 300 seeds)', () => {
    let sawMultiSlotGroup = false;
    for (const p of ALL_PROFILES) {
      for (let seed = 0; seed < SEEDS; seed++) {
        const layout = generatePatternLayout(p, stubRng, seed);
        for (const group of layout.groups) {
          const xs = group.map((s) => s.x);
          const span = Math.max(...xs) - Math.min(...xs);
          assert.ok(
            span <= MAX_GROUP_SPAN,
            `${p.id} seed ${seed}: group span ${span} exceeds ${MAX_GROUP_SPAN}`,
          );
          if (group.length >= 2) sawMultiSlotGroup = true;
        }
      }
    }
    assert.ok(sawMultiSlotGroup, 'sweep should exercise multi-slot (cluster) groups');
  });

  it('safe zone drops chunk-0 slots (no slot below safeZoneEnd)', () => {
    for (const p of ALL_PROFILES) {
      for (let seed = 0; seed < 100; seed++) {
        const layout = generatePatternLayout(p, stubRng, seed, { safeZoneEnd: 760 });
        assert.equal(
          layout.groups.length, 0,
          `${p.id} seed ${seed}: chunk-0 safe zone must suppress all slots`,
        );
      }
    }
  });

  it('archetype shapes read as authored: rhythm cadence, wide single, tight cluster', () => {
    // Rhythm (sky is rhythm-heavy): consecutive slots sit one cadence apart.
    let sawRhythm = false;
    for (let seed = 0; seed < SEEDS && !sawRhythm; seed++) {
      const layout = generatePatternLayout(BIOME_SPAWN_PROFILES.sky, stubRng, seed);
      if (layout.archetype !== 'rhythm' || layout.groups.length < 2) continue;
      sawRhythm = true;
      const cadence = BIOME_SPAWN_PROFILES.sky.rhythmCadence;
      for (let i = 1; i < layout.groups.length; i++) {
        const dx = layout.groups[i][0].x - layout.groups[i - 1][0].x;
        assert.ok(
          Math.abs(dx - cadence) < 2,
          `rhythm spacing ${dx} != cadence ${cadence}`,
        );
      }
    }
    assert.ok(sawRhythm, 'sky profile never produced a rhythm string in 300 seeds');

    // Wide-single: exactly one group, one slot, flagged wide.
    let sawWide = false;
    for (let seed = 0; seed < SEEDS && !sawWide; seed++) {
      const layout = generatePatternLayout(BIOME_SPAWN_PROFILES.desert, stubRng, seed);
      if (layout.archetype !== 'wide-single') continue;
      sawWide = true;
      assert.equal(layout.groups.length, 1);
      assert.equal(layout.groups[0].length, 1);
      assert.equal(layout.groups[0][0].wide, true);
    }
    assert.ok(sawWide, 'desert profile never produced a wide-single in 300 seeds');

    // Cluster: some seeds yield a >= 2-slot group within the span cap.
    let sawCluster = false;
    for (let seed = 0; seed < SEEDS && !sawCluster; seed++) {
      const layout = generatePatternLayout(BIOME_SPAWN_PROFILES.lava, stubRng, seed);
      if (layout.archetype !== 'cluster') continue;
      if (!layout.groups.some((g) => g.length >= 2)) continue;
      sawCluster = true;
    }
    assert.ok(sawCluster, 'lava profile never produced a cluster in 300 seeds');
  });
});

describe('spawnHazardsForChunk with a biome profile', () => {
  const CH_X = 40000; // non-zero chunk id path

  it('spike widths honor the profile window and heights snap to terrain', () => {
    for (const p of ALL_PROFILES) {
      for (let seed = 0; seed < 100; seed++) {
        const hazards = spawnHazardsForChunk(
          12, [], FLAT_HEIGHTS, CH_X, stubRng, p,
        );
        for (const h of hazards) {
          if (h.type !== 'spike') continue;
          assert.ok(
            h.width >= p.spikeWidth.min && h.width <= p.spikeWidth.max,
            `${p.id} seed ${seed}: spike width ${h.width} outside [${p.spikeWidth.min}, ${p.spikeWidth.max}]`,
          );
          assert.equal(h.y, 400 - 12, 'spike must sit on the terrain surface');
          assert.ok(h.x >= CH_X + 50 && h.x <= CH_X + 750, 'spike outside chunk margins');
        }
      }
    }
  });

  it('fairness floor: spike bands are >= MIN_GROUP_GAP apart and bands are <= MAX_GROUP_SPAN wide', () => {
    for (const p of ALL_PROFILES) {
      for (let seed = 0; seed < 100; seed++) {
        const hazards = spawnHazardsForChunk(12, [], FLAT_HEIGHTS, CH_X, stubRng, p);
        const xs = hazards.filter((h) => h.type === 'spike').map((h) => h.x - CH_X);
        if (xs.length < 2) continue;
        const { bandSpans, bandGaps } = mergedBandGaps(xs);
        for (const span of bandSpans) {
          assert.ok(span <= MAX_GROUP_SPAN, `${p.id} seed ${seed}: band span ${span} too wide`);
        }
        for (const gap of bandGaps) {
          assert.ok(gap >= MIN_GROUP_GAP, `${p.id} seed ${seed}: band gap ${gap} below floor`);
        }
      }
    }
  });

  it('chunk-0 safe zone still suppresses early spikes on the profile path', () => {
    for (const p of [BIOME_SPAWN_PROFILES.lava, BIOME_SPAWN_PROFILES.dark_caves]) {
      const hazards = spawnHazardsForChunk(0, [], FLAT_HEIGHTS, 0, stubRng, p);
      const early = hazards.filter((h) => h.type === 'spike' && h.x < 760);
      assert.equal(early.length, 0, 'no spike may spawn inside the chunk-0 safe zone');
    }
  });

  it('baseline (no profile) behavior is unchanged: legacy widths {24,32,40}, x in [50, 750)', () => {
    for (let chunkId = 0; chunkId < 60; chunkId++) {
      const hazards = spawnHazardsForChunk(chunkId, [], FLAT_HEIGHTS, chunkId * 800, stubRng);
      for (const h of hazards) {
        if (h.type !== 'spike') continue;
        assert.ok(
          [24, 32, 40].includes(h.width),
          `legacy spike width ${h.width} drifted`,
        );
        assert.ok(h.x - chunkId * 800 >= 50 && h.x - chunkId * 800 < 750);
      }
    }
  });
});

describe('spawnEnemiesForChunk with a biome profile', () => {
  it('enemy count is monotone in enemyCountMult for a fixed seed (desert <= grassland <= lava)', () => {
    for (let chunkId = 0; chunkId < 100; chunkId++) {
      const d = spawnEnemiesForChunk(chunkId, [], stubRng, FLAT_HEIGHTS, chunkId * 800, 2, BIOME_SPAWN_PROFILES.desert);
      const g = spawnEnemiesForChunk(chunkId, [], stubRng, FLAT_HEIGHTS, chunkId * 800, 2, BIOME_SPAWN_PROFILES.grassland);
      const l = spawnEnemiesForChunk(chunkId, [], stubRng, FLAT_HEIGHTS, chunkId * 800, 2, BIOME_SPAWN_PROFILES.lava);
      assert.ok(d.length <= g.length && g.length <= l.length,
        `chunk ${chunkId}: counts ${d.length}, ${g.length}, ${l.length} not monotone in enemyCountMult`);
    }
  });

  it('baseline (no profile) count formula is unchanged', () => {
    for (let chunkId = 0; chunkId < 60; chunkId++) {
      const spawns = spawnEnemiesForChunk(chunkId, [], stubRng, FLAT_HEIGHTS, chunkId * 800, 0);
      const base = chunkId * 7777;
      const expected =
        2 + Math.floor(stubRng(base + 100) * 4) +
        (chunkId > 0 && chunkId % 50 === 0 ? 1 : 0); // boss every 50 chunks
      assert.equal(spawns.length, expected, `chunk ${chunkId} baseline count drifted`);
    }
  });
});
