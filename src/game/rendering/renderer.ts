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

    this.ctx.fillStyle = 'rgba(255,255,255,0.08)';
    this.ctx.fillRect(0, Math.max(0, this.height * 0.52), this.width, this.height * 0.48);
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
        const cachedCanvas = this.terrainCache.get(chunk.index);
        if (cachedCanvas) {
          const screen = camera.worldToScreen(chunk.worldX, 0);
          this.ctx.drawImage(cachedCanvas, screen.x, screen.y);
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

      // Cache the transparent canvas itself; drawImage preserves destination sky.
      this.terrainCache.set(chunk.index, offscreen);
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
    const soilGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    soilGradient.addColorStop(0, this.shadeHexColor(colors.groundDark, 10));
    soilGradient.addColorStop(0.45, colors.groundDark);
    soilGradient.addColorStop(1, this.shadeHexColor(colors.groundDark, -35));
    ctx.fillStyle = soilGradient;
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

    // Layered ground texture. Deterministic math keeps cached chunks stable.
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = this.shadeHexColor(colors.groundDark, -22);
    ctx.lineWidth = 1;
    for (let i = 8; i < chunk.heights.length; i += 14) {
      const localX = i * 4;
      const worldX = chunk.worldX + localX;
      const screenX = localX + offsetX;
      const surfaceY = chunk.heights[i];
      const fleckY = surfaceY + 22 + ((Math.sin((worldX + chunk.index * 37) * 0.047) + 1) * 34);
      const fleckW = 8 + ((i + chunk.index) % 5) * 3;
      ctx.beginPath();
      ctx.moveTo(screenX, fleckY);
      ctx.lineTo(screenX + fleckW, fleckY + Math.sin(worldX * 0.03) * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Grass cap and highlight
    ctx.strokeStyle = this.shadeHexColor(colors.ground, -15);
    ctx.lineWidth = 7;
    ctx.beginPath();
    for (let i = 0; i < chunk.heights.length; i++) {
      const worldX = chunk.worldX + i * 4;
      const screenX = worldX - chunk.worldX + offsetX;
      const screenY = chunk.heights[i];
      if (i === 0) ctx.moveTo(screenX, screenY);
      else ctx.lineTo(screenX, screenY);
    }
    ctx.stroke();

    ctx.strokeStyle = this.shadeHexColor(colors.ground, 24);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < chunk.heights.length; i++) {
      const screenX = i * 4 + offsetX;
      const screenY = chunk.heights[i] - 1;
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
        const beamGradient = ctx.createLinearGradient(0, screen.y, 0, screen.y + 10);
        beamGradient.addColorStop(0, this.shadeHexColor(colors.platform, 18));
        beamGradient.addColorStop(1, this.shadeHexColor(colors.platform, -22));
        ctx.fillStyle = beamGradient;
        ctx.fillRect(screen.x, screen.y, platform.width, 10);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(screen.x + 2, screen.y + 1, Math.max(0, platform.width - 4), 2);
        ctx.strokeStyle = this.shadeHexColor(colors.groundDark, -20);
        ctx.lineWidth = 1;
        ctx.strokeRect(screen.x, screen.y, platform.width, 10);
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

  private shadeHexColor(hex: string, amount: number): string {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return hex;
    const clamp = (value: number) => Math.max(0, Math.min(255, value));
    const r = clamp(parseInt(clean.slice(0, 2), 16) + amount);
    const g = clamp(parseInt(clean.slice(2, 4), 16) + amount);
    const b = clamp(parseInt(clean.slice(4, 6), 16) + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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
    const w = player.width;
    const h = player.height;
    const moving = Math.abs(player.vx) > 30;
    const stride = Math.sin(player.distanceTraveled * 0.22) * (moving ? 2.6 : 0.8);
    const bob = player.onGround ? Math.abs(stride) * 0.22 : -1.5;
    const sy = screen.y + bob;

    ctx.save();
    if (player.invulnerable && !player.dashing) {
      const blinkRate = 6;
      const t = player.invulnerableTimer * blinkRate;
      ctx.globalAlpha = Math.floor(t) % 2 === 0 ? 0.42 : 1.0;
    }

    // Grounded shadow
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.beginPath();
    ctx.ellipse(screen.x + w / 2, sy + h + 4, w * 0.42, h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(screen.x + w / 2, sy + h / 2);
    ctx.scale(player.facingRight ? 1 : -1, 1);
    ctx.translate(-w / 2, -h / 2);

    // Legs
    ctx.fillStyle = char.outlineColor;
    ctx.fillRect(4, h - 10, 5, 10 + stride);
    ctx.fillRect(w - 9, h - 10, 5, 10 - stride);
    ctx.fillStyle = '#131721';
    ctx.fillRect(3, h - 2, 7, 2);
    ctx.fillRect(w - 10, h - 2, 7, 2);

    // Torso
    const torso = ctx.createLinearGradient(0, 0, 0, h);
    torso.addColorStop(0, char.bodyColor);
    torso.addColorStop(1, char.outlineColor);
    ctx.fillStyle = torso;
    ctx.fillRect(1, 4, w - 2, h - 8);

    // Chest plate / trim
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(4, 8, w - 8, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(4, 15, w - 8, 2);

    // Head / visor
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(3, 4, w - 6, 10);
    ctx.fillStyle = char.eyeColor;
    ctx.fillRect(w - 12, 7, 3, 3);
    ctx.fillRect(w - 7, 7, 3, 3);
    ctx.fillStyle = '#020617';
    ctx.fillRect(w - 11, 8, 1, 1);
    ctx.fillRect(w - 6, 8, 1, 1);

    // Cape / trail ribbon
    ctx.fillStyle = 'rgba(244,114,182,0.45)';
    ctx.beginPath();
    ctx.moveTo(2, 11);
    ctx.lineTo(-5 - Math.max(0, stride), 16);
    ctx.lineTo(2, 21);
    ctx.closePath();
    ctx.fill();

    // Dash accent
    if (player.dashing) {
      ctx.fillStyle = 'rgba(125,211,252,0.42)';
      ctx.fillRect(-8, 8, 8, h - 12);
    }

    // Outline and wall-slide sparks
    ctx.strokeStyle = char.outlineColor;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(1, 4, w - 2, h - 8);
    if (player.wallSliding) {
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(w + 1, h - 9, 2, 2);
      ctx.fillRect(w + 3, h - 5, 2, 2);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawCollectible(c: Collectible, camera: Camera): void {
    const ctx = this.ctx;
    const screen = camera.worldToScreen(c.x, c.y);
    const bob = Math.sin(c.animTimer * 3) * 3;
    const sy = screen.y + bob;
    const cx = screen.x + c.width / 2;
    const cy = sy + c.height / 2;
    const radius = c.width / 2;

    ctx.save();
    switch (c.type) {
      case 'coin': {
        this.drawCollectibleOrb(cx, cy, radius, '#fde68a', '#f59e0b');
        ctx.strokeStyle = '#7c2d12';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.52, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy - 4);
        ctx.lineTo(cx + 2, cy - 4);
        ctx.lineTo(cx - 2, cy + 4);
        ctx.lineTo(cx + 2, cy + 4);
        ctx.stroke();
        break;
      }
      case 'health': {
        this.drawCollectibleOrb(cx, cy, radius, '#fca5a5', '#dc2626');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 1.5, cy - 5, 3, 10);
        ctx.fillRect(cx - 5, cy - 1.5, 10, 3);
        break;
      }
      case 'speedBoost': {
        this.drawCollectibleOrb(cx, cy, radius, '#93c5fd', '#2563eb');
        ctx.fillStyle = '#eff6ff';
        ctx.beginPath();
        ctx.moveTo(cx + 1, cy - 6);
        ctx.lineTo(cx - 3, cy - 1);
        ctx.lineTo(cx + 0.5, cy - 1);
        ctx.lineTo(cx - 1, cy + 6);
        ctx.lineTo(cx + 4, cy);
        ctx.lineTo(cx + 1, cy);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'doubleJump': {
        this.drawCollectibleOrb(cx, cy, radius, '#d8b4fe', '#9333ea');
        ctx.strokeStyle = '#faf5ff';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy + 3);
        ctx.lineTo(cx - 1.5, cy - 2);
        ctx.lineTo(cx + 2, cy + 3);
        ctx.moveTo(cx - 2, cy + 5);
        ctx.lineTo(cx + 1.5, cy);
        ctx.lineTo(cx + 5, cy + 5);
        ctx.stroke();
        break;
      }
      case 'shield': {
        this.drawCollectibleOrb(cx, cy, radius, '#67e8f9', '#0891b2');
        ctx.fillStyle = '#ecfeff';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 6);
        ctx.lineTo(cx + 5, cy - 3);
        ctx.lineTo(cx + 4, cy + 4);
        ctx.lineTo(cx, cy + 7);
        ctx.lineTo(cx - 4, cy + 4);
        ctx.lineTo(cx - 5, cy - 3);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'magnet': {
        this.drawCollectibleOrb(cx, cy, radius, '#fdba74', '#ea580c');
        ctx.strokeStyle = '#fff7ed';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy - 1, 4, Math.PI * 0.15, Math.PI * 0.85, true);
        ctx.stroke();
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(cx - 6, cy + 1, 4, 3);
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(cx + 2, cy + 1, 4, 3);
        break;
      }
    }
    ctx.restore();
  }

  private drawCollectibleOrb(cx: number, cy: number, radius: number, glowColor: string, baseColor: string): void {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.4, 1, cx, cy, radius);
    grad.addColorStop(0, glowColor);
    grad.addColorStop(1, baseColor);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(15,23,42,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.arc(cx - radius * 0.35, cy - radius * 0.35, radius * 0.32, 0, Math.PI * 2);
    ctx.fill();
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
