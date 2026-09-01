/**
 * Shared canvas color utilities.
 *
 * Small, allocation-light helpers used by both the background painter and the
 * terrain texture painters. Everything works on `#rrggbb` hex strings (the
 * palette format used by `world/biomes.ts`) and returns CSS color strings.
 */

/** Clamp helper shared by the shading functions. */
function clamp255(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  if (clean.length !== 6) return { r: 128, g: 128, b: 128 };
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return { r: 128, g: 128, b: 128 };
  }
  return { r, g, b };
}

/** Parse any `#rrggbb` string; falls back to mid-gray for invalid input. */
export function hexChannels(hex: string): { r: number; g: number; b: number } {
  return hexToRgb(hex);
}

/**
 * Lighten (positive amount) or darken (negative amount) a hex color by a
 * fixed 0-255 step per channel — same behavior the renderer's inline
 * `shadeHexColor` always had, moved here so the new painters share it.
 */
export function shadeHexColor(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const step = Math.round(amount);
  return rgbToString(
    clamp255(r + step),
    clamp255(g + step),
    clamp255(b + step),
  );
}

/**
 * Mix a hex color toward black or white by a fractional amount.
 * `fraction` > 0 lightens, < 0 darkens, clamped to [-1, 1].
 * Smooth, perceptually gentler than the fixed-step variant — good for
 * large fills where a linear channel offset can look chalky.
 */
export function shadeFraction(hex: string, fraction: number): string {
  const { r, g, b } = hexToRgb(hex);
  const f = Math.max(-1, Math.min(1, fraction));
  const target = f >= 0 ? 255 : 0;
  const t = Math.abs(f);
  return rgbToString(
    Math.round(r + (target - r) * t),
    Math.round(g + (target - g) * t),
    Math.round(b + (target - b) * t),
  );
}

/**
 * Linear blend between two hex colors. `t` = 0 returns `a`, `t` = 1 returns
 * `b`; out-of-range values are clamped.
 */
export function blendHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const f = Math.max(0, Math.min(1, t));
  return rgbToString(
    Math.round(ca.r + (cb.r - ca.r) * f),
    Math.round(ca.g + (cb.g - ca.g) * f),
    Math.round(ca.b + (cb.b - ca.b) * f),
  );
}

/** Format already-clamped channels as a `#rrggbb` string. */
function rgbToString(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Build an `rgba()` string from a hex color plus explicit alpha.
 * Cheaper than string-concatenating per-particle colors every frame.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}
