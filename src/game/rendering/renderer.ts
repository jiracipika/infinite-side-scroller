/**
 * Game renderer — handles all canvas drawing.
 * Includes frustum culling and terrain caching for performance.
 */

import { Camera } from "../engine/camera";
import { Chunk, CHUNK_WIDTH } from "../world/chunk";
import { Player } from "../entities/player";
import { getCharacterById } from "../data/characters";
import { drawCharacterArt } from "./character-art";
import { Particle } from "../entities/particles";
import {
  getBlendedBiomeColors,
  type BiomeConfig,
  type BiomeColors,
} from "../world/biomes";
import type { Collectible } from "../entities/Collectibles";
import { TerrainCache } from "../engine/terrain-cache";
import {
  drawBackgroundSky,
  drawBackgroundParallax,
  type BackgroundDetail,
} from "./background";
import {
  paintGroundTexture,
  tuftsForChunk,
  drawTuft,
  paintPlatformDetail,
} from "./textures";
import { shadeHexColor } from "./color";

export class GameRenderer {
  private terrainCache: TerrainCache;
  private cacheEnabled = true;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  /** Visual fidelity for background + ground texture passes (engine quality). */
  private backgroundDetail: BackgroundDetail = "high";
  /** Static world override for finite levels; null = shifting endless biomes. */
  private worldBiomeOverride: BiomeConfig | null = null;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.terrainCache = new TerrainCache();
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /**
   * Set background/texture fidelity. LOW keeps terrain caching and a sparse
   * texture pass (still reads as textured, just cheaper) for weak GPUs.
   */
  setBackgroundDetail(detail: BackgroundDetail): void {
    if (this.backgroundDetail === detail) return;
    this.backgroundDetail = detail;
  }

  /** Pin the world palette (finite levels). Null restores endless blending. */
  setWorldBiomeOverride(biome: BiomeConfig | null): void {
    if (this.worldBiomeOverride === biome) return;
    this.worldBiomeOverride = biome;
  }

  /** Resolve palette for a world X, honoring the finite-level override. */
  private paletteAt(worldX: number): BiomeColors {
    return (
      this.worldBiomeOverride?.colors ?? getBlendedBiomeColors(worldX)
    );
  }

  drawSky(
    camera: Camera,
    gameTime: number = 0,
    biomeOverride?: BiomeConfig | null,
  ): void {
    drawBackgroundSky(this.ctx, {
      width: this.width,
      height: this.height,
      cameraX: camera.x,
      cameraY: camera.y,
      gameTime,
      colors: biomeOverride?.colors ?? getBlendedBiomeColors(camera.x + this.width / 2),
      detail: this.backgroundDetail,
      reducedMotion: camera.isReducedMotion(),
    });
  }

  drawParallax(
    camera: Camera,
    gameTime: number = 0,
    biomeOverride?: BiomeConfig | null,
  ): void {
    drawBackgroundParallax(this.ctx, {
      width: this.width,
      height: this.height,
      cameraX: camera.x,
      cameraY: camera.y,
      gameTime,
      colors: biomeOverride?.colors ?? getBlendedBiomeColors(camera.x + this.width / 2),
      detail: this.backgroundDetail,
      reducedMotion: camera.isReducedMotion(),
    });
  }

