/**
 * Terrain caching system.
 * Caches static terrain renders as transparent canvases to avoid redrawing every frame.
 */

export class TerrainCache {
  private cache = new Map<number, HTMLCanvasElement>();
  private readonly CACHE_SIZE_LIMIT = 20; // Max cached chunks

  /** Get cached terrain data for a chunk, or null if not cached */
  get(chunkIndex: number): HTMLCanvasElement | null {
    return this.cache.get(chunkIndex) ?? null;
  }

  /** Store terrain data in cache */
  set(chunkIndex: number, canvas: HTMLCanvasElement): void {
    // Evict oldest if over limit (simple FIFO)
    if (this.cache.size >= this.CACHE_SIZE_LIMIT) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(chunkIndex, canvas);
  }

  /** Check if a chunk is cached */
  has(chunkIndex: number): boolean {
    return this.cache.has(chunkIndex);
  }

  /** Clear all cached terrain data */
  clear(): void {
    this.cache.clear();
  }

  /** Remove specific chunk from cache */
  delete(chunkIndex: number): void {
    this.cache.delete(chunkIndex);
  }

  /** Get current cache size */
  get size(): number {
    return this.cache.size as number;
  }
}
