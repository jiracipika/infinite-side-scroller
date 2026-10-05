/**
 * Biome-driven run-variety: per-biome obstacle/spawner pattern profiles.
 *
 * Slice classification: Better — deepens the EXISTING run loop with authored
 * variety (pattern archetypes, density/cadence curves, gap-width windows).
 * No new mechanics, no new biomes, no terrain-geometry or physics changes.
 *
 * Pure data + pure pattern layout. Deliberately imports nothing from the
 * biome registry (src/game/world/biomes.ts uses TS enums, which are not
 * Node-importable under the test runner's type stripping): profiles are
 * keyed by plain strings and resolved from biome NAMES via
 * profileForBiomeName(), so the engine can hand over `chunk.biome.name`.
 *
 * FAIRNESS FLOWS (enforced by generatePatternLayout and pinned in
 * test/spawn-patterns.test.ts for every profile x seed):
 *  - consecutive obstacle GROUPS are >= MIN_GROUP_GAP apart (a reaction-time
 *    floor: ~0.54s at the 280px/s base player speed),
 *  - a tight group's total span is <= MAX_GROUP_SPAN, so a cluster reads as
 *    ONE jumpable obstacle, never a wall,
 *  - spike widths stay inside the authored per-biome window, hard-capped by
 *    MAX_SPIKE_WIDTH,
 *  - rhythm cadence >= MIN_GROUP_GAP (each rhythm slot is its own obstacle).
 */

import type { LevelBiomeId } from './level-biome-identity';

/** Pattern archetypes: how one chunk's obstacle slots are laid out. */
export type PatternArchetype = 'scatter' | 'cluster' | 'rhythm' | 'wide-single';

// ---------------------------------------------------------------------------
// Global fairness floors — every per-biome profile must respect these.
// ---------------------------------------------------------------------------

/** Minimum world-X gap between two obstacle groups (~0.54s at 280px/s). */
export const MIN_GROUP_GAP = 150;
/** Narrowest authored spike. */
export const MIN_SPIKE_WIDTH = 24;
/** Widest spike any biome may author. */
export const MAX_SPIKE_WIDTH = 48;
/** A tight group's total span cap: it must read as ONE jumpable obstacle. */
export const MAX_GROUP_SPAN = 120;
/** Hard cap on obstacle groups per 800px chunk. */
export const MAX_GROUPS_PER_CHUNK = 4;

// ---------------------------------------------------------------------------
// Authored per-biome profiles.
// ---------------------------------------------------------------------------

export interface ArchetypeWeights {
  scatter: number;
  cluster: number;
  rhythm: number;
  'wide-single': number;
}

export interface BiomeSpawnProfile {
  id: string;
  /** Enemy count multiplier (1 = legacy baseline), clamped to [0.5, 1.5]. */
  enemyCountMult: number;
  /** Reserved density lever for future spike-band scaling; pinned in tests. */
  hazardCountMult: number;
  /** Per-biome spike width window [min, max], within [24, 48]. */
  spikeWidth: { min: number; max: number };
  /** Fraction of chunks in this biome that carry spikes at all (cadence). */
  spikeChunkChance: number;
  /** Weighted mix of layout archetypes for this biome. */
  archetypes: ArchetypeWeights;
  /** rhythm: fixed spacing between consecutive slots (>= MIN_GROUP_GAP). */
  rhythmCadence: number;
  /** cluster: max spacing between slots inside one group (<= MAX_GROUP_SPAN). */
  clusterSpread: number;
  /** Minimum spacing between groups (>= MIN_GROUP_GAP). */
  groupGap: number;
}

/**
 * Eight authored parameter sets. Design intent, mapped onto the EXISTING
 * biome identities (biomes.ts registry names / level biome ids):
 *  - grassland / forest — home biome, baseline scatter-leaning mix;
 *  - desert — flat open terrain with long sightlines: FEWER but WIDER
 *    wide-single obstacles, most breathing room between groups;
 *  - rocky — rugged: cluster-leaning, slightly denser;
 *  - dark_caves — claustrophobic: densest clusters, most spike chunks;
 *  - sky (Sky Islands) — hop rhythm: tight RHYTHM strings of narrow spikes;
 *  - lava (Volcanic) — aggressive: clusters + wide singles, denser enemies;
 *  - mixed — balanced rotation of all four archetypes (endless/mixed levels).
 */
export const BIOME_SPAWN_PROFILES: Record<
  'grassland' | 'forest' | 'desert' | 'rocky' | 'dark_caves' | 'sky' | 'lava' | 'mixed',
  BiomeSpawnProfile