  drawTerrain(
    chunks: Chunk[],
    camera: Camera,
    gameTime: number = 0,
    reducedMotion: boolean = false,
  ): void {
    this.liveGameTime = gameTime;
    this.liveReducedMotion = reducedMotion;
    for (const chunk of chunks) {
      if (!camera.isVisible(chunk.worldX, 0, CHUNK_WIDTH + 4, this.height))
        continue;

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

  private drawChunkTerrain(
    chunk: Chunk,
    camera: Camera,
    shouldCache: boolean = false,
  ): void {
    const ctx = this.ctx;

    // If caching, create an offscreen canvas
    if (shouldCache) {
      const cacheWidth = CHUNK_WIDTH + 4;
      const cacheHeight = this.height + 200;
      const offscreen = document.createElement("canvas");
      offscreen.width = cacheWidth;
      offscreen.height = cacheHeight;
      const offCtx = offscreen.getContext("2d");
      if (!offCtx) return;

      // Draw terrain to offscreen canvas — isCacheContext=true keeps the
      // animated tuft pass out of the frozen cache image.
      this.drawTerrainToContext(offCtx, chunk, cacheWidth, cacheHeight, 0, 0, true);

      // Cache the transparent canvas itself; drawImage preserves destination sky.
      this.terrainCache.set(chunk.index, offscreen);
    }

    // Draw to main canvas — live context gets gameTime/reducedMotion so the
    // grass tufts can sway; the baked cache canvas never animates.
    this.drawTerrainToContext(
      ctx,
      chunk,
      this.width,
      this.height,
      chunk.worldX - camera.renderX,
      -camera.renderY,
      false,
      this.liveGameTime,
      this.liveReducedMotion,
    );
  }

  /**
   * Per-frame animation inputs for the live terrain pass. Set at the top of
   * drawTerrain; defaults keep the signature backward compatible.
   */
  private liveGameTime = 0;
  private liveReducedMotion = false;

  private drawTerrainToContext(
    ctx: CanvasRenderingContext2D,
    chunk: Chunk,
    canvasWidth: number,
    canvasHeight: number,
    offsetX: number,
    offsetY: number,
    isCacheContext: boolean = false,
    gameTime: number = 0,
    reducedMotion: boolean = false,
  ): void {
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < chunk.heights.length; i++) {
      const worldX = chunk.worldX + i * 4;
      const screenX = worldX - chunk.worldX + offsetX;
      const screenY = chunk.heights[i] + offsetY;
      if (!started) {
        ctx.moveTo(screenX, screenY);
        started = true;
      } else {
        ctx.lineTo(screenX, screenY);
      }
    }
    const lastScreenX = CHUNK_WIDTH + offsetX;
    ctx.lineTo(lastScreenX, canvasHeight + 10);
    ctx.lineTo(offsetX, canvasHeight + 10);
    ctx.closePath();

    ctx.save();
    ctx.clip();
    // Biome-tinted soil body. A single vertical gradient is enough now that
    // texture depth comes from the dedicated passes below; short world-space
    // strips still keep chunk/biome boundaries from becoming vertical walls.
    const stripWidth = 90;
    for (let localX = 0; localX <= CHUNK_WIDTH; localX += stripWidth) {
      const worldX = chunk.worldX + localX;
      const stripColors = this.paletteAt(worldX);
      const soilGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
      soilGradient.addColorStop(
        0,
        shadeHexColor(stripColors.groundDark, 12),
      );
      soilGradient.addColorStop(0.45, stripColors.groundDark);
      soilGradient.addColorStop(
        1,
        shadeHexColor(stripColors.groundDark, -35),
      );
      ctx.fillStyle = soilGradient;
      ctx.fillRect(localX + offsetX - 1, 0, stripWidth + 2, canvasHeight + 10);
    }

    // Deterministic texture passes: strata bands, speckles, pebbles.
    paintGroundTexture(ctx, {
      heights: chunk.heights,
      chunkWorldX: chunk.worldX,
      chunkIndex: chunk.index,
      offsetX,
      offsetY,
      depthPx: canvasHeight,
      ground: this.paletteAt(chunk.worldX + CHUNK_WIDTH / 2).ground,
      groundDark: this.paletteAt(chunk.worldX + CHUNK_WIDTH / 2).groundDark,
      detail: this.backgroundDetail === "high",
    });
    ctx.restore();

    // Grass cap and highlight (thicker, layered for a readable ledge).
    ctx.lineWidth = 7;
    for (let i = 0; i < chunk.heights.length - 1; i++) {
      const worldX = chunk.worldX + i * 4;
      const capColors = this.paletteAt(worldX);
      ctx.strokeStyle = shadeHexColor(capColors.ground, -15);
      ctx.beginPath();
      ctx.moveTo(i * 4 + offsetX, chunk.heights[i] + offsetY);
      ctx.lineTo((i + 1) * 4 + offsetX, chunk.heights[i + 1] + offsetY);
      ctx.stroke();
    }

    ctx.lineWidth = 3;
    for (let i = 0; i < chunk.heights.length - 1; i++) {
      const worldX = chunk.worldX + i * 4;
      const capColors = this.paletteAt(worldX);
      ctx.strokeStyle = shadeHexColor(capColors.ground, 24);
      const screenX = i * 4 + offsetX;
      const screenY = chunk.heights[i] - 1 + offsetY;
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo((i + 1) * 4 + offsetX, chunk.heights[i + 1] - 1 + offsetY);
      ctx.stroke();
    }

    // Live view only: animated grass tufts riding the surface. (Cached chunk
    // canvases are static, so tufts would freeze mid-sway if baked in.)
    if (!isCacheContext && this.backgroundDetail === "high") {
      const capColors = this.paletteAt(chunk.worldX + CHUNK_WIDTH / 2);
      const tufts = tuftsForChunk(
        chunk.index,
        chunk.heights,
        Math.min(0.85, 0.3 + capColors.ground.length * 0.05),
      );
      const sway = reducedMotion
        ? 0
        : Math.sin(gameTime * 2.1) * 0.9;
      for (const tuft of tufts) {
        const sx = tuft.x + offsetX;
        if (sx < -10 || sx > canvasWidth + 10) continue;
        drawTuft(ctx, tuft, shadeHexColor(capColors.ground, -8), sway, offsetX, offsetY);
      }
    }

    // Caves
    for (const cave of chunk.caves) {
      const caveScreenX = cave.x - chunk.worldX + offsetX;
      const caveColors = this.paletteAt(cave.x);
      ctx.fillStyle = caveColors.sky;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(caveScreenX, cave.y + offsetY, cave.width, cave.height);
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = caveColors.groundDark;
      ctx.lineWidth = 2;
      ctx.strokeRect(caveScreenX, cave.y + offsetY, cave.width, cave.height);
    }
  }

  drawPlatforms(chunks: Chunk[], camera: Camera, gameTime: number = 0): void {
    const ctx = this.ctx;
    for (const chunk of chunks) {
      const colors = this.paletteAt(chunk.worldX + 400);
      for (const platform of chunk.platforms) {
        // Calculate moving platform Y offset
        let platY = platform.y;
        if (platform.moveAmp && platform.moveSpeed) {
          platY += Math.sin(gameTime * platform.moveSpeed) * platform.moveAmp;
        }
        const screen = camera.worldToScreen(platform.x, platY);
        if (screen.x + platform.width < 0 || screen.x > this.width) continue;
        const beamGradient = ctx.createLinearGradient(
          0,
          screen.y,
          0,
          screen.y + 10,
        );
        beamGradient.addColorStop(0, shadeHexColor(colors.platform, 18));
        beamGradient.addColorStop(1, shadeHexColor(colors.platform, -22));
        ctx.fillStyle = beamGradient;
        ctx.fillRect(screen.x, screen.y, platform.width, 10);
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(
          screen.x + 2,
          screen.y + 1,
          Math.max(0, platform.width - 4),
          2,
        );
        // Soil-tinted top edge ties the beam to the ground below it.
        ctx.fillStyle = shadeHexColor(colors.groundDark, 6);
        ctx.fillRect(screen.x, screen.y, platform.width, 2);
        ctx.strokeStyle = shadeHexColor(colors.groundDark, -20);
        ctx.lineWidth = 1;
        ctx.strokeRect(screen.x, screen.y, platform.width, 10);
        // Floating-island underside: tapered keel, root strands, rivets.
        paintPlatformDetail(
          ctx,
          screen.x,
          screen.y,
          platform.width,
          colors.groundDark,
          shadeHexColor(colors.groundDark, -28),
        );
        // Small glow for moving platforms
        if (platform.moveAmp) {
          ctx.fillStyle = "rgba(255,255,255,0.08)";
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

  private drawDecoration(
    dec: { type: string; x: number; y: number; scale: number; variant: number },
    camera: Camera,
  ): void {
    const s = dec.scale;
    const screen = camera.worldToScreen(dec.x, dec.y);
    switch (dec.type) {
      case "tree":
        this.drawTree(screen.x, screen.y, s, dec.variant);
        break;
      case "rock":
        this.drawRock(screen.x, screen.y, s, dec.variant);
        break;
      case "bush":
        this.drawBush(screen.x, screen.y, s, dec.variant);
        break;
    }
  }

  private drawTree(x: number, y: number, scale: number, variant: number): void {
    const ctx = this.ctx;
    const s = scale;
    ctx.fillStyle = "#5a3e1b";
    ctx.fillRect(x - 4 * s, y - 30 * s, 8 * s, 30 * s);
    const greens = ["#2d7a27", "#3a8a34", "#4a9c44"];
    ctx.fillStyle = greens[variant % greens.length];
    if (variant === 0) {
      ctx.beginPath();
      ctx.arc(x, y - 40 * s, 20 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - 8 * s, y - 35 * s, 14 * s, 0, Math.PI * 2);
      ctx.fill();
    } else if (variant === 1) {
      ctx.beginPath();
      ctx.moveTo(x, y - 65 * s);
      ctx.lineTo(x - 18 * s, y - 20 * s);
      ctx.lineTo(x + 18 * s, y - 20 * s);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x, y - 35 * s, 16 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 10 * s, y - 30 * s, 12 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - 10 * s, y - 28 * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawRock(x: number, y: number, scale: number, variant: number): void {
    const ctx = this.ctx;
    const s = scale;
    ctx.fillStyle = variant === 0 ? "#8a8a8a" : "#6a6a6a";
    ctx.beginPath();
    ctx.ellipse(x, y - 5 * s, 12 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawBush(x: number, y: number, scale: number, variant: number): void {
    const ctx = this.ctx;
    const s = scale;
    const greens = ["#3a7a34", "#4a8a44"];
    ctx.fillStyle = greens[variant % greens.length];
    ctx.beginPath();
    ctx.arc(x, y - 6 * s, 10 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 7 * s, y - 4 * s, 7 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  drawPlayer(player: Player, camera: Camera): void {
    const ctx = this.ctx;
    const screen = camera.worldToScreen(player.x, player.y);
    const char = getCharacterById(player.characterId);
    const w = player.width;
    const h = player.height;
    const moving = Math.abs(player.vx) > 30;
    const stride = Math.sin(player.distanceTraveled * 0.22) * (moving ? 2.4 : 0.35);
    const bob = player.onGround ? Math.abs(stride) * 0.18 : -1.5;
    const sy = screen.y + bob;

    ctx.save();
    if (player.invulnerable && !player.dashing) {
      const t = player.invulnerableTimer * 6;
      ctx.globalAlpha = Math.floor(t) % 2 === 0 ? 0.45 : 1;
    }

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(screen.x + w / 2, sy + h + 4, w * 0.43, h * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(screen.x + w / 2, sy);
    ctx.scale(player.facingRight ? 1 : -1, 1);
    ctx.translate(-w / 2, 0);
    drawCharacterArt(ctx, char, w, h, {
      stride,
      airborne: !player.onGround,
      dashing: player.dashing,
      melee: player.meleeActive ? player.meleeProgress : 0,
      // Double-jump tumble FX: fully suppressed under reduced motion, same
      // gate as the magnet/speed FX. Local-player flourish only — the wire
      // snapshot (NetPlayerSnapshot) carries no pose field, so the remote
      // sprite stays neutral rather than guessing a tumble it can't sync.
      tumble: camera.isReducedMotion() ? 0 : player.airbornePose,
    });

    if (player.wallSliding) {
      // Contact sparkle: a shimmer of chips at the wall-side edge while the
      // slide is actively scrubbing. Phase is keyed to screen.y — during a
      // slide the player descends, so y always advances even when vx is
      // clamped to 0 (vx-derived clocks freeze against a wall). No RNG:
      // deterministic for any client rendering the same state.
      const t = screen.y;
      const side = player.facingRight ? 1 : -1;
      const chips = 3;
      for (let i = 0; i < chips; i++) {
        const phase = (t / 14 + i / chips) % 1;
        const cy = h - 6 - phase * 9;
        const cx = w / 2 + side * (w / 2 + 1 + Math.sin(phase * Math.PI) * 2);
        ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.8;
        ctx.fillStyle = i === 0 ? "#fef08a" : "#fbbf24";
        ctx.fillRect(Math.round(cx) - 1, Math.round(cy), 2, 2);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawCollectible(c: Collectible, camera: Camera): void {
    const ctx = this.ctx;
    const screen = camera.worldToScreen(c.x, c.y);
    const bob =
      c.type === "portal"
        ? Math.sin(c.animTimer * 2) * 1.5
        : Math.sin(c.animTimer * 3) * 3;
    const sy = screen.y + bob;
    const cx = screen.x + c.width / 2;
    const cy = sy + c.height / 2;
    const radius = c.width / 2;

    ctx.save();
    switch (c.type) {
      case "coin": {
        this.drawCollectibleOrb(cx, cy, radius, "#fde68a", "#f59e0b");
        ctx.strokeStyle = "#7c2d12";
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
      case "health": {
        this.drawCollectibleOrb(cx, cy, radius, "#fca5a5", "#dc2626");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(cx - 1.5, cy - 5, 3, 10);
        ctx.fillRect(cx - 5, cy - 1.5, 10, 3);
        break;
      }
      case "speedBoost": {
        this.drawCollectibleOrb(cx, cy, radius, "#93c5fd", "#2563eb");
        ctx.fillStyle = "#eff6ff";
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
      case "doubleJump": {
        this.drawCollectibleOrb(cx, cy, radius, "#d8b4fe", "#9333ea");
        ctx.strokeStyle = "#faf5ff";
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
      case "shield": {
        this.drawCollectibleOrb(cx, cy, radius, "#67e8f9", "#0891b2");
        ctx.fillStyle = "#ecfeff";
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
      case "magnet": {
        this.drawCollectibleOrb(cx, cy, radius, "#fdba74", "#ea580c");
        ctx.strokeStyle = "#fff7ed";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy - 1, 4, Math.PI * 0.15, Math.PI * 0.85, true);
        ctx.stroke();
        ctx.fillStyle = "#dc2626";
        ctx.fillRect(cx - 6, cy + 1, 4, 3);
        ctx.fillStyle = "#2563eb";
        ctx.fillRect(cx + 2, cy + 1, 4, 3);
        break;
      }
      case "slingshot": {
        this.drawCollectibleOrb(cx, cy, radius, "#fed7aa", "#d97706");
        ctx.strokeStyle = "#7c2d12";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 4, cy + 5);
        ctx.quadraticCurveTo(cx - 7, cy - 1, cx - 2, cy - 6);
        ctx.moveTo(cx + 4, cy + 5);
        ctx.quadraticCurveTo(cx + 7, cy - 1, cx + 2, cy - 6);
        ctx.stroke();
        ctx.strokeStyle = "#fef3c7";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy - 6);
        ctx.lineTo(cx + 2, cy - 6);
        ctx.stroke();
        break;
      }
      case "bow": {
        this.drawCollectibleOrb(cx, cy, radius, "#fde047", "#ca8a04");
        ctx.strokeStyle = "#78350f";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(cx - 1, cy, 5.5, Math.PI * 1.55, Math.PI * 0.45);
        ctx.stroke();
        ctx.strokeStyle = "#fefce8";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx + 3.8, cy - 5);
        ctx.lineTo(cx + 3.8, cy + 5);
        ctx.stroke();
        ctx.fillStyle = "#1f2937";
        ctx.fillRect(cx + 0.8, cy - 1, 6, 2);
        break;
      }
      case "healingAura": {
        this.drawCollectibleOrb(cx, cy, radius, "#99f6e4", "#0f766e");
        ctx.strokeStyle = "#ecfeff";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case "portal": {
        const pipeW = c.width;
        const pipeH = c.height;
        const px = screen.x;
        const py = sy;
        ctx.fillStyle = "#14532d";
        this.drawRoundedRect(ctx, px, py + 7, pipeW, pipeH - 7, 6);
        ctx.fill();
        ctx.fillStyle = "#22c55e";
        this.drawRoundedRect(ctx, px - 3, py, pipeW + 6, 10, 5);
        ctx.fill();
        ctx.strokeStyle = "#052e16";
        ctx.lineWidth = 1.5;
        this.drawRoundedRect(ctx, px - 3, py, pipeW + 6, 10, 5);
        ctx.stroke();
        ctx.fillStyle = "rgba(2,6,23,0.6)";
        this.drawRoundedRect(ctx, px + 5, py + 4, pipeW - 10, 6, 3);
        ctx.fill();
        ctx.fillStyle = "rgba(34,197,94,0.15)";
        ctx.fillRect(px + 2, py + 12, pipeW - 4, pipeH - 14);
        break;
      }
    }
    ctx.restore();
  }

  private drawCollectibleOrb(
    cx: number,
    cy: number,
    radius: number,
    glowColor: string,
    baseColor: string,
  ): void {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(
      cx - radius * 0.35,
      cy - radius * 0.4,
      1,
      cx,
      cy,
      radius,
    );
    grad.addColorStop(0, glowColor);
    grad.addColorStop(1, baseColor);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(15,23,42,0.45)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.arc(
      cx - radius * 0.35,
      cy - radius * 0.35,
      radius * 0.32,
      0,
      Math.PI * 2,
    );
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
      if (p.type === "score_popup" && p.text) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.font = `bold ${p.size}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(p.text, screen.x, screen.y);
        ctx.textAlign = "left";
        ctx.globalAlpha = 1;
        continue;
      }

      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = p.color;

      switch (p.type) {
        case "leaf":
          ctx.save();
          ctx.translate(screen.x, screen.y);
          ctx.rotate(p.life * 2);
          ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
          ctx.restore();
          break;
        case "snow":
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "coin_sparkle":
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          // Extra glow
          ctx.globalAlpha = alpha * 0.3;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, p.size * 2, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "enemy_death":
          ctx.fillRect(
            screen.x - p.size / 2,
            screen.y - p.size / 2,
            p.size,
            p.size,
          );
          break;
        case "heal":
          // soft green glow that shrinks as it rises
          ctx.globalAlpha = alpha * 0.4;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, p.size * 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha * 0.85;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "wall_slide":
          // Scuff chips: slightly tilted squares read as scraped-off grit
          // rather than generic dust (tilt is a pure function of life).
          ctx.save();
          ctx.translate(screen.x, screen.y);
          ctx.rotate((p.maxLife - p.life) * 9 * (p.vx >= 0 ? 1 : -1));
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
          break;
        default:
          ctx.fillRect(screen.x, screen.y, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1.0;
  }
}
