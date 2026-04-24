/**
 * Combat System - Handles all interactions between player, enemies, projectiles, and collectibles
 */

import { Player } from '../entities/player';
import { Enemy, Skeleton, Boss, Projectile } from '../entities';
import { Collectible } from '../entities/Collectibles';

export interface ScoreState {
  enemiesDefeated: number;
  coinsCollected: number;
  distanceTraveled: number;
  total: number;
}

export class CombatSystem {
  private score: ScoreState = {
    enemiesDefeated: 0,
    coinsCollected: 0,
    distanceTraveled: 0,
    total: 0,
  };

  private enemies: Enemy[] = [];
  private collectibles: Collectible[] = [];
  private activeChunkIds = new Set<number>();

  /** Set current active chunks (enemies/collectibles outside these get despawned) */
  setActiveChunks(chunkIds: Set<number>) {
    this.activeChunkIds = chunkIds;
    // Despawn far entities
    this.enemies = this.enemies.filter(e => this.activeChunkIds.has(e.chunkId));
    this.collectibles = this.collectibles.filter(c => this.activeChunkIds.has(c.chunkId));
  }

  /** Add enemies from chunk generation */
  addEnemy(enemy: Enemy) {
    this.enemies.push(enemy);
  }

  /** Add collectibles from chunk generation */
  addCollectible(collectible: Collectible) {
    this.collectibles.push(collectible);
  }

  /** Get all enemies (for collision with platforms) */
  getEnemies(): Enemy[] {
    return this.enemies;
  }

  /** Get all collectibles */
  getCollectibles(): Collectible[] {
    return this.collectibles;
  }

  /** Update all entities and check collisions */
  update(dt: number, player: Player) {
    if (!player.alive) return;

    // Update enemies
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.update(dt, player.x, player.y);
    }

    // Check enemy-player collisions
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      this.checkEnemyCollision(player, enemy);
    }

    // Check projectile collisions
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const projectiles = this.getProjectiles(enemy);
      for (const proj of projectiles) {
        if (this.rectsOverlap(
          { x: proj.x, y: proj.y, width: proj.width, height: proj.height },
          player.getBounds()
        )) {
          player.takeDamage(proj.damage);
          proj.life = 0; // destroy projectile
        }
      }
    }

    // Check collectible pickups
    for (const c of this.collectibles) {
      if (c.collected) continue;
      c.animTimer += dt;
      if (this.rectsOverlap(c, player.getBounds())) {
        this.pickupCollectible(player, c);
      }
    }

    // Clean up dead enemies
    this.enemies = this.enemies.filter(e => e.alive);
    this.collectibles = this.collectibles.filter(c => !c.collected);

    // Update score
    this.score.distanceTraveled = Math.floor(player.distanceTraveled);
    this.score.total = this.score.enemiesDefeated * 50 + this.score.coinsCollected * 10 + Math.floor(this.score.distanceTraveled / 100);
  }

  /** Check collision between player and an enemy */
  private checkEnemyCollision(player: Player, enemy: Enemy) {
    if (!this.rectsOverlap(player.getBounds(), enemy.getBounds())) return;

    if (enemy.stompable && player.isStomping()) {
      // Stomp from above
      player.stompBounce();
      enemy.takeDamage(1);
      if (!enemy.alive) {
        this.score.enemiesDefeated++;
        player.score += 50;
      }
    } else {
      // Damage player
      if (player.takeDamage(enemy.damage)) {
        // Knockback
        const dir = player.x < enemy.x ? -1 : 1;
        player.vx = dir * 300;
        player.vy = -200;
      }
    }
  }

  /** Handle collectible pickup */
  private pickupCollectible(player: Player, c: Collectible) {
    c.collected = true;
    switch (c.type) {
      case 'coin':
        player.score += c.value;
        this.score.coinsCollected++;
        break;
      case 'health':
        player.heal(c.value);
        break;
      case 'speedBoost':
        player.applySpeedBoost(c.value);
        break;
      case 'doubleJump':
        player.setDoubleJump(true);
        break;
    }
  }

  /** Get projectiles from an enemy (works for Skeleton & Boss) */
  private getProjectiles(enemy: Enemy): Projectile[] {
    if (enemy instanceof Skeleton) return enemy.projectiles;
    if (enemy instanceof Boss) return enemy.projectiles;
    return [];
  }

  /** AABB overlap check */
  private rectsOverlap(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
  ): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  /** Render all enemies and collectibles */
  render(ctx: CanvasRenderingContext2D, cameraX: number) {
    // Collectibles
    for (const c of this.collectibles) {
      if (c.collected) continue;
      this.renderCollectible(ctx, c, cameraX);
    }

    // Enemies
    for (const enemy of this.enemies) {
      enemy.render(ctx, cameraX);
    }
  }

  /** Render a collectible */
  private renderCollectible(ctx: CanvasRenderingContext2D, c: Collectible, cameraX: number) {
    const sx = c.x - cameraX;
    const bob = Math.sin(c.animTimer * 3) * 3;
    const sy = c.y + bob;

    ctx.save();

    switch (c.type) {
      case 'coin':
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(sx + 8, sy + 8, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#DAA520';
        ctx.beginPath();
        ctx.arc(sx + 8, sy + 8, 4, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'health':
        ctx.fillStyle = '#FF4444';
        // Heart shape (simplified)
        ctx.fillRect(sx + 4, sy + 4, 10, 10);
        ctx.fillRect(sx + 2, sy + 6, 14, 6);
        break;

      case 'speedBoost':
        ctx.fillStyle = '#00BFFF';
        ctx.fillRect(sx + 2, sy + 6, 16, 8);
        // Lightning bolt hint
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx + 7, sy + 4, 4, 4);
        ctx.fillRect(sx + 5, sy + 8, 4, 4);
        break;

      case 'doubleJump':
        ctx.fillStyle = '#9B59B6';
        ctx.beginPath();
        ctx.moveTo(sx + 10, sy + 2);
        ctx.lineTo(sx + 18, sy + 14);
        ctx.lineTo(sx + 14, sy + 14);
        ctx.lineTo(sx + 18, sy + 22);
        ctx.lineTo(sx + 6, sy + 10);
        ctx.lineTo(sx + 10, sy + 10);
        ctx.closePath();
        ctx.fill();
        break;
    }

    ctx.restore();
  }

  /** Get current score */
  getScore(): ScoreState {
    return { ...this.score };
  }

  /** Reset combat state */
  reset() {
    this.enemies = [];
    this.collectibles = [];
    this.score = { enemiesDefeated: 0, coinsCollected: 0, distanceTraveled: 0, total: 0 };
  }
}
