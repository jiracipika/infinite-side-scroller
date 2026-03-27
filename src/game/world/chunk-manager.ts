/**
 * Chunk manager — handles loading/unloading chunks around the player.
 * Keeps a cache of nearby chunks and generates new ones on demand.
 */

import { Chunk, CHUNK_WIDTH } from './chunk';

/** How many chunks to keep loaded on each side of the player */
const CHUNK_RANGE = 5;

export class ChunkManager {
  private worldSeed: number;
  private chunks = new Map<number, Chunk>();

  constructor(worldSeed: number) {
    this.worldSeed = worldSeed;
  }

  /**
   * Update chunks based on player position.
   * Generates new chunks ahead, removes old ones behind.
   */
  update(playerWorldX: number): void {
    const centerChunk = Math.floor(playerWorldX / CHUNK_WIDTH);
    const minChunk = centerChunk - CHUNK_RANGE;
    const maxChunk = centerChunk + CHUNK_RANGE;

    // Generate any missing chunks in range
    for (let i = minChunk; i <= maxChunk; i++) {
      if (!this.chunks.has(i)) {
        this.chunks.set(i, new Chunk(i, this.worldSeed));
      }
    }

    // Unload chunks outside range
    for (const [idx] of Array.from(this.chunks)) {
      if (idx < minChunk - 1 || idx > maxChunk + 1) {
        this.chunks.delete(idx);
      }
    }
  }

  /** Get a chunk by index, or undefined if not loaded */
  getChunk(index: number): Chunk | undefined {
    return this.chunks.get(index);
  }

  /** Get all currently loaded chunks */
  getLoadedChunks(): Chunk[] {
    return Array.from(this.chunks.values()).sort((a, b) => a.index - b.index);
  }

  /** Get the chunk index for a world X coordinate */
  getChunkIndex(worldX: number): number {
    return Math.floor(worldX / CHUNK_WIDTH);
  }

  /** Get terrain height at any world X (loads chunk if needed) */
  getHeight(worldX: number): number {
    const idx = this.getChunkIndex(worldX);
    let chunk = this.chunks.get(idx);
    if (!chunk) {
      chunk = new Chunk(idx, this.worldSeed);
      this.chunks.set(idx, chunk);
    }
    return chunk.getHeight(worldX - chunk.worldX);
  }

  /** Get number of loaded chunks */
  get loadedCount(): number {
    return this.chunks.size;
  }
}
