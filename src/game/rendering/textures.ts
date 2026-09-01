/**
 * Procedural ground textures — deterministic speckles, strata lines, grass
 * tufts, and platform detail work.
 *
 * All geometry derives from `textureHash`, a seeded integer hash, so the same
 * chunk index always produces the same texture. That keeps the renderer's
 * chunk cache valid and makes every client (and the automated verifiers)
 * agree on what the ground should look like. No unseeded randomness anywhere.
 */

/** Deterministic hash → [0, 1). Same inputs, same output, forever. */
export function textureHash(i: number, seed: number): number {
  let h = (i | 0) * 0x27d4eb2d + (seed | 0) * 0x165667b1;
  h = (h ^ (h >>> 15)) * 0x2c1b3c6d;
  h = (h ^ (h >>> 12)) * 0x297a2d39;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// ── Ground texture (speckles + strata) ────────────────────────────────

/** Depth (px below surface) of each stratum band, top to bottom. */
export const STRATA_DEPTHS = [18, 48, 88] as const;
/** Stroke alpha for each matching stratum band. */
export const STRATA_ALPHAS = [0.1, 0.07, 0.045] as const;

/** Column spacing for the speckle pass, high and low detail. */
export const SPECKLE_STEP = { high: 22, low: 44 } as const;

export interface GroundTextureOpts {
  /** Per-4px surface heights in world Y (chunk.heights). */
  heights: number[];
  chunkWorldX: number;
  chunkIndex: number;
  /** Local transform offset (0 when painting into the chunk cache). */
  offsetX: number;
  offsetY: number;
  /** How far below the surface to scatter texture (canvas depth budget). */
  depthPx: number;
  /** Biome ground (bright cap) color. */
  ground: string;
  /** Biome soil (dark body) color. */
  groundDark: string;
  /** True = every speckle column + pebbles; false = sparse columns only. */
  detail: boolean;
}

/**
 * Paint one chunk's ground texture onto a context that is already translated
 * so chunk-local X aligns (pass offsetX/offsetY for the live view, zeros for
 * the cache canvas). Draws strata bands, speckles, and pebbles.
 */
export function paintGroundTexture(
  ctx: CanvasRenderingContext2D,
  opts: GroundTextureOpts,
): void {
  const {
    heights,
    chunkWorldX,
    chunkIndex,
    offsetX,
    offsetY,
    depthPx,
    groundDark,
    detail,
  } = opts;

  paintStrata(ctx, heights, chunkWorldX, chunkIndex, offsetX, offsetY, groundDark);
  paintSpeckles(
    ctx,
    heights,
    chunkWorldX,
    chunkIndex,
    offsetX,
    offsetY,
    depthPx,
    groundDark,
    detail,
  );
}

/** Wavy horizontal strata bands that follow the surface at fixed depths. */
function paintStrata(
  ctx: CanvasRenderingContext2D,
  heights: number[],
  chunkWorldX: number,
  chunkIndex: number,
  offsetX: number,
  offsetY: number,
  groundDark: string,
): void {
  ctx.save();
  ctx.lineWidth = 1.4;
  for (let layer = 0; layer < STRATA_DEPTHS.length; layer++) {
    ctx.strokeStyle = groundDark; // alpha applied per segment below
    ctx.globalAlpha = STRATA_ALPHAS[layer];
    ctx.beginPath();
    const step = 48;
    for (let lx = 0; lx <= heights.length * 4; lx += step) {
      const surface = surfaceAt(heights, lx);
      const wx = chunkWorldX + lx;
      const y =
        surface +
        STRATA_DEPTHS[layer] +
        Math.sin(wx * 0.02 + layer * 2.1 + chunkIndex * 0.7) * 4;
      const sx = lx + offsetX;
      const sy = y + offsetY;
      if (lx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Deterministic speckle/pebble scatter biased toward the surface. */
function paintSpeckles(
  ctx: CanvasRenderingContext2D,
  heights: number[],
  chunkWorldX: number,
  chunkIndex: number,
  offsetX: number,
  offsetY: number,
  depthPx: number,
  groundDark: string,
  detail: boolean,
): void {
  const step = detail ? SPECKLE_STEP.high : SPECKLE_STEP.low;
  const maxDepth = Math.min(depthPx * 0.6, 120);
  ctx.save();
  for (let lx = 12, col = 0; lx < heights.length * 4; lx += step, col++) {
    const surface = surfaceAt(heights, lx);
    const wx = chunkWorldX + lx;
    const sx = lx + offsetX;

    const rolls = detail ? 2 : 1;
    for (let r = 0; r < rolls; r++) {
      const h1 = textureHash(chunkIndex * 7919 + col * 131 + r * 17, 911);
      const h2 = textureHash(chunkIndex * 104729 + col * 197 + r * 29, 419);
      const h3 = textureHash(chunkIndex * 15485863 + col * 61 + r * 41, 601);
      // Bias speckles toward the surface (quadratic falloff with depth).
      const dy = 8 + h2 * h2 * maxDepth;
      const sy = surface + dy + offsetY;
      const kind = h3;
      if (kind < 0.62) {
        // Dark dot — soil grain
        ctx.fillStyle = groundDark;
        ctx.globalAlpha = 0.16 + h1 * 0.12;
        ctx.beginPath();
        ctx.arc(sx + h1 * 8 - 4, sy, 0.8 + h1 * 0.9, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind < 0.84) {
        // Streak — decomposing root / sediment line
        ctx.strokeStyle = groundDark;
        ctx.globalAlpha = 0.13;
        ctx.lineWidth = 1;
        const w = 5 + h1 * 5;
        ctx.beginPath();
        ctx.moveTo(sx - w / 2, sy);
        ctx.lineTo(sx + w / 2, sy + (h1 - 0.5) * 3);
        ctx.stroke();
      } else if (detail) {
        // Pebble — bright stone catching light
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = groundDark;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 1.6 + h1 * 1.6, 1.1 + h2 * 1.1, h1 * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** Surface world-Y at a chunk-local X (linear interp between samples). */
export function surfaceAt(heights: number[], localX: number): number {
  const idx = localX / 4;
  const i0 = Math.max(0, Math.min(heights.length - 1, Math.floor(idx)));
  const i1 = Math.max(0, Math.min(heights.length - 1, i0 + 1));
  const t = Math.max(0, Math.min(1, idx - i0));
  return heights[i0] + (heights[i1] - heights[i0]) * t;
}

// ── Grass tufts ───────────────────────────────────────────────────────

export interface Tuft {
  /** World X of the tuft base. */
  x: number;
  /** World Y of the tuft base (on the surface). */
  y: number;
  /** Blade height in px. */
  height: number;
  /** Horizontal lean applied to blade tips (-1..1). */
  lean: number;
  /** Number of blades (2-3). */
  blades: number;
  /** Per-tuft variation for the sway phase. */
  phase: number;
}

/**
 * Generate grass tufts for a chunk: deterministic positions with minimum
 * spacing, sitting exactly on the interpolated surface.
 */
export function tuftsForChunk(
  chunkIndex: number,
  heights: number[],
  tuftChance: number,
): Tuft[] {
  const tufts: Tuft[] = [];
  const spacing = 34;
  let lastX = -Infinity;
  for (let lx = 10; lx < heights.length * 4 - 6; lx += spacing) {
    const roll = textureHash(chunkIndex * 31337 + lx, 77);
    if (roll > tuftChance) continue;
    const jitter = (textureHash(chunkIndex * 5077 + lx, 133) - 0.5) * 14;
    const x = lx + jitter;
    if (x - lastX < 22) continue;
    lastX = x;
    tufts.push({
      x,
      y: surfaceAt(heights, x),
      height: 5 + textureHash(chunkIndex * 911 + lx, 211) * 7,
      lean: textureHash(chunkIndex * 1301 + lx, 331) * 2 - 1,
      blades: 2 + Math.round(textureHash(chunkIndex * 2609 + lx, 449)),
      phase: textureHash(chunkIndex * 5801 + lx, 587) * Math.PI * 2,
    });
  }
  return tufts;
}

/**
 * Draw one tuft. `sway` animates the lean (pass gameTime-derived value);
 * blades are quadratic curves for a soft arc instead of straight sticks.
 */
export function drawTuft(
  ctx: CanvasRenderingContext2D,
  tuft: Tuft,
  color: string,
  sway: number,
  offsetX: number,
  offsetY: number,
): void {
  const baseX = tuft.x + offsetX;
  const baseY = tuft.y + offsetY;
  const lean = tuft.lean * 2.4 + sway * 1.6;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  for (let b = 0; b < tuft.blades; b++) {
    const spread = (b - (tuft.blades - 1) / 2) * 2.2;
    const tipX = baseX + spread + lean;
    const tipY = baseY - tuft.height * (1 - Math.abs(spread) * 0.08);
    ctx.beginPath();
    ctx.moveTo(baseX + spread * 0.4, baseY);
    ctx.quadraticCurveTo(baseX + spread * 0.6, baseY - tuft.height * 0.6, tipX, tipY);
    ctx.stroke();
  }
}

// ── Platform detail ───────────────────────────────────────────────────

/**
 * Floating-island underside for a platform: tapered soil keel + support
 * roots + rivet highlights. Deterministic per platform X so platforms stop
 * looking like flat candy bars.
 */
export function paintPlatformDetail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  soilColor: string,
  keelColor: string,
): void {
  const keelH = Math.min(9, Math.max(5, width * 0.08));
  ctx.save();
  // Tapered keel under the beam
  ctx.fillStyle = keelColor;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 10);
  ctx.lineTo(x + width - 3, y + 10);
  ctx.lineTo(x + width * 0.62, y + 10 + keelH);
  ctx.lineTo(x + width * 0.38, y + 10 + keelH);
  ctx.closePath();
  ctx.fill();
  // Hanging root strands at deterministic positions
  ctx.strokeStyle = keelColor;
  ctx.lineWidth = 1;
  const roots = Math.max(1, Math.floor(width / 55));
  for (let r = 0; r < roots; r++) {
    const rx = x + 10 + textureHash(Math.round(x) * 31 + r, 88) * (width - 20);
    const len = 3 + textureHash(Math.round(x) * 77 + r, 99) * 6;
    ctx.beginPath();
    ctx.moveTo(rx, y + 10 + keelH * 0.4);
    ctx.lineTo(rx + (textureHash(Math.round(x) + r, 11) - 0.5) * 2, y + 10 + keelH * 0.4 + len);
    ctx.stroke();
  }
  // Rivet highlight dots along the beam top
  ctx.fillStyle = soilColor;
  ctx.globalAlpha = 0.5;
  for (let rx = x + 8; rx < x + width - 6; rx += 26) {
    ctx.fillRect(rx, y + 2, 2, 2);
  }
  ctx.restore();
}
