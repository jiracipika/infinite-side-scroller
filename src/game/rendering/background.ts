/**
 * Layered world background — sky, celestial bodies, stars, ridged parallax
 * mountains, chromatic streams, and world-anchored clouds.
 *
 * Replaces the old two-layer sine mountains + flat gradient sky with a deep,
 * biome-tinted backdrop:
 *
 *   - 3-stop sky gradient that darkens toward the horizon at night
 *   - deterministic star field that fades in/out with the day/night cycle
 *   - sun (day) / moon (night) traveling a real arc across the sky
 *   - 3 mountain ridge layers with aerial perspective + snow caps
 *   - thin "chromatic streams" (the Dashverse neon signature) behind peaks
 *   - world-anchored drifting clouds tinted by biome + time of day
 *
 * Everything is deterministic (seeded hashes + sines) so the
 * renderer's chunk caching stays stable and multiplayer clients see identical
 * skies for the same seed and clock. No nondeterministic sources anywhere.
 */

import { DAY_CYCLE_SECONDS } from "../engine/day-cycle";
import type { BiomeColors } from "../world/biomes";
import { blendHex, hexToRgba } from "./color";
import { textureHash } from "./textures";
import { paintIndustrialCity } from "./ink-city";

/** Renderer fidelity tier — mirrors the engine's adaptive quality level. */
export type BackgroundDetail = "low" | "high";

export interface BackgroundRenderOpts {
  width: number;
  height: number;
  cameraX: number;
  cameraY: number;
  gameTime: number;
  colors: BiomeColors;
  detail: BackgroundDetail;
  reducedMotion: boolean;
}

export interface SkyCycle {
  /** Position in the day/night cycle, 0..1 (matches day-cycle keyframes). */
  phase: number;
  /** 0 = full day, 1 = deep night. Drives stars + horizon darkening. */
  nightness: number;
}

/**
 * Resolve the sky state for a game time. Phase boundaries mirror the
 * keyframes in `engine/day-cycle.ts` so the star field fades exactly when
 * the night tint rises (dawn ≈ 0.075–0.2, dusk ≈ 0.575–0.7).
 */
export function getSkyCycle(gameTime: number): SkyCycle {
  const phase =
    (((gameTime % DAY_CYCLE_SECONDS) + DAY_CYCLE_SECONDS) % DAY_CYCLE_SECONDS) /
    DAY_CYCLE_SECONDS;
  let nightness: number;
  if (phase <= 0.075) {
    nightness = 1;
  } else if (phase <= 0.2) {
    // dawn → day fade-out
    nightness = 1 - (phase - 0.075) / 0.125;
  } else if (phase <= 0.575) {
    nightness = 0;
  } else if (phase <= 0.7) {
    // dusk → night fade-in
    nightness = (phase - 0.575) / 0.125;
  } else {
    nightness = 1;
  }
  return { phase, nightness };
}

/** True modulo (JS `%` keeps the sign of the dividend). */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Ridged mountain height at a world X. Sum of three octaves of sine with a
 * crest-sharpening power curve on positive values (peaks point, valleys stay
 * round). Deterministic per (x, seed).
 */
export function ridgeHeightAt(
  worldX: number,
  seed: number,
  amplitude: number,
): number {
  const base =
    Math.sin(worldX * 0.0011 + seed) * 0.55 +
    Math.sin(worldX * 0.0027 + seed * 1.73 + 1.3) * 0.27 +
    Math.sin(worldX * 0.0061 + seed * 2.41 + 2.1) * 0.18;
  const shaped = base > 0 ? Math.pow(base, 0.82) : base;
  return shaped * amplitude;
}

// ── Sky ────────────────────────────────────────────────────────────────

const STAR_TINTS = ["#ffffff", "#cfe2ff", "#ffe9c9"] as const;
const STAR_FIELD: ReadonlyArray<{
  fx: number;
  fy: number;
  size: number;
  phase: number;
  bright: boolean;
}> = buildStarField();

function buildStarField() {
  const stars: Array<{
    fx: number;
    fy: number;
    size: number;
    phase: number;
    bright: boolean;
  }> = [];
  for (let i = 0; i < 46; i++) {
    stars.push({
      fx: textureHash(i * 13 + 1, 917),
      fy: textureHash(i * 29 + 5, 433) * 0.62,
      size: 0.6 + textureHash(i * 7 + 3, 251) * 1.1,
      phase: textureHash(i * 11 + 2, 77) * Math.PI * 2,
      bright: i % 11 === 0,
    });
  }
  return stars;
}

/**
 * Paint the sky: gradient, stars, sun/moon, and the world-anchored haze.
 * Must be called before the parallax painter.
 */
