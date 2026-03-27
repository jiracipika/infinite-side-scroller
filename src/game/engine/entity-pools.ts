/**
 * Entity pools for reusing game objects.
 * Reduces GC pressure by pooling enemies, collectibles, and particles.
 */

import { ObjectPool } from './object-pool';
import { Particle } from '../entities/particles';
import type { Collectible } from '../entities/Collectibles';

/** Reset a particle to default values */
const resetParticle = (p: Particle): Particle => {
  p.x = 0;
  p.y = 0;
  p.vx = 0;
  p.vy = 0;
  p.life = 0;
  p.maxLife = 0;
  p.size = 0;
  p.color = '#fff';
  p.type = 'dust';
  p.text = undefined;
  return p;
};

/** Reset a collectible */
const resetCollectible = (c: Collectible): Collectible => {
  c.x = 0;
  c.y = 0;
  c.width = 0;
  c.height = 0;
  c.type = 'coin';
  c.value = 1;
  c.collected = false;
  c.animTimer = 0;
  c.chunkId = 0;
  return c;
};

export class EntityPools {
  particlePool: ObjectPool<Particle>;
  collectiblePool: ObjectPool<Collectible>;

  constructor() {
    // Particle pool - pre-warm with 50 particles
    this.particlePool = new ObjectPool<Particle>(
      () => ({
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 0,
        size: 0,
        color: '#fff',
        type: 'dust',
      }),
      resetParticle,
      50,
      300
    );

    // Collectible pool - pre-warm with 20 collectibles
    this.collectiblePool = new ObjectPool<Collectible>(
      () => ({
        x: 0, y: 0, width: 20, height: 20,
        type: 'coin',
        value: 1,
        collected: false,
        animTimer: 0,
        chunkId: 0,
      }),
      resetCollectible,
      20,
      100
    );
  }

  /** Acquire a particle from pool */
  acquireParticle(): Particle {
    return this.particlePool.acquire();
  }

  /** Return a particle to pool */
  releaseParticle(p: Particle): void {
    this.particlePool.release(p);
  }

  /** Acquire a collectible from pool */
  acquireCollectible(): Collectible {
    return this.collectiblePool.acquire();
  }

  /** Return a collectible to pool */
  releaseCollectible(c: Collectible): void {
    this.collectiblePool.release(c);
  }

  /** Clear all pools */
  clear(): void {
    this.particlePool.clear();
    this.collectiblePool.clear();
  }

  /** Get pool stats for debugging */
  getStats(): { particles: number; collectibles: number } {
    return {
      particles: this.particlePool.size,
      collectibles: this.collectiblePool.size,
    };
  }
}
