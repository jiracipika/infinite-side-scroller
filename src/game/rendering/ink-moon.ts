import { textureHash } from "./textures";
import { hexToRgba } from "./color";

/**
 * Fractured lithograph moon: separate shard plates with real gaps between
 * them, seeded per plate index (never Math.random) so every client paints
 * the identical sky. Plates live within ~1.1r of the center; detached chips
 * ring the break. No gradients inside the plates — the violet halo stays
 * with the caller.
 */
export function paintFracturedMoon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  vis: number,
): void {
  ctx.save();
  const tones = ["#c999ef", "#b885d7", "#d9b4f5", "#a98ce8"];
  const plates = 9;
  for (let p = 0; p < plates; p++) {
    const h = textureHash(p, 17);
    const h2 = textureHash(p, 29);
    const span = (Math.PI * 2) / plates;
    const a0 = p * span + h * 0.2;
    const a1 = (p + 1) * span - 0.14 - h * 0.1; // visible gap between plates
    const rIn = r * (0.32 + h * 0.24);
    const rOut = r * (0.88 + h2 * 0.16);
    const steps = 4;
    ctx.fillStyle = hexToRgba(tones[p % tones.length], vis);
    ctx.beginPath();
    for (let s = 0; s <= steps; s++) {
      const a = a0 + ((a1 - a0) * s) / steps;
      const jitter = 1 - textureHash(p * 7 + s, 41) * 0.16;
      const rr = rOut * jitter;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    for (let s = steps; s >= 0; s--) {
      const a = a1 - ((a1 - a0) * (steps - s)) / steps;
      const rr = rIn * (0.9 + textureHash(p * 5 + s, 53) * 0.25);
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }
  // Detached chips along the fracture ring.
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
  // Dark seam ink so the fracture reads at small radii.
  ctx.strokeStyle = hexToRgba("#311843", vis);
  ctx.lineWidth = Math.max(2, r * 0.06);
  for (let p = 0; p < plates; p++) {
    const span = (Math.PI * 2) / plates;
    const a = (p + 1) * span - 0.07 - textureHash(p, 17) * 0.05;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3);
    ctx.lineTo(x + Math.cos(a) * r * 1.02, y + Math.sin(a) * r * 1.02);
    ctx.stroke();
  }
  ctx.restore();
}