export function drawBackgroundSky(
  ctx: CanvasRenderingContext2D,
  opts: BackgroundRenderOpts,
): void {
  const { width, height, cameraY, gameTime, colors, detail, reducedMotion } =
    opts;
  const { phase, nightness } = getSkyCycle(gameTime);

  // Horizon shifts toward the dark zenith color at night so the bright
  // biome gradient doesn't glow through the night tint.
  const zenith = blendHex("#28113e", "#301348", nightness * 0.55);
  const horizon = blendHex("#68308b", "#743599", nightness * 0.52);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, zenith);
  gradient.addColorStop(0.55, blendHex(zenith, horizon, 0.5));
  gradient.addColorStop(1, horizon);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.fillStyle = "#51256e";
  const printStep = detail === "high" ? 36 : 72;
  for (let y = 8; y < height * 0.7; y += printStep) {
    for (let x = 8; x < width; x += printStep) {
      const h = textureHash(x + y * 31, 117);
      ctx.fillRect(x + h * 9, y, 1 + h * 2, 1);
    }
  }
  ctx.strokeStyle = "#51256e";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 22; i++) {
    const x = textureHash(i, 93) * width;
    const y = textureHash(i, 94) * height * 0.65;
    ctx.moveTo(x, y); ctx.lineTo(x + 16 + textureHash(i, 95) * 80, y - 9);
  }
  ctx.stroke(); ctx.restore();

  const { sunAlpha, moonAlpha } = resolveCelestialAlphas(gameTime);
  if (nightness > 0.02) {
    drawStars(ctx, width, height, cameraY, gameTime, nightness, detail, reducedMotion);
  }
  if (moonAlpha > 0.004) {
    // One dominant celestial shape; no side-by-side sun and moon in dawn frames.
    if (moonAlpha >= sunAlpha)
    drawMoon(ctx, width, height, phase, moonAlpha);
  }
  if (sunAlpha > 0.004) {
    if (sunAlpha > moonAlpha)
    drawSun(ctx, width, height, phase, colors.platform, sunAlpha);
  }

  // World-anchored atmospheric haze so it doesn't look like a screen filter
  // attached to the player/camera movement (kept from the old renderer).
  const hazeStartY = 250 - cameraY;
  const hazeEndY = 780 - cameraY;
  const hazeGradient = ctx.createLinearGradient(0, hazeStartY, 0, hazeEndY);
  hazeGradient.addColorStop(0, hexToRgba(horizon, 0));
  hazeGradient.addColorStop(1, hexToRgba(horizon, 0.09));
  ctx.fillStyle = hazeGradient;
  ctx.fillRect(0, 0, width, height);
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cameraY: number,
  gameTime: number,
  nightness: number,
  detail: BackgroundDetail,
  reducedMotion: boolean,
): void {
  const count = detail === "high" ? STAR_FIELD.length : 18;
  const twoScreens = Math.max(width * 2, 800);
  for (let i = 0; i < count; i++) {
    const star = STAR_FIELD[i];
    const x = mod(star.fx * twoScreens - cameraY * 0.021, width);
    const y = star.fy * height - cameraY * 0.05;
    if (y < -4 || y > height * 0.75) continue;
    const twinkle = reducedMotion
      ? 1
      : 0.72 + Math.sin(gameTime * 1.7 + star.phase) * 0.28;
    const alpha = nightness * twinkle * 0.85;
    if (alpha < 0.03) continue;
    ctx.fillStyle = hexToRgba(STAR_TINTS[i % STAR_TINTS.length], alpha);
    ctx.beginPath();
    ctx.arc(x, y, star.size, 0, Math.PI * 2);
    ctx.fill();
    if (star.bright && detail === "high") {
      // Four-point sparkle on the brightest stars.
      ctx.strokeStyle = hexToRgba("#ffffff", alpha * 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 4, y);
      ctx.lineTo(x + 4, y);
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x, y + 4);
      ctx.stroke();
    }
  }
}

/**
 * Sun travels a dawn→dusk arc (phase 0.075 → 0.7). Warm glow sourced from
 * the biome platform color so it harmonizes with each world region.
 */
