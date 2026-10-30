import { textureHash, surfaceAt } from './textures';
import type { BackgroundRenderOpts } from './background';

/** Distant architecture echoes the cast's crescent staffs, court windows and
 * broken armor. World-cell placement keeps it stable across resize and scroll. */
export function drawDistantSanctuary(ctx: CanvasRenderingContext2D, opts: BackgroundRenderOpts): void {
  const { width, height, cameraX, cameraY, detail } = opts;
  const step = 620, parallax = .065;
  const start = Math.floor(cameraX * parallax / step) - 1;
  ctx.save();
  for (let cell = start; cell * step - cameraX * parallax < width + step; cell++) {
    const x = cell * step - cameraX * parallax;
    const base = height * .78 - cameraY * .04;
    const peak = base - 260 - textureHash(cell, 610) * 170;
    const kind = ((cell % 3) + 3) % 3;
    ctx.fillStyle = '#3a304f';
    ctx.strokeStyle = '#72618c';
    ctx.lineWidth = 1;
    if (kind === 0) {
      // A ruined chapel with two needle spires and an open rose window.
      ctx.beginPath();
      ctx.moveTo(x, base); ctx.lineTo(x, peak + 70); ctx.lineTo(x + 18, peak + 70);
      ctx.lineTo(x + 25, peak); ctx.lineTo(x + 32, peak + 70);
      ctx.lineTo(x + 52, peak + 70); ctx.lineTo(x + 52, peak + 130);
      ctx.lineTo(x + 100, peak + 93); ctx.lineTo(x + 148, peak + 130);
      ctx.lineTo(x + 148, peak + 70); ctx.lineTo(x + 168, peak + 70);
      ctx.lineTo(x + 175, peak + 12); ctx.lineTo(x + 182, peak + 70);
      ctx.lineTo(x + 200, peak + 70); ctx.lineTo(x + 200, base);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 100, peak + 144, 23, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#4f4166'; ctx.beginPath(); ctx.arc(x + 100, peak + 144, 17, 0, Math.PI * 2); ctx.fill();
      if (detail === 'high') {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          ctx.moveTo(x + 100, peak + 144);
          ctx.lineTo(x + 100 + Math.cos(a) * 22, peak + 144 + Math.sin(a) * 22);
        }
        ctx.stroke();
      }
    } else if (kind === 1) {
      // A broken observatory: recognizable circular language, quiet values.
      ctx.fillRect(x + 64, peak + 68, 76, base - peak);
      ctx.beginPath(); ctx.arc(x + 102, peak + 71, 38, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 102, peak + 35, 64, 18, -.35, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 102, peak - 22); ctx.lineTo(x + 102, peak + 28); ctx.stroke();
      ctx.fillStyle = '#9c85b4'; ctx.fillRect(x + 100, peak - 26, 4, 4);
    } else {
      // Old aqueduct, chipped parapet and pointed arch cut-outs.
      ctx.fillRect(x - 20, peak + 140, 330, base - peak);
      ctx.fillStyle = '#51415f';
      for (let i = 0; i < 4; i++) {
        const ax = x + i * 76;
        ctx.beginPath(); ctx.moveTo(ax, base); ctx.lineTo(ax, peak + 215);
        ctx.quadraticCurveTo(ax + 9, peak + 179, ax + 26, peak + 166);
        ctx.quadraticCurveTo(ax + 43, peak + 179, ax + 52, peak + 215);
        ctx.lineTo(ax + 52, base); ctx.closePath(); ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** Sparse drifting dust, restricted to the sky. No coin-shaped sparkles or
 * bright traversal colors. The simulation clock and reduced-motion flag own it. */
export function drawWorldMotes(ctx: CanvasRenderingContext2D, opts: BackgroundRenderOpts): void {
  const { width, height, cameraX, cameraY, gameTime, detail, reducedMotion } = opts;
  const time = reducedMotion ? 0 : gameTime;
  const step = detail === 'high' ? 130 : 280;
  const start = Math.floor(cameraX * .24 / step) - 1;
  ctx.save();
  for (let cell = start; cell * step - cameraX * .24 < width + step; cell++) {
    const seed = textureHash(cell, 806);
    const x = cell * step - cameraX * .24 + Math.sin(time * .25 + seed * 9) * 9;
    const y = height * (.2 + textureHash(cell, 807) * .36) - cameraY * .08 + Math.sin(time * .4 + cell) * 7;
    ctx.globalAlpha = .22 + seed * .2;
    ctx.fillStyle = seed > .6 ? '#e6c6d8' : '#b8a0d6';
    ctx.fillRect(x, y, 1 + seed, 1 + seed);
  }
  ctx.restore();
}

/** Cool stone bevels and recessed masonry, baked with the existing terrain
 * cache. All details stay below the collision line; lime still means playable. */
export function paintStoneRelief(
  ctx: CanvasRenderingContext2D, heights: number[], seed: number,
  ox: number, oy: number, detail: boolean,
): void {
  ctx.save();
  ctx.beginPath();
  heights.forEach((y, i) => i ? ctx.lineTo(ox + i * 4, y + oy + 5) : ctx.moveTo(ox, y + oy + 5));
  for (let i = heights.length - 1; i >= 0; i--) ctx.lineTo(ox + i * 4, heights[i] + oy + 14);
  ctx.closePath(); ctx.fillStyle = '#3e354d'; ctx.fill();
  const step = detail ? 84 : 168;
  for (let x = 18; x < heights.length * 4 - 35; x += step) {
    const y = surfaceAt(heights, x) + oy;
    const sx = x + ox, h = textureHash(x, seed + 904);
    ctx.fillStyle = '#756785'; ctx.fillRect(sx, y + 6, 24 + h * 12, 1);
    ctx.fillStyle = '#292335'; ctx.fillRect(sx + 6, y + 19, 2, 18);
    ctx.strokeStyle = '#3e354d'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx - 8, y + 37); ctx.lineTo(sx + 33, y + 37); ctx.stroke();
    if (!detail || h < .35) continue;
    ctx.fillStyle = '#1b1828'; ctx.beginPath();
    ctx.moveTo(sx, y + 114); ctx.lineTo(sx, y + 66);
    ctx.quadraticCurveTo(sx + 6, y + 46, sx + 15, y + 42);
    ctx.quadraticCurveTo(sx + 24, y + 46, sx + 30, y + 66);
    ctx.lineTo(sx + 30, y + 114); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#51445f'; ctx.stroke();
    ctx.fillStyle = '#867398'; ctx.fillRect(sx + 14, y + 63, 2, 22);
    ctx.fillStyle = '#382e47'; ctx.fillRect(sx + 4, y + 89, 23, 2);
  }
  ctx.restore();
}
