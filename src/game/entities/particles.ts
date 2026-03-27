/**
 * Particle system for atmospheric effects and gameplay feedback.
 * Handles dust, leaves, snow, sparks, plus gameplay particles:
 * jump dust, landing impact, coin sparkle, enemy death.
 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'dust' | 'leaf' | 'snow' | 'spark' | 'jump_dust' | 'landing' | 'coin_sparkle' | 'enemy_death' | 'score_popup';
  text?: string;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private maxAmbient = 100;
  private maxGameplay = 200;
  private reducedParticles = false;

  setReducedParticles(v: boolean): void {
    this.reducedParticles = v;
    this.maxAmbient = v ? 30 : 100;
    this.maxGameplay = v ? 60 : 200;
  }

  update(
    cameraX: number,
    cameraY: number,
    screenWidth: number,
    screenHeight: number,
    biomeType: string,
    dt: number
  ): void {
    const ambientCount = this.particles.filter(p =>
      p.type !== 'jump_dust' && p.type !== 'landing' && p.type !== 'coin_sparkle' &&
      p.type !== 'enemy_death' && p.type !== 'score_popup'
    ).length;

    // Spawn ambient particles
    if (ambientCount < this.maxAmbient && Math.random() < 0.3) {
      this.spawnAmbient(cameraX, cameraY, screenWidth, screenHeight, biomeType);
    }

    // Update
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Gravity for gameplay particles
      if (p.type === 'jump_dust' || p.type === 'landing' || p.type === 'enemy_death') {
        p.vy += 200 * dt;
      }
      if (p.type === 'score_popup') {
        p.vy = -60; // float upward
      }

      p.life -= dt;
    }

    this.particles = this.particles.filter(p => p.life > 0);
  }

  private spawnAmbient(cx: number, cy: number, sw: number, sh: number, biome: string): void {
    const x = cx + Math.random() * sw;
    const y = cy + Math.random() * sh;
    let p: Particle;

    switch (biome) {
      case 'forest':
        p = { x, y: y - 20, vx: Math.random() * 30 - 10, vy: Math.random() * 20 + 10, life: Math.random() * 3 + 2, maxLife: 5, size: Math.random() * 3 + 2, color: '#4a7c3f', type: 'leaf' };
        break;
      case 'desert':
        p = { x: cx - 10, y, vx: Math.random() * 60 + 30, vy: Math.random() * 20 - 10, life: Math.random() * 2 + 1, maxLife: 3, size: Math.random() * 2 + 1, color: '#d4a853', type: 'dust' };
        break;
      case 'dark_caves':
        p = { x, y, vx: Math.random() * 10 - 5, vy: Math.random() * 10 - 5, life: Math.random() * 1.5 + 0.5, maxLife: 2, size: Math.random() * 2 + 1, color: '#8888ff', type: 'spark' };
        break;
      default:
        p = { x, y, vx: Math.random() * 20 - 10, vy: Math.random() * 5, life: Math.random() * 3 + 2, maxLife: 5, size: Math.random() * 2 + 0.5, color: '#ffffff44', type: 'dust' };
    }
    this.particles.push(p);
  }

  /** Spawn dust when player jumps */
  spawnJumpDust(x: number, y: number): void {
    const count = this.reducedParticles ? 4 : 8;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y,
        vx: (Math.random() - 0.5) * 80,
        vy: -Math.random() * 40 - 10,
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.5,
        size: Math.random() * 3 + 1,
        color: '#c4a96a',
        type: 'jump_dust',
      });
    }
  }

  /** Spawn impact when player lands */
  spawnLanding(x: number, y: number): void {
    const count = this.reducedParticles ? 6 : 12;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = Math.random() * 100 + 30;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed * (Math.random() + 0.5),
        vy: -Math.abs(Math.sin(angle) * speed),
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.5,
        size: Math.random() * 3 + 1,
        color: '#c4a96a',
        type: 'landing',
      });
    }
  }

  /** Spawn sparkle when coin collected */
  spawnCoinSparkle(x: number, y: number): void {
    const count = this.reducedParticles ? 4 : 8;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * (Math.random() * 60 + 30),
        vy: Math.sin(angle) * (Math.random() * 60 + 30),
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        size: Math.random() * 2 + 1,
        color: i % 2 === 0 ? '#fbbf24' : '#fde68a',
        type: 'coin_sparkle',
      });
    }
  }

  /** Spawn death particles when enemy dies */
  spawnEnemyDeath(x: number, y: number, color: string = '#ef4444'): void {
    const count = this.reducedParticles ? 6 : 12;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 150,
        vy: -Math.random() * 120 - 40,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        size: Math.random() * 4 + 2,
        color,
        type: 'enemy_death',
      });
    }
  }

  /** Spawn floating score popup */
  spawnScorePopup(x: number, y: number, text: string, color: string = '#fbbf24'): void {
    this.particles.push({
      x, y,
      vx: 0,
      vy: -50,
      life: 1.0,
      maxLife: 1.0,
      size: 12,
      color,
      type: 'score_popup',
      text,
    });
  }

  getParticles(): Particle[] { return this.particles; }

  clear(): void { this.particles = []; }
}