function drawSun(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phase: number,
  platformColor: string,
  alpha: number,
): void {
  const t = (phase - SUN_ARC_START) / SUN_ARC_LENGTH; // 0..1 across the day
  if (t < 0 || t > 1) return;
  const vis = alpha;
  const x = width * (0.14 + 0.72 * t);
  const y = height * (0.46 - Math.sin(Math.max(0, Math.min(1, t)) * Math.PI) * 0.32);
  const r = Math.max(30, height * 0.075);
  const core = blendHex(platformColor, "#ffd27a", 0.6);
  const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.6);
  glow.addColorStop(0, hexToRgba(core, 0.5 * vis));
  glow.addColorStop(1, hexToRgba(core, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hexToRgba(core, vis);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  if (vis > 0.05) {
    ctx.strokeStyle = hexToRgba("#c7ff4d", vis * 0.55);
    ctx.lineWidth = Math.max(1.5, r * 0.05);
    ctx.beginPath();
    // Upper-left rim arc (sun rises left, sets right — rim faces the zenith).
    ctx.arc(x, y, r * 0.62, Math.PI * 1.05, Math.PI * 1.85);
    ctx.stroke();
  }
}

// Celestial arc windows (fraction of the day cycle). The sun rides
// dawn→dusk, the moon rides dusk→dawn; together they tile the cycle, and
// resolveCelestialAlphas cross-fades them so only one body owns the sky.
export const SUN_ARC_START = 0.075;
export const SUN_ARC_LENGTH = 0.625;
export const MOON_ARC_START = 0.575;
export const MOON_ARC_LENGTH = 0.625;

/**
 * Deterministic per-phase visibility of the sun and moon. Both bodies are
 * painted every frame; these alphas decide who is actually seen:
 *   sunAlpha  = sun arc progress × (1 − nightness)
 *   moonAlpha = moon arc progress × nightness
 * Because arcs tile the cycle and nightness is complementary at the two
 * hand-offs, sunAlpha + moonAlpha ≤ 1 at every phase — the previously
 * possible "sun and moon side by side at full strength" is impossible.
 */
export function resolveCelestialAlphas(
  gameTime: number,
): { sunAlpha: number; moonAlpha: number } {
  const { phase, nightness } = getSkyCycle(gameTime);
  const sunSpan = (phase - SUN_ARC_START) / SUN_ARC_LENGTH;
  const sunArc =
    sunSpan >= 0 && sunSpan <= 1
      ? Math.min(1, Math.min(sunSpan + 0.06, 1.06 - sunSpan) * 6)
      : 0;
  const moonSpan = ((phase - MOON_ARC_START) % 1 + 1) % 1 / MOON_ARC_LENGTH;
  const moonArc = moonSpan >= 0 && moonSpan <= 1 ? 1 : 0;
  return {
    sunAlpha: sunArc * (1 - nightness),
    moonAlpha: moonArc * nightness,
  };
}

/** Moon rides the night arc (phase 0.575 → wrap → 0.2) with subtle craters. */
function drawMoon(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phase: number,
  alpha: number,
): void {
  const span = (phase - MOON_ARC_START + 1) % 1; // 0 at moonrise
  const t = span / MOON_ARC_LENGTH; // same arc length as the sun
  if (t < 0 || t > 1) return;
  const vis = alpha;
  const x = width * (0.14 + 0.72 * t);
  const r = Math.max(32, Math.min(110, height * 0.13, width * 0.18));
  const y = Math.max(r + 10, height * (0.44 - Math.sin(t * Math.PI) * 0.3));
  // Concept-board identity: the moon sits inside a soft violet halo that
  // fades with its own visibility (no full-screen blur, purely local).
  if (vis > 0.05) {
    const halo = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 2.4);
    halo.addColorStop(0, hexToRgba("#9570ff", vis * 0.22));
    halo.addColorStop(1, hexToRgba("#9570ff", 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fractured lithograph disc. Bounded polygon work, never a blur filter.
  ctx.fillStyle = hexToRgba("#c999ef", vis);
  ctx.beginPath();
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2;
    const radius = r * (i % 3 === 0 ? 0.92 : 1);
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = hexToRgba("#311843", vis);
  ctx.lineWidth = Math.max(3, r * 0.09);
  ctx.beginPath();
  ctx.moveTo(x + r * 0.2, y - r);
  ctx.lineTo(x - r * 0.1, y - r * 0.4);
  ctx.lineTo(x + r * 0.25, y - r * 0.12);
  ctx.lineTo(x - r * 0.23, y + r * 0.45);
  ctx.lineTo(x + r * 0.1, y + r);
  ctx.moveTo(x - r * 0.95, y + r * 0.14);
  ctx.lineTo(x - r * 0.1, y - r * 0.4);
  ctx.stroke();
  // Detached ink chips make the broken edge readable at small sizes.
  ctx.fillStyle = hexToRgba("#d9b4f5", vis);
  for (let i = 0; i < 5; i++) {
    const a = i * 1.9 + 0.2;
    const sx = x + Math.cos(a) * r * 1.17;
    const sy = y + Math.sin(a) * r * 1.17;
    ctx.beginPath();
    ctx.moveTo(sx, sy - r * 0.06);
    ctx.lineTo(sx + r * 0.09, sy);
    ctx.lineTo(sx, sy + r * 0.09);
    ctx.lineTo(sx - r * 0.04, sy);
    ctx.closePath();
    ctx.fill();
  }
  // Craters
  ctx.fillStyle = hexToRgba("#b9a8e8", vis * 0.7);
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + r * 0.25, y + r * 0.3, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + r * 0.15, y - r * 0.4, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

// ── Parallax ───────────────────────────────────────────────────────────

/** Three opaque urban plates replace the smooth hills and duplicate skyline. */
export function drawBackgroundParallax(ctx: CanvasRenderingContext2D, opts: BackgroundRenderOpts): void {
  const { width, height, cameraX, cameraY, detail } = opts;
  paintIndustrialCity(ctx, width, height, cameraX, cameraY, detail === "high");
}
