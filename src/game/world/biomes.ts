/**
 * Biome types and their visual properties.
 * Each biome defines colors, features, and decoration probabilities.
 */

export enum BiomeType {
  Grassland = 'grassland',
  Forest = 'forest',
  Desert = 'desert',
  Rocky = 'rocky',
  DarkCaves = 'dark_caves',
  Sky = 'sky',
  Lava = 'lava',
}

/** Player-facing finite-level biome IDs. */
export type LevelBiomeId = 'forest' | 'desert' | 'ice' | 'volcano' | 'mixed';

export interface BiomeColors {
  ground: string;
  groundDark: string;
  sky: string;
  skyGradient: string;
  platform: string;
}

export interface BiomeConfig {
  type: BiomeType;
  name: string;
  colors: BiomeColors;
  /** Probability of placing a tree per decoration slot */
  treeChance: number;
  /** Probability of placing a rock per decoration slot */
  rockChance: number;
  /** Probability of placing a bush per decoration slot */
  bushChance: number;
  /** Base terrain height variation (pixels) */
  heightVariation: number;
  /** How hilly the terrain is */
  hilliness: number;
  /** Chance of a cave section */
  caveChance: number;
  /** Platform density (0-1) */
  platformDensity: number;
}

export const BIOMES: Record<BiomeType, BiomeConfig> = {
  [BiomeType.Grassland]: {
    type: BiomeType.Grassland,
    name: 'Grassland',
    colors: {
      ground: '#a9f25b',
      groundDark: '#0f2d1a',
      sky: '#0a0a0f',
      skyGradient: '#1c1c2e',
      platform: '#c7ff4d',
    },
    treeChance: 0.15,
    rockChance: 0.1,
    bushChance: 0.2,
    heightVariation: 60,
    hilliness: 0.3,
    caveChance: 0.02,
    platformDensity: 0.1,
  },
  [BiomeType.Forest]: {
    type: BiomeType.Forest,
    name: 'Forest',
    colors: {
      ground: '#8be65a',
      groundDark: '#0b2415',
      sky: '#0a0a0f',
      skyGradient: '#20203a',
      platform: '#c7ff4d',
    },
    treeChance: 0.6,
    rockChance: 0.05,
    bushChance: 0.4,
    heightVariation: 80,
    hilliness: 0.5,
    caveChance: 0.05,
    platformDensity: 0.05,
  },
  [BiomeType.Desert]: {
    type: BiomeType.Desert,
    name: 'Desert',
    colors: {
      ground: '#ffd166',
      groundDark: '#3d1f2e',
      sky: '#0a0a0f',
      skyGradient: '#26203c',
      platform: '#c7ff4d',
    },
    treeChance: 0.02,
    rockChance: 0.15,
    bushChance: 0.05,
    heightVariation: 30,
    hilliness: 0.15,
    caveChance: 0.08,
    platformDensity: 0.15,
  },
  [BiomeType.Rocky]: {
    type: BiomeType.Rocky,
    name: 'Rocky Mountains',
    colors: {
      ground: '#a08cff',
      groundDark: '#191631',
      sky: '#0a0a0f',
      skyGradient: '#20203a',
      platform: '#c7ff4d',
    },
    treeChance: 0.03,
    rockChance: 0.3,
    bushChance: 0.02,
    heightVariation: 150,
    hilliness: 0.8,
    caveChance: 0.12,
    platformDensity: 0.08,
  },
  [BiomeType.DarkCaves]: {
    type: BiomeType.DarkCaves,
    name: 'Dark Caves',
    colors: {
      ground: '#9570ff',
      groundDark: '#120a26',
      sky: '#050308',
      skyGradient: '#181030',
      platform: '#c7ff4d',
    },
    treeChance: 0.0,
    rockChance: 0.2,
    bushChance: 0.0,
    heightVariation: 40,
    hilliness: 0.2,
    caveChance: 0.3,
    platformDensity: 0.12,
  },
  [BiomeType.Sky]: {
    type: BiomeType.Sky,
    name: 'Sky Islands',
    colors: {
      ground: '#b8c7ff',
      groundDark: '#1d2440',
      sky: '#0a0a0f',
      skyGradient: '#23233f',
      platform: '#c7ff4d',
    },
    treeChance: 0.0,
    rockChance: 0.0,
    bushChance: 0.0,
    heightVariation: 200,
    hilliness: 0.1,
    caveChance: 0.0,
    platformDensity: 0.9,
  },
  [BiomeType.Lava]: {
    type: BiomeType.Lava,
    name: 'Volcanic',
    colors: {
      ground: '#ff7166',
      groundDark: '#2b0a18',
      sky: '#0a0a0f',
      skyGradient: '#2a1226',
      platform: '#ffb000',
    },
    treeChance: 0.0,
    rockChance: 0.25,
    bushChance: 0.0,
    heightVariation: 50,
    hilliness: 0.3,
    caveChance: 0.1,
    platformDensity: 0.2,
  },
};

