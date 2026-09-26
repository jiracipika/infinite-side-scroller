/**
 * Particle system for atmospheric effects and gameplay feedback.
 * Handles dust, leaves, snow, sparks, plus gameplay particles:
 * jump dust, landing impact, air jumps, stomps, coin sparkle, enemy death.
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
  type: 'dust' | 'leaf' | 'snow' | 'spark' | 'jump_dust' | 'landing' | 'air_jump' | 'stomp_ring' | 'coin_sparkle' | 'enemy_death' | 'score_popup' | 'heal' | 'wall_slide';
  text?: string;
}

/**
 * Maps a landing fall speed (px/s, positive = downward) to a particle
 * intensity multiplier. Hops stay subtle, terminal-velocity falls punch.
 * Tuned so a standard jump arc (~520 px/s) lands near 1.3 and the 900 px/s
 * terminal velocity just under the 1.9 cap.
 */
export function landingIntensityFor(fallVy: number): number {
  const v = Math.max(0, fallVy);
  return Math.max(0.6, Math.min(1.9, 0.55 + v / 700));
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private maxAmbient = 100;
  private maxGameplay = 200;
  private reducedParticles = false;

  /** Per-frame reusable ambient counter — avoids allocating a filtered array on every spawn check. */
  private ambientCount = 0;

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
    // In-place compaction: shift live particles to the front, then truncate.
    // This avoids allocating a new array (via .filter) on every frame.
    const list = this.particles;
    let writeIdx = 0;
    let ambient = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Gravity for gameplay particles
      if (p.type === 'jump_dust' || p.type === 'landing' || p.type === 'enemy_death' || p.type === 'stomp_ring') {
        p.vy += 200 * dt;
      }
      if (p.type === 'score_popup') {
        p.vy = -60; // float upward
      }

      p.life -= dt;

      if (p.life > 0) {
        if (p.type === 'dust' || p.type === 'leaf' || p.type === 'snow' || p.type === 'spark') {
          ambient++;
        }
        if (writeIdx !== i) list[writeIdx] = p;
        writeIdx++;
      }
    }
    list.length = writeIdx;
    this.ambientCount = ambient;

    // Spawn ambient particles
    if (ambient < this.maxAmbient && Math.random() < 0.3) {
      this.spawnAmbient(cameraX, cameraY, screenWidth, screenHeight, biomeType);
    }
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

  /**
   * Scuff burst while wall-sliding (spun up a few times per second by the
   * engine while the slide is active). The player always faces INTO the
   * wall while sliding (facingRight=true ⇔ wall on the right), so the dust
   * originates at the wall-side edge and kicks AWAY from the wall, drifting
   * up along it.
   */
  spawnWallSlideDust(x: number, y: number, facingRight: boolean): void {
    const count = this.reducedParticles ? 3 : 6;
    // Direction away from the wall: wall on the right → dust flies left.
    const away = facingRight ? -1 : 1;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (facingRight ? 1 : -1) * (4 + Math.random() * 4),
        y: y + (Math.random() - 0.5) * 8,
        vx: away * (30 + Math.random() * 60),
        vy: -(20 + Math.random() * 50),
        life: 0.25 + Math.random() * 0.25,
        maxLife: 0.5,
        size: Math.random() * 2 + 1,
        color: '#9aa7b5',
        type: 'wall_slide',
      });
    }
  }

  /** Spawn impact when player lands. intensity 1 = normal jump arc. */
  spawnLanding(x: number, y: number, intensity: number = 1): void {
    const impact = Math.max(0.6, Math.min(1.9, intensity));
    const count = Math.round((this.reducedParticles ? 6 : 12) * impact);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = (Math.random() * 100 + 30) * impact;
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

  /**
   * Distinct burst for the mid-air (double) jump — a flat, wide ring instead
   * of ground dust, so the player can read that the air jump was spent.
   */
  spawnAirJump(x: number, y: number): void {
    // Lead stroke ring: size > 10 marks it as a radius for the renderer's
    // expanding-ring path rather than a chip.
    this.particles.push({
      x, y,
      vx: 0, vy: 0,
      life: 0.32,
      maxLife: 0.32,
      size: 24,
      color: '#7dd3fc',
      type: 'air_jump',
    });
    const count = this.reducedParticles ? 5 : 10;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      this.particles.push({
        x: x + Math.cos(angle) * 6,
        y: y + Math.sin(angle) * 3,
        vx: Math.cos(angle) * (90 + Math.random() * 40),
        vy: Math.sin(angle) * (26 + Math.random() * 18),
        life: 0.28 + Math.random() * 0.14,
        maxLife: 0.42,
        size: Math.random() * 2.4 + 1.4,
        color: '#7dd3fc',
        type: 'air_jump',
      });
    }
  }

  /** Directional puff when jumping off a wall (kicks away from the wall). */
  spawnWallJumpPuff(x: number, y: number, facingRight: boolean): void {
    const count = this.reducedParticles ? 4 : 9;
    // Same convention as spawnWallSlideDust: facingRight ⇔ wall on the right.
    const away = facingRight ? -1 : 1;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (facingRight ? 1 : -1) * (3 + Math.random() * 4),
        y: y + (Math.random() - 0.5) * 10,
        vx: away * (90 + Math.random() * 90),
        vy: -(30 + Math.random() * 60),
        life: 0.25 + Math.random() * 0.2,
        maxLife: 0.45,
        size: Math.random() * 2.6 + 1.2,
        color: '#b8c4d4',
        type: 'jump_dust',
      });
    }
  }

  /** Flat shock ring under a stomp — reads as impact, not landing. */
  spawnStompRing(x: number, y: number): void {
    // Lead stroke ring: expanding ellipse drawn by the renderer (size = radius).
    this.particles.push({
      x, y,
      vx: 0, vy: 0,
      life: 0.3,
      maxLife: 0.3,
      size: 28,
      color: '#e8d49a',
      type: 'stomp_ring',
    });
    const count = this.reducedParticles ? 6 : 12;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * i) / (count / 2) + Math.random() * 0.2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * (130 + Math.random() * 60),
        vy: -Math.abs(Math.sin(angle)) * (40 + Math.random() * 30),
        life: 0.22 + Math.random() * 0.16,
        maxLife: 0.38,
        size: Math.random() * 2.2 + 1.4,
        color: '#e8d49a',
        type: 'stomp_ring',
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

  /** Spawn a red impact burst when the player takes damage */
  spawnHitFlash(x: number, y: number): void {
    const count = this.reducedParticles ? 5 : 10;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = Math.random() * 120 + 60;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.5,
        size: Math.random() * 3 + 2,
        color: i % 2 === 0 ? '#ef4444' : '#fca5a5',
        type: 'enemy_death',
      });
    }
  }

  /** Spawn rising heal particles (used by Healer regen, healing aura, health pickups). */
  spawnHeal(x: number, y: number): void {
    const count = this.reducedParticles ? 4 : 8;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const speed = Math.random() * 40 + 20;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 18,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 0.8 + Math.random() * 0.4,
        maxLife: 1.2,
        size: Math.random() * 2 + 2,
        color: i % 2 === 0 ? '#22c55e' : '#86efac',
        type: 'heal',
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
