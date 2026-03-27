/**
 * Chunk data structure.
 * Each chunk is a horizontal slice of the world containing terrain, platforms, decorations, and caves.
 */

import { createRng } from './rng';
import { getTerrainHeight } from './terrain';
import { getBiomeAt, BiomeConfig } from './biomes';

/** Width of each chunk in world pixels */
export const CHUNK_WIDTH = 800;

/** Block types for terrain cells */
export enum BlockType {
  Empty = 0,
  Ground = 1,
  Platform = 2,
}

/** A decoration placed in the world */
export interface Decoration {
  type: 'tree' | 'rock' | 'bush';
  x: number; // World X
  y: number; // World Y (ground surface)
  scale: number;
  variant: number; // For visual variety
}

/** A cave region (hollowed out area underground) */
export interface Cave {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A platform (one-way, jump through from below) */
export interface Platform {
  x: number;
  y: number;
  width: number;
}

/** Represents one horizontal chunk of the world */
export class Chunk {
  readonly index: number;
  readonly worldX: number; // Left edge in world coords
  readonly biome: BiomeConfig;

  /** Terrain heights at regular intervals (for rendering) */
  readonly heights: number[];

  /** Platforms in this chunk */
  readonly platforms: Platform[];

  /** Decorations in this chunk */
  readonly decorations: Decoration[];

  /** Cave regions */
  readonly caves: Cave[];

  constructor(index: number, worldSeed: number) {
    this.index = index;
    this.worldX = index * CHUNK_WIDTH;
    this.biome = getBiomeAt(this.worldX + CHUNK_WIDTH / 2);

    // Create a deterministic RNG for this chunk
    const chunkSeed = (worldSeed * 73856093) ^ (index * 19349663);
    const rng = createRng(Math.abs(chunkSeed));

    // Generate terrain heights at pixel resolution (sampled every 4px for performance)
    this.heights = [];
    for (let x = 0; x <= CHUNK_WIDTH; x += 4) {
      const worldPosX = this.worldX + x;
      this.heights.push(
        getTerrainHeight(worldPosX, worldSeed, this.biome.heightVariation, this.biome.hilliness)
      );
    }

    // Generate platforms
    this.platforms = this.generatePlatforms(rng);

    // Generate caves
    this.caves = this.generateCaves(rng);

    // Generate decorations
    this.decorations = this.generateDecorations(rng);
  }

  /** Get height at a local X offset within this chunk */
  getHeight(localX: number): number {
    const idx = Math.floor(localX / 4);
    if (idx < 0) return this.heights[0];
    if (idx >= this.heights.length - 1) return this.heights[this.heights.length - 1];
    // Interpolate between samples
    const frac = (localX / 4) - idx;
    return this.heights[idx] + (this.heights[idx + 1] - this.heights[idx]) * frac;
  }

  /** Generate platforms for this chunk */
  private generatePlatforms(rng: ReturnType<typeof createRng>): Platform[] {
    const platforms: Platform[] = [];
    if (rng.next() > this.biome.platformDensity) return platforms;

    const count = rng.nextInt(0, 3);
    for (let i = 0; i < count; i++) {
      const x = rng.nextFloat(100, CHUNK_WIDTH - 100);
      const baseHeight = this.getHeight(x);
      const y = baseHeight - rng.nextFloat(60, 160);
      const width = rng.nextFloat(60, 150);
      platforms.push({ x: this.worldX + x, y, width });
    }
    return platforms;
  }

  /** Generate cave regions */
  private generateCaves(rng: ReturnType<typeof createRng>): Cave[] {
    const caves: Cave[] = [];
    if (!rng.chance(this.biome.caveChance)) return caves;

    const count = rng.nextInt(1, 3);
    for (let i = 0; i < count; i++) {
      const x = rng.nextFloat(50, CHUNK_WIDTH - 200);
      const baseHeight = this.getHeight(x);
      const y = baseHeight + rng.nextFloat(40, 120);
      const width = rng.nextFloat(80, 200);
      const height = rng.nextFloat(40, 100);
      caves.push({ x: this.worldX + x, y, width, height });
    }
    return caves;
  }

  /** Generate decorations (trees, rocks, bushes) */
  private generateDecorations(rng: ReturnType<typeof createRng>): Decoration[] {
    const decorations: Decoration[] = [];
    const slotCount = Math.floor(CHUNK_WIDTH / 60);

    for (let i = 0; i < slotCount; i++) {
      const x = rng.nextFloat(20, CHUNK_WIDTH - 20);
      const height = this.getHeight(x);

      // Skip if inside a cave
      const inCave = this.caves.some(
        c => x + this.worldX >= c.x && x + this.worldX <= c.x + c.width
      );
      if (inCave) continue;

      const roll = rng.next();

      if (roll < this.biome.treeChance) {
        decorations.push({
          type: 'tree',
          x: this.worldX + x,
          y: height,
          scale: rng.nextFloat(0.7, 1.3),
          variant: rng.nextInt(0, 2),
        });
      } else if (roll < this.biome.treeChance + this.biome.rockChance) {
        decorations.push({
          type: 'rock',
          x: this.worldX + x,
          y: height,
          scale: rng.nextFloat(0.5, 1.2),
          variant: rng.nextInt(0, 1),
        });
      } else if (roll < this.biome.treeChance + this.biome.rockChance + this.biome.bushChance) {
        decorations.push({
          type: 'bush',
          x: this.worldX + x,
          y: height,
          scale: rng.nextFloat(0.6, 1.1),
          variant: rng.nextInt(0, 1),
        });
      }
    }

    return decorations;
  }
}