> = {
  grassland: {
    id: 'grassland',
    enemyCountMult: 1.0,
    hazardCountMult: 1.0,
    spikeWidth: { min: 24, max: 36 },
    spikeChunkChance: 0.6,
    archetypes: { scatter: 0.5, cluster: 0.15, rhythm: 0.2, 'wide-single': 0.15 },
    rhythmCadence: 210,
    clusterSpread: 56,
    groupGap: 170,
  },
  forest: {
    id: 'forest',
    enemyCountMult: 1.0,
    hazardCountMult: 1.0,
    spikeWidth: { min: 24, max: 36 },
    spikeChunkChance: 0.6,
    archetypes: { scatter: 0.35, cluster: 0.25, rhythm: 0.25, 'wide-single': 0.15 },
    rhythmCadence: 190,
    clusterSpread: 60,
    groupGap: 160,
  },
  desert: {
    id: 'desert',
    enemyCountMult: 0.95,
    hazardCountMult: 0.8,
    spikeWidth: { min: 32, max: 48 },
    spikeChunkChance: 0.5,
    archetypes: { scatter: 0.25, cluster: 0.15, rhythm: 0.2, 'wide-single': 0.4 },
    rhythmCadence: 230,
    clusterSpread: 64,
    groupGap: 190,
  },
  rocky: {
    id: 'rocky',
    enemyCountMult: 1.05,
    hazardCountMult: 1.1,
    spikeWidth: { min: 24, max: 40 },
    spikeChunkChance: 0.65,
    archetypes: { scatter: 0.3, cluster: 0.35, rhythm: 0.2, 'wide-single': 0.15 },
    rhythmCadence: 180,
    clusterSpread: 64,
    groupGap: 170,
  },
  dark_caves: {
    id: 'dark_caves',
    enemyCountMult: 1.1,
    hazardCountMult: 1.15,
    spikeWidth: { min: 24, max: 36 },
    spikeChunkChance: 0.7,
    archetypes: { scatter: 0.3, cluster: 0.4, rhythm: 0.15, 'wide-single': 0.15 },
    rhythmCadence: 170,
    clusterSpread: 56,
    groupGap: 155,
  },
  sky: {
    id: 'sky',
    enemyCountMult: 0.9,
    hazardCountMult: 0.9,
    spikeWidth: { min: 24, max: 32 },
    spikeChunkChance: 0.6,
    archetypes: { scatter: 0.25, cluster: 0.15, rhythm: 0.5, 'wide-single': 0.1 },
    rhythmCadence: 160,
    clusterSpread: 56,
    groupGap: 160,
  },
  lava: {
    id: 'lava',
    enemyCountMult: 1.1,
    hazardCountMult: 1.15,
    spikeWidth: { min: 24, max: 44 },
    spikeChunkChance: 0.7,
    archetypes: { scatter: 0.25, cluster: 0.4, rhythm: 0.15, 'wide-single': 0.2 },
    rhythmCadence: 170,
    clusterSpread: 56,
    groupGap: 155,
  },
  mixed: {
    id: 'mixed',
    enemyCountMult: 1.0,
    hazardCountMult: 1.0,
    spikeWidth: { min: 24, max: 40 },
    spikeChunkChance: 0.6,
    archetypes: { scatter: 0.25, cluster: 0.25, rhythm: 0.25, 'wide-single': 0.25 },
    rhythmCadence: 180,
    clusterSpread: 60,
    groupGap: 160,
  },
};

/** Resolve the profile for a finite level's biome id. */
export function profileForLevelBiome(levelBiome: LevelBiomeId): BiomeSpawnProfile {
  switch (levelBiome) {
    case 'forest': return BIOME_SPAWN_PROFILES.forest;
    case 'desert': return BIOME_SPAWN_PROFILES.desert;
    case 'ice': return BIOME_SPAWN_PROFILES.sky;
    case 'volcano': return BIOME_SPAWN_PROFILES.lava;
    default: return BIOME_SPAWN_PROFILES.mixed;
  }
}

const BIOME_NAME_TO_PROFILE: Record<string, BiomeSpawnProfile> = {
  Grassland: BIOME_SPAWN_PROFILES.grassland,
  Forest: BIOME_SPAWN_PROFILES.forest,
  Desert: BIOME_SPAWN_PROFILES.desert,
  'Rocky Mountains': BIOME_SPAWN_PROFILES.rocky,
  'Dark Caves': BIOME_SPAWN_PROFILES.dark_caves,
  'Sky Islands': BIOME_SPAWN_PROFILES.sky,
  Volcanic: BIOME_SPAWN_PROFILES.lava,
};

/**
 * Resolve the profile from a registry biome NAME (BiomeConfig.name) so the
 * endless world's per-chunk shifting biomes each play their own pattern.
 * Unknown names fall back to the balanced `mixed` profile.
 */
export function profileForBiomeName(name: string): BiomeSpawnProfile {
  return BIOME_NAME_TO_PROFILE[name] ?? BIOME_SPAWN_PROFILES.mixed;
}

// ---------------------------------------------------------------------------
// Pattern layout generation (pure, seeded, fairness-enforced).
// ---------------------------------------------------------------------------

export interface PatternSlot {
  /** Local chunk X (0..chunkWidth). */
  x: number;
  archetype: PatternArchetype;
  /** Wide-single slots spawn the profile's widest spike window. */
  wide: boolean;
}

