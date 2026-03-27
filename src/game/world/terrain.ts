/**
 * Terrain height calculation using layered sine waves.
 * Produces smooth, natural-looking terrain from a world X coordinate.
 */

/**
 * Simple 1D noise using sine-based hash.
 * Not true Perlin noise, but good enough for smooth terrain.
 */
function noise1D(x: number, seed: number): number {
  // Combine multiple sine waves for pseudo-random appearance
  const n = Math.sin(x * 12.9898 + seed * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Smooth noise — interpolates between noise samples for smooth curves.
 */
function smoothNoise(x: number, seed: number): number {
  const ix = Math.floor(x);
  const fx = x - ix;
  // Smoothstep for nice interpolation
  const t = fx * fx * (3 - 2 * fx);

  const a = noise1D(ix, seed);
  const b = noise1D(ix + 1, seed);
  return a + (b - a) * t;
}

/**
 * Get terrain height at a given world X position.
 * Returns the Y coordinate of the ground surface (lower Y = higher on screen).
 *
 * @param worldX - World X coordinate
 * @param seed - World seed for deterministic generation
 * @param biomeHeightVariation - How much the terrain can vary (from biome config)
 * @param biomeHilliness - How hilly the terrain is (0-1, from biome config)
 * @returns Ground surface Y coordinate
 */
export function getTerrainHeight(
  worldX: number,
  seed: number,
  biomeHeightVariation: number = 60,
  biomeHilliness: number = 0.3
): number {
  const BASE_HEIGHT = 400; // Default ground Y (from top of canvas)

  // Layer 1: Large rolling hills
  const largeHill = smoothNoise(worldX * 0.002, seed + 1) * biomeHeightVariation * biomeHilliness;

  // Layer 2: Medium bumps
  const mediumBump = smoothNoise(worldX * 0.008, seed + 2) * biomeHeightVariation * 0.4 * biomeHilliness;

  // Layer 3: Small surface detail
  const smallDetail = smoothNoise(worldX * 0.02, seed + 3) * biomeHeightVariation * 0.15 * biomeHilliness;

  // Combine layers (subtract because lower Y = higher terrain)
  return BASE_HEIGHT - largeHill - mediumBump - smallDetail;
}

/**
 * Get underground depth — whether a position is inside solid ground.
 * Used for caves.
 */
export function isUnderground(worldX: number, worldY: number, seed: number): boolean {
  const surfaceY = getTerrainHeight(worldX, seed);
  return worldY > surfaceY;
}
