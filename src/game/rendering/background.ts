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
import { blendHex, hexChannels, hexToRgba, shadeFraction } from "./color";
import { textureHash } from "./textures";

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

/** Stable per-biome seed derived from the dark ground color. */
function colorSeed(colors: BiomeColors): number {
  const { r, g, b } = hexChannels(colors.groundDark);
  return (r * 7 + g * 13 + b * 3) / 10;
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
  const zenith = colors.sky;
  const horizon = blendHex(colors.skyGradient, colors.sky, 0.55 * nightness);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, zenith);
  gradient.addColorStop(0.55, blendHex(zenith, horizon, 0.5));
  gradient.addColorStop(1, horizon);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const { sunAlpha, moonAlpha } = resolveCelestialAlphas(gameTime);
  if (nightness > 0.02) {
    drawStars(ctx, width, height, cameraY, gameTime, nightness, detail, reducedMotion);
  }
  if (moonAlpha > 0.004) {
    drawMoon(ctx, width, height, phase, moonAlpha);
  }
  if (sunAlpha > 0.004) {
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
  const y = height * (0.44 - Math.sin(t * Math.PI) * 0.3);
  const r = Math.max(18, height * 0.045);
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
  const body = "#e8ecf4";
  ctx.fillStyle = hexToRgba(body, vis);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
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

/**
 * Paint the world backdrop layers behind terrain: far ridge, mid ridge,
 * chromatic streams, near ridge, clouds. Draws in listed order.
 */
export function drawBackgroundParallax(
  ctx: CanvasRenderingContext2D,
  opts: BackgroundRenderOpts,
): void {
  const { width, height, cameraX, cameraY, gameTime, colors, detail } = opts;
  const { nightness } = getSkyCycle(gameTime);
  const seed = colorSeed(colors);

  // Aerial perspective: far ridges blend toward the sky color so depth reads.
  const farColor = blendHex(shadeFraction(colors.groundDark, -0.24), colors.sky, 0.62);
  const midColor = blendHex(shadeFraction(colors.groundDark, -0.1), colors.sky, 0.4);
  const nearColor = blendHex(colors.groundDark, colors.sky, 0.16);
  const snowColor = blendHex("#e7eefc", colors.sky, 0.15);

  drawRidge(ctx, width, height, cameraX, cameraY, 0.08, 232, 92, farColor, seed + 40, null, detail === "high" ? 6 : 10);
  drawRidge(ctx, width, height, cameraX, cameraY, 0.18, 305, 74, midColor, seed + 160, detail === "high" ? snowColor : null, detail === "high" ? 5 : 9);
  drawChromaticStreams(ctx, width, gameTime, colors, nightness, detail, reducedMotion(opts));
  drawInkSkyline(ctx, width, height, cameraX, cameraY, gameTime, colors, nightness, seed, detail, reducedMotion(opts));
  drawRidge(ctx, width, height, cameraX, cameraY, 0.35, 395, 62, nearColor, seed + 280, null, detail === "high" ? 4 : 8);
  drawCloudLayer(ctx, width, height, cameraX, cameraY, gameTime, colors, nightness, detail, reducedMotion(opts));
}

function reducedMotion(opts: BackgroundRenderOpts): boolean {
  return opts.reducedMotion;
}

function drawRidge(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cameraX: number,
  cameraY: number,
  factor: number,
  baseY: number,
  amplitude: number,
  color: string,
  seed: number,
  snowColor: string | null,
  step: number,
): void {
  const yShift = -cameraY * factor * 0.25;
  const tops: number[] = [];
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-step, height + 4);
  for (let sx = -step; sx <= width + step; sx += step) {
    const wx = sx + cameraX * factor;
    const y = baseY - ridgeHeightAt(wx, seed, amplitude) + yShift;
    tops.push(y);
    ctx.lineTo(sx, y);
  }
  ctx.lineTo(width + step, height + 4);
  ctx.closePath();
  ctx.fill();

  if (!snowColor) return;
  // Snow caps: on peaks that rise above ~55% prominence, paint small
  // triangular caps following the ridge line.
  const snowLine = baseY + yShift - amplitude * 0.55;
  ctx.fillStyle = hexToRgba(snowColor, 0.8);
  for (let i = 1; i < tops.length - 1; i++) {
    const y = tops[i];
    if (y >= snowLine) continue;
    const sx = -step + i * step;
    ctx.beginPath();
    ctx.moveTo(sx, y - 1);
    ctx.lineTo(sx + step * 0.9, y + 8 + (snowLine - y) * 0.12);
    ctx.lineTo(sx - step * 0.9, y + 7 + (snowLine - y) * 0.1);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Thin neon "aurora" streams — the Dashverse signature, toned down and
 * layered behind the near ridge so they read as sky phenomena instead of
 * foreground wires. Alpha drops at night so they don't fight the stars.
 */
function drawChromaticStreams(
  ctx: CanvasRenderingContext2D,
  width: number,
  gameTime: number,
  colors: BiomeColors,
  nightness: number,
  detail: BackgroundDetail,
  reducedMotionFlag: boolean,
): void {
  if (detail !== "high") return;
  const alphaScale = 0.4 * (1 - nightness * 0.55);
  const streamColors = [
    colors.platform,
    colors.ground,
    blendHex(colors.skyGradient, "#ffffff", 0.25),
  ];
  const time = reducedMotionFlag ? 0 : gameTime;
  ctx.save();
  ctx.globalAlpha = alphaScale;
  for (let band = 0; band < 3; band++) {
    ctx.strokeStyle = streamColors[band];
    ctx.lineWidth = 2 + band * 1.2;
    ctx.beginPath();
    for (let x = -20; x <= width + 20; x += 24) {
      const y =
        64 +
        band * 40 +
        Math.sin(
          x * (0.006 + band * 0.0015) + time * (0.18 + band * 0.05),
        ) *
          (14 + band * 7);
      if (x === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Graphic-novel ink city skyline — the concept board's signature backdrop.
 * Deterministic silhouette towers (hash-seeded, multiplayer-stable) with a
 * scatter of lit windows and occasional vertical neon signs. Sits between
 * the chromatic streams and the near ridge so towers read as mid-ground
 * city blocks. Alpha lifts at night (the concept is a violet night city);
 * signs use the approved accent trio (lime / violet / coral).
 */
function drawInkSkyline(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cameraX: number,
  cameraY: number,
  gameTime: number,
  colors: BiomeColors,
  nightness: number,
  seed: number,
  detail: BackgroundDetail,
  reducedMotionFlag: boolean,
): void {
  const parallax = 0.26;
  const baseY = 405 - cameraY * 0.26;
  const towers = detail === "high" ? 10 : 6;
  const spanX = width + 480;
  const ink = blendHex("#0a0a0f", colors.groundDark, 0.3);
  const SIGN_TINTS = ["#c7ff4d", "#9570ff", "#ff7166"] as const;
  const time = reducedMotionFlag ? 0 : gameTime;

  for (let i = 0; i < towers; i++) {
    const h1 = textureHash(i * 23 + 5, seed + 901);
    const h2 = textureHash(i * 41 + 9, seed + 902);
    const h3 = textureHash(i * 61 + 13, seed + 903);
    const tw = 34 + h1 * 58;              // tower width
    const th = 90 + h2 * 190;             // tower height
    const x = mod(h1 * spanX + time * 3.2 - cameraX * parallax, spanX + tw) - tw;
    const topY = baseY - th;
    if (topY > height * 0.72 || baseY < 0) continue;
    const bodyAlpha = 0.66 + h3 * 0.22;

    // Ink tower body (flat, opaque, slight taper for a hand-inked read).
    ctx.fillStyle = hexToRgba(ink, bodyAlpha);
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + tw * 0.08, topY);
    ctx.lineTo(x + tw * 0.92, topY);
    ctx.lineTo(x + tw, baseY);
    ctx.closePath();
    ctx.fill();

    // Rooftop block (antenna/roof detail varies per tower).
    if (h3 > 0.55) {
      ctx.fillRect(x + tw * (0.18 + h1 * 0.3), topY - 10 - h2 * 12, tw * 0.16, 10 + h2 * 12);
    }

    if (detail !== "high") continue;

    // Lit windows: deterministic grid scatter, warm-pale, brighter at night.
    const cols = Math.max(2, Math.floor(tw / 16));
    const rows = Math.max(3, Math.floor(th / 22));
    const winAlpha = (0.16 + nightness * 0.5) * bodyAlpha;
    ctx.fillStyle = hexToRgba("#ffe9c9", winAlpha);
    for (let c = 0; c < cols; c++) {
      for (let rw = 0; rw < rows; rw++) {
        const lit = textureHash(i * 97 + c * 13 + rw * 7, seed + 904);
        if (lit > 0.62) {
          ctx.fillRect(
            x + tw * 0.14 + c * (tw * 0.72) / cols,
            topY + 12 + rw * (th - 20) / rows,
            3.4,
            4.6,
          );
        }
      }
    }

    // Vertical neon sign on ~1 in 3 towers: thin glowing strip with bands.
    if (h2 > 0.66) {
      const tint = SIGN_TINTS[Math.floor(h3 * SIGN_TINTS.length) % SIGN_TINTS.length];
      const sx = x + tw * (0.3 + h1 * 0.4);
      const sy = topY + 14;
      const sh = th * (0.42 + h3 * 0.3);
      const flicker = reducedMotionFlag
        ? 1
        : 0.82 + Math.sin(gameTime * (2 + h1 * 3) + i * 2.1) * 0.18;
      const signAlpha = (0.5 + nightness * 0.4) * flicker;
      ctx.fillStyle = hexToRgba(ink, bodyAlpha);
      ctx.fillRect(sx - 5, sy - 6, 10, sh + 12);
      ctx.fillStyle = hexToRgba(tint, signAlpha);
      const bands = Math.max(3, Math.floor(sh / 12));
      for (let b = 0; b < bands; b++) {
        if (textureHash(i * 31 + b * 17, seed + 905) > 0.3) {
          ctx.fillRect(sx - 2.5, sy + b * (sh / bands), 5, (sh / bands) * 0.62);
        }
      }
      // Soft local glow around the strip (never full-screen).
      const glow = ctx.createRadialGradient(sx, sy + sh / 2, 2, sx, sy + sh / 2, sh * 0.55);
      glow.addColorStop(0, hexToRgba(tint, signAlpha * 0.16));
      glow.addColorStop(1, hexToRgba(tint, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(sx - sh * 0.3, sy - 10, sh * 0.6, sh + 20);
    }
  }
}

/**
 * World-anchored drifting clouds. Positions come from deterministic hashes
 * over the cloud slot index — the same sky renders on every client.
 */
function drawCloudLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cameraX: number,
  cameraY: number,
  gameTime: number,
  colors: BiomeColors,
  nightness: number,
  detail: BackgroundDetail,
  reducedMotionFlag: boolean,
): void {
  const slots = detail === "high" ? 9 : 5;
  const spanX = width + 600;
  // Graphic-novel ink clouds: near-black inked bodies with a subtle top rim
  // picked up from the biome highlight (violet day, pale night). Opaque fills
  // keep the inked read; alpha only softens them slightly into the sky.
  const inkBody = blendHex("#0a0a0f", colors.groundDark, 0.42);
  const rimLight = blendHex(colors.skyGradient, "#f4f2ed", 0.38);
  const time = reducedMotionFlag ? 0 : gameTime;

  for (let i = 0; i < slots; i++) {
    const h1 = textureHash(i * 17 + 3, 101);
    const h2 = textureHash(i * 31 + 7, 202);
    const h3 = textureHash(i * 53 + 11, 303);
    const scale = 0.7 + h3 * 0.9;
    const speed = 9 + h2 * 9;
    const x = mod(h1 * spanX + time * speed - cameraX * 0.06, spanX) - 300;
    const y =
      42 + h2 * (height * 0.2) - cameraY * 0.1 + (reducedMotionFlag ? 0 : Math.sin(time * 0.5 + i) * 2.5);
    if (y < -30 || y > height * 0.6) continue;
    const alpha = 0.78 + h3 * 0.18;
    drawCloudShape(ctx, x, y, scale, hexToRgba(inkBody, alpha), hexToRgba(rimLight, alpha * 0.5));
  }
}

function drawCloudShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  body: string,
  rim: string,
): void {
  // Flat ink silhouette built from overlapping puffs — bold, not fluffy.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x, y, 42 * s, 14 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - 30 * s, y + 5 * s, 26 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 28 * s, y + 4 * s, 30 * s, 11 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 4 * s, y - 8 * s, 24 * s, 11 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Thin light rim traced along the top of the main puff — the inked
  // highlight that makes the cloud read against dark skies.
  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(1, 1.6 * s);
  ctx.beginPath();
  ctx.ellipse(x + 4 * s, y - 8 * s, 24 * s, 11 * s, 0, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, 42 * s, 14 * s, 0, Math.PI * 1.12, Math.PI * 1.75);
  ctx.stroke();
}