/**
 * Translate finite-level IDs into the canonical terrain/rendering palette.
 * `mixed` intentionally returns null so those levels retain the shifting
 * endless-world sequence.
 */
const LEVEL_BIOME_TYPES: Record<Exclude<LevelBiomeId, 'mixed'>, BiomeType> = {
  forest: BiomeType.Forest,
  desert: BiomeType.Desert,
  ice: BiomeType.Sky,
  volcano: BiomeType.Lava,
};

export function getLevelBiome(levelBiome: LevelBiomeId): BiomeConfig | null {
  if (levelBiome === 'mixed') return null;
  return BIOMES[LEVEL_BIOME_TYPES[levelBiome]];
}

/**
 * Biome sequence — the order biomes appear as you explore.
 */
const BIOME_ORDER: BiomeType[] = [
  BiomeType.Grassland,
  BiomeType.Forest,
  BiomeType.Desert,
  BiomeType.Rocky,
  BiomeType.Sky,
  BiomeType.Forest,
  BiomeType.Lava,
  BiomeType.DarkCaves,
  BiomeType.Sky,
  BiomeType.Desert,
  BiomeType.Rocky,
  BiomeType.Grassland,
  BiomeType.Lava,
];

/** Width of a biome region in world pixels */
const BIOME_WIDTH = 8000;

/**
 * Get the biome at a given world X position.
 * Biomes cycle through BIOME_ORDER, each lasting BIOME_WIDTH pixels.
 * Returns the blended config (smooth transitions at edges).
 */
export function getBiomeAt(worldX: number): BiomeConfig {
  const idx = Math.floor(worldX / BIOME_WIDTH);
  const biomeType = BIOME_ORDER[((idx % BIOME_ORDER.length) + BIOME_ORDER.length) % BIOME_ORDER.length];
  return BIOMES[biomeType];
}

/**
 * Get blended biome colors at a position (for smooth transitions).
 */
export function getBlendedBiomeColors(worldX: number): BiomeColors {
  const current = getBiomeAt(worldX);
  const nextX = worldX + 200; // Look ahead for blending
  const next = getBiomeAt(nextX);

  // If same biome, no blending needed
  if (current.type === next.type) return current.colors;

  // Blend factor based on proximity to biome boundary
  const biomeStart = Math.floor(worldX / BIOME_WIDTH) * BIOME_WIDTH;
  const distFromStart = worldX - biomeStart;
  const transitionZone = 600; // pixels of blending
  let blend = 0;

  if (distFromStart > BIOME_WIDTH - transitionZone) {
    blend = (distFromStart - (BIOME_WIDTH - transitionZone)) / transitionZone;
    blend = Math.max(0, Math.min(1, blend));
  }

  return blendColors(current.colors, next.colors, blend);
}

/** Linearly interpolate between two color strings */
function blendColors(a: BiomeColors, b: BiomeColors, t: number): BiomeColors {
  return {
    ground: lerpColor(a.ground, b.ground, t),
    groundDark: lerpColor(a.groundDark, b.groundDark, t),
    sky: lerpColor(a.sky, b.sky, t),
    skyGradient: lerpColor(a.skyGradient, b.skyGradient, t),
    platform: lerpColor(a.platform, b.platform, t),
  };
}

/** Interpolate between two hex colors */
function lerpColor(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
