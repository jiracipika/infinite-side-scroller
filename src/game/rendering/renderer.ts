/**
 * Game renderer — handles all canvas drawing.
 * Includes frustum culling and terrain caching for performance.
 */

import { Camera } from '../engine/camera';
import { Chunk, CHUNK_WIDTH } from '../world/chunk';
import { Player } from '../entities/player';
import { getCharacterById } from '../data/characters';
import { Particle } from '../entities/particles';
import { getBlendedBiomeColors } from '../world/biomes';
import type { Collectible } from '../entities/Collectibles';
import { TerrainCache } from '../engine/terrain-cache';

interface BiomeColors {
  groundDark: string;
  ground: string;
  sky: string;
}

export class GameRenderer {
  private terrainCache: TerrainCache;
  private cacheEnabled = true;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.terrainCache = new TerrainCache();
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  drawSky(camera: Camera): void {
    const centerX = camera.renderX + this.width / 2;
    const colors = getBlendedBiomeColors(centerX);

    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, colors.sky);
    gradient.addColorStop(1, colors.skyGradient);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawParallax(camera: Camera): void {
    this.drawMountains(camera, 0.1, 200, '#00000020', 350);
    this.drawMountains(camera, 0.2, 150, '#00000030', 400);
    this.drawClouds(camera);
  }

  private drawMountains(camera: Camera, parallaxFactor: number, amplitude: number, color: string, baseY: number): void {
    const offsetX = camera.renderX * parallaxFactor;
    // Background mountains are decorative — ignore camera Y so they never
    // clip when the player moves vertically (camera.renderY changes).
    // Apply only a very subtle parallax capped to ±50px for a depth feel.
    const rawOffsetY = camera.renderY * parallaxFactor * 0.3;
    const offsetY = Math.max(-50, Math.min(50, rawOffsetY));

    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.height);

    for (let screenX = 0; screenX <= this.width; screenX += 4) {
      const worldX = screenX + offsetX;
      const h = Math.sin(worldX * 0.003) * amplitude + Math.sin(worldX * 0.007) * amplitude * 0.5;
      const y = baseY - h - offsetY;
      this.ctx.lineTo(screenX, y);
    }

    this.ctx.lineTo(this.width, this.height);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawClouds(camera: Camera): void {
    const offsetX = camera.renderX * 0.05;
    this.ctx.fillStyle = '#ffffff40';

    for (let i = 0; i < 8; i++) {
      const baseX = ((i * 350 + 100) - (offsetX % 2800) + 2800) % 2800 - 200;
      const y = 50 + (i % 3) * 40;
      this.drawCloud(baseX, y, 60 + (i % 3) * 30);
    }
  }

  private drawCloud(x: number, y: number, size: number): void {
    const ctx = this.ctx;
    ctx.beginPath(); ctx.ellipse(x, y, size, size * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - size * 0.5, y + size * 0.1, size * 0.6, size * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + size * 0.4, y + size * 0.15, size * 0.5, size * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  }

  drawTerrain(chunks: Chunk[], camera: Camera): void {
    for (const chunk of chunks) {
      if (!camera.isVisible(chunk.worldX, 0, CHUNK_WIDTH + 4, this.height)) continue;

      if (this.cacheEnabled && this.terrainCache.has(chunk.index)) {
        // Draw from cache
        const cachedData = this.terrainCache.get(chunk.index);
        if (cachedData) {
          const screen = camera.worldToScreen(chunk.worldX, 0);
          this.ctx.putImageData(cachedData, screen.x, screen.y);
          continue;
        }
      }

      // Draw and cache
      this.drawChunkTerrain(chunk, camera, this.cacheEnabled);
    }
  }

  private drawChunkTerrain(chunk: Chunk, camera: Camera, shouldCache: boolean = false): void {
    const ctx = this.ctx;
    const colors = getBlendedBiomeColors(chunk.worldX + 400) as {
      groundDark: string;
      ground: string;
      sky: string;
    };

    // If caching, create an offscreen canvas
    if (shouldCache) {
      const cacheWidth = CHUNK_WIDTH + 4;
      const cacheHeight = this.height + 200;
      const offscreen = document.createElement('canvas');
      offscreen.width = cacheWidth;
      offscreen.height = cacheHeight;
      const offCtx = offscreen.getContext('2d');
      if (!offCtx) return;

      // Draw terrain to offscreen canvas
      this.drawTerrainToContext(offCtx, chunk, colors, cacheWidth, cacheHeight, 0);

      // Cache the result
      const imageData = offCtx.getImageData(0, 0, cacheWidth, cacheHeight);
      this.terrainCache.set(chunk.index, imageData);
    }

    // Draw to main canvas
    this.drawTerrainToContext(ctx, chunk, colors, this.width, this.height, camera.renderX - chunk.worldX);
  }

  private drawTerrainToContext(
    ctx: CanvasRenderingContext2D,
    chunk: Chunk,
    colors: BiomeColors,
    canvasWidth: number,
    canvasHeight: number,
    offsetX: number
  ): void {
    ctx.fillStyle = colors.groundDark;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < chunk.heights.length; i++) {
      const worldX = chunk.worldX + i * 4;
      const screenX = worldX - chunk.worldX + offsetX;
      const screenY = chunk.heights[i];
      if (!started) { ctx.moveTo(screenX, screenY); started = true; }
      else { ctx.lineTo(screenX, screenY); }
    }
    const lastScreenX = CHUNK_WIDTH + offsetX;
    ctx.lineTo(lastScreenX, canvasHeight + 10);
    ctx.lineTo(offsetX, canvasHeight + 10);
    ctx.closePath();
    ctx.fill();

    // Grass line
    ctx.strokeStyle = colors.ground;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < chunk.heights.length; i++) {
      const worldX = chunk.worldX + i * 4;
      const screenX = worldX - chunk.worldX + offsetX;
      const screenY = chunk.heights[i];
      if (i === 0) ctx.moveTo(screenX, screenY);
      else ctx.lineTo(screenX, screenY);
    }
    ctx.stroke();