export interface PatternLayout {
  archetype: PatternArchetype;
  /** Obstacle groups, left to right. Slots inside one group are tight. */
  groups: PatternSlot[][];
}

export interface PatternLayoutOptions {
  /** Chunk width in pixels (default 800). */
  chunkWidth?: number;
  /** Symmetric no-spawn margin (default 50, matches legacy spawner). */
  margin?: number;
  /** Slots at x < safeZoneEnd are suppressed (chunk-0 start guard). */
  safeZoneEnd?: number;
}

type Rng = (seed: number) => number;

function pickArchetype(weights: ArchetypeWeights, roll: number): PatternArchetype {
  let acc = 0;
  acc += weights.scatter;
  if (roll < acc) return 'scatter';
  acc += weights.cluster;
  if (roll < acc) return 'cluster';
  acc += weights.rhythm;
  if (roll < acc) return 'rhythm';
  return 'wide-single';
}

/**
 * Generate one chunk's obstacle layout for a biome profile.
 *
 * Deterministic in (profile, rng, seed, options). All draws go through the
 * injected stateless rng with explicit integer seeds, mirroring how the
 * existing chunk spawners draw. Fairness floors are structural: group gaps
 * and rhythm cadence are built from Math.max(MIN_GROUP_GAP, profile values),
 * and cluster spreads are clamped so no group exceeds MAX_GROUP_SPAN.
 */
export function generatePatternLayout(
  profile: BiomeSpawnProfile,
  rng: Rng,
  seed: number,
  options?: PatternLayoutOptions,
): PatternLayout {
  const w = options?.chunkWidth ?? 800;
  const margin = options?.margin ?? 50;
  const safeEnd = options?.safeZoneEnd ?? 0;
  const lo = Math.max(margin, safeEnd);
  const hi = w - margin;
  const gap = Math.max(MIN_GROUP_GAP, profile.groupGap);
  const groups: PatternSlot[][] = [];

  const archetype = pickArchetype(profile.archetypes, rng(seed + 1));

  if (archetype === 'rhythm') {
    // Even cadence string; each slot is its own single-spike obstacle.
    const cadence = Math.max(MIN_GROUP_GAP, profile.rhythmCadence);
    let x = lo + rng(seed + 2) * cadence;
    let guard = 0;
    while (x <= hi && groups.length < MAX_GROUPS_PER_CHUNK && guard++ < 8) {
      groups.push([{ x: Math.round(x), archetype, wide: false }]);
      x += cadence;
    }
  } else if (archetype === 'cluster') {
    // 1-2 tight groups of 2-3 spikes; group span clamped to MAX_GROUP_SPAN.
    const nGroups = 1 + (rng(seed + 3) < 0.5 ? 1 : 0);
    let cursor = lo + rng(seed + 4) * 60;
    for (let g = 0; g < nGroups && groups.length < MAX_GROUPS_PER_CHUNK; g++) {
      const nSlots = 2 + (rng(seed + 5 + g * 10) < 0.45 ? 1 : 0);
      const spread = Math.min(profile.clusterSpread, MAX_GROUP_SPAN / (nSlots - 1));
      const lastX = cursor + spread * (nSlots - 1);
      if (lastX > hi) break;
      const slots: PatternSlot[] = [];
      for (let s = 0; s < nSlots; s++) {
        slots.push({ x: Math.round(cursor + spread * s), archetype, wide: false });
      }
      groups.push(slots);
      cursor = lastX + gap + rng(seed + 6 + g * 10) * 60;
    }
  } else if (archetype === 'wide-single') {
    // One wide obstacle in the readable middle band of the chunk.
    const x = lo + (hi - lo) * (0.25 + rng(seed + 7) * 0.5);
    if (x <= hi) groups.push([{ x: Math.round(x), archetype, wide: true }]);
  } else {
    // scatter: 2-3 lone slots spread at least `gap` apart.
    const n = 2 + (rng(seed + 8) < 0.6 ? 1 : 0);
    let cursor = lo + rng(seed + 9) * 60;
    for (let i = 0; i < n && groups.length < MAX_GROUPS_PER_CHUNK; i++) {
      if (cursor > hi) break;
      groups.push([{ x: Math.round(cursor), archetype, wide: false }]);
      cursor += gap + rng(seed + 10 + i * 10) * 120;
    }
  }

  // Safety net: drop any group that escaped the placement window.
  const safe = groups.filter((g) => g.every((s) => s.x >= lo && s.x <= hi));
  return { archetype, groups: safe };
}

/** Draw a spike width from the profile window; wide slots use the wide end. */
export function rollSpikeWidth(
  profile: BiomeSpawnProfile,
  rng: Rng,
  seed: number,
  wide: boolean,
): number {
  const { min, max } = profile.spikeWidth;
  const lo = wide ? Math.max(min, max - 8) : min;
  return lo + Math.floor(rng(seed) * ((max - lo) / 4 + 1)) * 4;
}
