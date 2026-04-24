/**
 * Hazards - Spikes and falling platforms
 */

import type { Chunk } from '../world/chunk';

/** Interpolate terrain height from heights array at an arbitrary localX */
function getInterpolatedHeight(heights: number[], localX: number): number {
  const idx = Math.floor(localX / 4);
  if (idx < 0) return heights[0];
  if (idx >= heights.length - 1) return heights[heights.length - 1];
  const frac = (localX / 4) - idx;
  return heights[idx] + (heights[idx + 1] - heights[idx]) * frac;
}

export interface Hazard {
  type: 'spike' | 'falling_platform';
  x: number;
  y: number;
  width: number;
  height: number;
  chunkId: number;
  /** For falling platforms: timer since player stepped on it */
  crumbleTimer?: number;
  /** For falling platforms: has it started falling? */
  falling?: boolean;
  /** For falling platforms: fall velocity */
  vy?: number;
  /** For falling platforms: has it been destroyed? */
  destroyed?: boolean;
  /** Original Y for falling platforms */
  originalY?: number;
}

/** Spawn hazards for a chunk */
export function spawnHazardsForChunk(
  chunkId: number,
  platforms: { x: number; y: number; width: number }[],
  heights: number[],
  chunkWorldX: number,
  rng: (seed: number) => number
): Hazard[] {
  const hazards: Hazard[] = [];
  const base = chunkId * 9999;

  // Spikes on ground (every chunk has a chance)
  if (rng(base + 200) > 0.4) {
    const spikeCount = 1 + Math.floor(rng(base + 201) * 3);
    for (let i = 0; i < spikeCount; i++) {
      const localX = rng(base + i * 30 + 202) * 700 + 50;
      const groundY = getInterpolatedHeight(heights, localX);
      hazards.push({
        type: 'spike',
        x: chunkWorldX + localX,
        y: groundY - 12,
        width: 24 + Math.floor(rng(base + i * 30 + 203) * 3) * 8,
        height: 12,
        chunkId,
      });
    }
  }

  // Falling platforms (replace some regular platforms)
  for (let i = 0; i < platforms.length; i++) {
    if (rng(base + i * 50 + 300) > 0.65) {
      hazards.push({
        type: 'falling_platform',
        x: platforms[i].x,
        y: platforms[i].y,
        width: platforms[i].width,
        height: 8,
        chunkId,
        crumbleTimer: 0,
        falling: false,
        vy: 0,
        destroyed: false,
        originalY: platforms[i].y,
      });
    }
  }

  return hazards;
}

/** Render a hazard */
export function renderHazard(ctx: CanvasRenderingContext2D, h: Hazard, cameraX: number) {
  const sx = h.x - cameraX;
  const sy = h.y;

  if (h.destroyed) return;

  ctx.save();

  if (h.type === 'spike') {
    // Carved obsidian spikes
    const count = Math.floor(h.width / 12);
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    for (let i = 0; i < count; i++) {
      const bx = sx + i * 12;
      ctx.beginPath();
      ctx.moveTo(bx, sy + h.height);
      ctx.lineTo(bx + 6, sy);
      ctx.lineTo(bx + 12, sy + h.height);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Inner edge glow
    ctx.fillStyle = 'rgba(148,163,184,0.65)';
    for (let i = 0; i < count; i++) {
      const bx = sx + i * 12;
      ctx.beginPath();
      ctx.moveTo(bx + 3, sy + h.height);
      ctx.lineTo(bx + 6, sy + 3);
      ctx.lineTo(bx + 6, sy + h.height);
      ctx.closePath();
      ctx.fill();
    }
  } else if (h.type === 'falling_platform') {
    // Crumbling platform with warning cracks
    const shakeX = h.crumbleTimer && h.crumbleTimer > 0 && !h.falling
      ? (Math.random() - 0.5) * 2 : 0;
    const alpha = h.crumbleTimer && h.crumbleTimer > 0.4 ? 0.6 : 1.0;
    ctx.globalAlpha = alpha;
    const grad = ctx.createLinearGradient(sx, sy, sx, sy + h.height);
    grad.addColorStop(0, '#7c3f1d');
    grad.addColorStop(1, '#4a2714');
    ctx.fillStyle = grad;
    ctx.fillRect(sx + shakeX, sy, h.width, h.height);
    ctx.strokeStyle = '#2a1409';
    ctx.strokeRect(sx + shakeX, sy, h.width, h.height);
    // Crack lines when crumbling
    if (h.crumbleTimer && h.crumbleTimer > 0) {
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 1;
      const cx = sx + h.width / 2 + shakeX;
      ctx.beginPath();
      ctx.moveTo(cx - 8, sy + 2);
      ctx.lineTo(cx, sy + h.height / 2);
      ctx.lineTo(cx + 6, sy + h.height - 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}
