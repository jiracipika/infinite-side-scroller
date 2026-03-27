/**
 * Particle system for atmospheric effects.
 * Handles dust, leaves, snow, etc. based on biome.
 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // Remaining life in seconds
  maxLife: number;
  size: number;
  color: string;
  type: 'dust' | 'leaf' | 'snow' | 'spark';
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private maxParticles = 100;

  /**
   * Spawn particles based on the current biome.
   * @param cameraX - Camera left edge (world coords)
   * @param cameraY - Camera top edge (world coords)
   * @param screenWidth - Screen width in pixels
   * @param screenHeight - Screen height in pixels
   * @param biomeType - Current biome type
   * @param dt - Delta time
   */
  update(
    cameraX: number,
    cameraY: number,
    screenWidth: number,
    screenHeight: number,
    biomeType: string,
    dt: number
  ): void {
    // Spawn new particles
    if (this.particles.length < this.maxParticles && Math.random() < 0.3) {
      this.spawnParticle(cameraX, cameraY, screenWidth, screenHeight, biomeType);
    }

    // Update existing particles
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }

    // Remove dead particles
    this.particles = this.particles.filter(p => p.life > 0);
  }

  private spawnParticle(
    cameraX: number,
    cameraY: number,
    screenWidth: number,
    screenHeight: number,
    biomeType: string
  ): void {
    const x = cameraX + Math.random() * screenWidth;
    const y = cameraY + Math.random() * screenHeight;

    let particle: Particle;

    switch (biomeType) {
      case 'forest':
        particle = {
          x, y: y - 20,
          vx: Math.random() * 30 - 10,
          vy: Math.random() * 20 + 10,
          life: Math.random() * 3 + 2,
          maxLife: 5,
          size: Math.random() * 3 + 2,
          color: '#4a7c3f',
          type: 'leaf',
        };
        break;
      case 'desert':
        particle = {
          x: cameraX - 10, y,
          vx: Math.random() * 60 + 30,
          vy: Math.random() * 20 - 10,
          life: Math.random() * 2 + 1,
          maxLife: 3,
          size: Math.random() * 2 + 1,
          color: '#d4a853',
          type: 'dust',
        };
        break;
      case 'dark_caves':
        particle = {
          x, y,
          vx: Math.random() * 10 - 5,
          vy: Math.random() * 10 - 5,
          life: Math.random() * 1.5 + 0.5,
          maxLife: 2,
          size: Math.random() * 2 + 1,
          color: '#8888ff',
          type: 'spark',
        };
        break;
      default:
        particle = {
          x, y,
          vx: Math.random() * 20 - 10,
          vy: Math.random() * 5,
          life: Math.random() * 3 + 2,
          maxLife: 5,
          size: Math.random() * 2 + 0.5,
          color: '#ffffff44',
          type: 'dust',
        };
    }

    this.particles.push(particle);
  }

  /** Get all particles for rendering */
  getParticles(): Particle[] {
    return this.particles;
  }

  /** Clear all particles */
  clear(): void {
    this.particles = [];
  }
}