    // Caves
    for (const cave of chunk.caves) {
      const caveScreenX = cave.x - chunk.worldX + offsetX;
      ctx.fillStyle = colors.sky;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(caveScreenX, cave.y, cave.width, cave.height);
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = colors.groundDark;
      ctx.lineWidth = 2;
      ctx.strokeRect(caveScreenX, cave.y, cave.width, cave.height);
    }
  }

  drawPlatforms(chunks: Chunk[], camera: Camera, gameTime: number = 0): void {
    const ctx = this.ctx;
    for (const chunk of chunks) {
      const colors = getBlendedBiomeColors(chunk.worldX + 400);
      for (const platform of chunk.platforms) {
        // Calculate moving platform Y offset
        let platY = platform.y;
        if (platform.moveAmp && platform.moveSpeed) {
          platY += Math.sin(gameTime * platform.moveSpeed) * platform.moveAmp;
        }
        const screen = camera.worldToScreen(platform.x, platY);
        if (screen.x + platform.width < 0 || screen.x > this.width) continue;
        ctx.fillStyle = colors.platform;
        ctx.fillRect(screen.x, screen.y, platform.width, 8);
        ctx.strokeStyle = colors.groundDark;
        ctx.lineWidth = 1;
        ctx.strokeRect(screen.x, screen.y, platform.width, 8);
        // Small glow for moving platforms
        if (platform.moveAmp) {
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(screen.x, screen.y - 2, platform.width, 2);
        }
      }
    }
  }

  drawDecorations(chunks: Chunk[], camera: Camera): void {
    for (const chunk of chunks) {
      for (const dec of chunk.decorations) {
        if (!camera.isVisible(dec.x - 40, dec.y - 100, 80, 100)) continue;
        this.drawDecoration(dec, camera);
      }
    }
  }

  private drawDecoration(dec: { type: string; x: number; y: number; scale: number; variant: number }, camera: Camera): void {
    const s = dec.scale;
    const screen = camera.worldToScreen(dec.x, dec.y);
    switch (dec.type) {
      case 'tree': this.drawTree(screen.x, screen.y, s, dec.variant); break;
      case 'rock': this.drawRock(screen.x, screen.y, s, dec.variant); break;
      case 'bush': this.drawBush(screen.x, screen.y, s, dec.variant); break;
    }
  }

  private drawTree(x: number, y: number, scale: number, variant: number): void {
    const ctx = this.ctx;
    const s = scale;
    ctx.fillStyle = '#5a3e1b';
    ctx.fillRect(x - 4 * s, y - 30 * s, 8 * s, 30 * s);
    const greens = ['#2d7a27', '#3a8a34', '#4a9c44'];
    ctx.fillStyle = greens[variant % greens.length];
    if (variant === 0) {
      ctx.beginPath(); ctx.arc(x, y - 40 * s, 20 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x - 8 * s, y - 35 * s, 14 * s, 0, Math.PI * 2); ctx.fill();
    } else if (variant === 1) {
      ctx.beginPath(); ctx.moveTo(x, y - 65 * s); ctx.lineTo(x - 18 * s, y - 20 * s); ctx.lineTo(x + 18 * s, y - 20 * s); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(x, y - 35 * s, 16 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 10 * s, y - 30 * s, 12 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x - 10 * s, y - 28 * s, 13 * s, 0, Math.PI * 2); ctx.fill();
    }
  }

  private drawRock(x: number, y: number, scale: number, variant: number): void {
    const ctx = this.ctx;
    const s = scale;
    ctx.fillStyle = variant === 0 ? '#8a8a8a' : '#6a6a6a';
    ctx.beginPath(); ctx.ellipse(x, y - 5 * s, 12 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.stroke();
  }

  private drawBush(x: number, y: number, scale: number, variant: number): void {
    const ctx = this.ctx;
    const s = scale;
    const greens = ['#3a7a34', '#4a8a44'];
    ctx.fillStyle = greens[variant % greens.length];
    ctx.beginPath(); ctx.arc(x, y - 6 * s, 10 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 7 * s, y - 4 * s, 7 * s, 0, Math.PI * 2); ctx.fill();
  }

  drawPlayer(player: Player, camera: Camera): void {
    const ctx = this.ctx;
    const screen = camera.worldToScreen(player.x, player.y);
    const char = getCharacterById(player.characterId);

    // Invulnerability flash — blink using timer
    if (player.invulnerable && !player.dashing) {
      // Blink: 6 blinks per second (3Hz flash)
      const blinkRate = 6;
      const t = player.invulnerableTimer * blinkRate;
      ctx.globalAlpha = Math.floor(t) % 2 === 0 ? 0.4 : 1.0;
    }
    const w = player.width;
    const h = player.height;

    // Body
    ctx.fillStyle = char.bodyColor;
    ctx.fillRect(screen.x, screen.y, w, h);

    // Eyes on the facing side
    const eyeX = player.facingRight ? screen.x + w - 12 : screen.x + 4;
    ctx.fillStyle = char.eyeColor;
    ctx.fillRect(eyeX, screen.y + 6, 4, 4);
    ctx.fillRect(eyeX + 6, screen.y + 6, 4, 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(eyeX + 2, screen.y + 8, 2, 2);
    ctx.fillRect(eyeX + 8, screen.y + 8, 2, 2);

    // Outline
    ctx.strokeStyle = char.outlineColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(screen.x, screen.y, w, h);

    // Wall slide indicator
    if (player.wallSliding) {
      ctx.fillStyle = '#ffffff60';
      const slideX = player.facingRight ? screen.x + w : screen.x - 2;
      ctx.fillRect(slideX, screen.y + 4, 2, h - 8);
    }

    ctx.globalAlpha = 1.0;
  }

  drawCollectible(c: Collectible, camera: Camera): void {
    const ctx = this.ctx;
    const screen = camera.worldToScreen(c.x, c.y);
    const bob = Math.sin(c.animTimer * 3) * 3;
    const sy = screen.y + bob;

    ctx.save();
    switch (c.type) {
      case 'coin': {
        // Gold coin
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(screen.x + c.width / 2, sy + c.height / 2, c.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(screen.x + c.width / 2, sy + c.height / 2, c.width / 3, 0, Math.PI * 2);
        ctx.fill();
        // $ symbol
        ctx.fillStyle = '#92400e';
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('$', screen.x + c.width / 2, sy + c.height / 2 + 4);
        break;
      }
      case 'health': {
        ctx.fillStyle = '#ef4444';
        ctx.font = `${c.width}px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText('♥', screen.x + c.width / 2, sy + c.height);
        break;
      }
      case 'speedBoost': {
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(screen.x + c.width / 2, sy + c.height / 2, c.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⚡', screen.x + c.width / 2, sy + c.height / 2 + 4);
        break;
      }
      case 'doubleJump': {
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(screen.x + c.width / 2, sy + c.height / 2, c.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⇈', screen.x + c.width / 2, sy + c.height / 2 + 4);
        break;
      }
      case 'shield': {
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(screen.x + c.width / 2, sy + c.height / 2, c.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('🛡', screen.x + c.width / 2, sy + c.height / 2 + 5);
        break;
      }
      case 'magnet': {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(screen.x + c.width / 2, sy + c.height / 2, c.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('🧲', screen.x + c.width / 2, sy + c.height / 2 + 5);
        break;
      }
    }
    ctx.restore();
  }

  /** Clear the terrain cache */
  clearTerrainCache(): void {
    this.terrainCache.clear();
  }

  drawParticles(particles: Particle[], camera: Camera): void {
    const ctx = this.ctx;

    for (const p of particles) {
      const screen = camera.worldToScreen(p.x, p.y);
      const alpha = Math.max(0, p.life / p.maxLife);

      // Score popups are text
      if (p.type === 'score_popup' && p.text) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.font = `bold ${p.size}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, screen.x, screen.y);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
        continue;
      }

      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = p.color;

      switch (p.type) {
        case 'leaf':
          ctx.save();
          ctx.translate(screen.x, screen.y);
          ctx.rotate(p.life * 2);
          ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
          ctx.restore();
          break;
        case 'snow':
          ctx.beginPath(); ctx.arc(screen.x, screen.y, p.size, 0, Math.PI * 2); ctx.fill();
          break;
        case 'coin_sparkle':
          ctx.beginPath(); ctx.arc(screen.x, screen.y, p.size, 0, Math.PI * 2); ctx.fill();
          // Extra glow
          ctx.globalAlpha = alpha * 0.3;
          ctx.beginPath(); ctx.arc(screen.x, screen.y, p.size * 2, 0, Math.PI * 2); ctx.fill();
          break;
        case 'enemy_death':
          ctx.fillRect(screen.x - p.size / 2, screen.y - p.size / 2, p.size, p.size);
          break;
        default:
          ctx.fillRect(screen.x, screen.y, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1.0;
  }
}
