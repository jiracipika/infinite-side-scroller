/**
 * Object pooling system to reduce garbage collection overhead.
 * Reuses objects instead of creating/destroying them repeatedly.
 */

export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxPoolSize: number;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize = 10,
    maxPoolSize = 100
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxPoolSize = maxPoolSize;

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  /** Get an object from the pool (or create new if empty) */
  acquire(): T {
    return this.pool.length > 0 ? this.pool.pop()! : this.factory();
  }

  /** Return an object to the pool for reuse */
  release(obj: T): void {
    if (this.pool.length < this.maxPoolSize) {
      this.reset(obj);
      this.pool.push(obj);
    }
  }

  /** Clear the pool completely */
  clear(): void {
    this.pool = [];
  }

  /** Get current pool size */
  get size(): number {
    return this.pool.length;
  }
}
