/**
 * Hazards - Spikes and falling platforms
 */

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
  const startSafeZoneEnd = 760;

  // Spikes on ground (every chunk has a chance)
  if (rng(base + 200) > 0.4) {
    const spikeCount = 1 + Math.floor(rng(base + 201) * 3);
    for (let i = 0; i < spikeCount; i++) {
      const localX = rng(base + i * 30 + 202) * 700 + 50;
      if (chunkId === 0 && localX < startSafeZoneEnd) continue;
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

/** Graphic danger ink; render-only offsets never change hazard collision data. */
export function renderHazard(ctx: CanvasRenderingContext2D, h: Hazard, cameraX: number, cameraY: number = 0, reducedMotion = false) {
  if (h.destroyed) return;
  const sx = h.x - cameraX;
  const sy = h.y - cameraY;
  ctx.save();
  if (h.type === 'spike') {
    const count = Math.floor(h.width / 12);
    ctx.fillStyle = '#09080f'; ctx.strokeStyle = '#ff7166'; ctx.lineWidth = 1.4;
    for (let i = 0; i < count; i++) {
      const bx = sx + i * 12;
      ctx.beginPath(); ctx.moveTo(bx, sy + h.height); ctx.lineTo(bx + 6, sy); ctx.lineTo(bx + 12, sy + h.height); ctx.closePath(); ctx.fill(); ctx.stroke();
      // Opaque coral tips make danger readable even against the black terrain.
      ctx.fillStyle = '#ff7166'; ctx.beginPath(); ctx.moveTo(bx + 3, sy + 6); ctx.lineTo(bx + 6, sy); ctx.lineTo(bx + 9, sy + 6); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#09080f';
    }
  } else {
    const shakeX = !reducedMotion && h.crumbleTimer && !h.falling ? Math.sin(h.crumbleTimer * 65) * 1.5 : 0;
    ctx.fillStyle = '#09080f'; ctx.fillRect(sx + shakeX, sy, h.width, h.height);
    ctx.strokeStyle = '#ff7166'; ctx.lineWidth = 1.5; ctx.strokeRect(sx + shakeX, sy, h.width, h.height);
    // Warning hatch is present BEFORE activation, not only after stepping on it.
    ctx.beginPath();
    for (let x = 4; x < h.width - 5; x += 14) { ctx.moveTo(sx + x + shakeX, sy + h.height - 1); ctx.lineTo(sx + x + 5 + shakeX, sy + 1); }
    ctx.stroke();
    if (h.crumbleTimer && h.crumbleTimer > 0) {
      const cx = sx + h.width / 2 + shakeX;
      ctx.strokeStyle = '#f4f2ed'; ctx.beginPath(); ctx.moveTo(cx - 8, sy); ctx.lineTo(cx, sy + h.height / 2); ctx.lineTo(cx + 6, sy + h.height); ctx.stroke();
    }
  }
  ctx.restore();
}
