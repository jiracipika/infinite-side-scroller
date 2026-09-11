import { textureHash, surfaceAt } from "./textures";

/** Opaque screenprint inks. Bright ink is reserved for playable edges. */
export const INK = {
  black: "#09080f",
  deep: "#21112f",
  purple: "#44205f",
  violet: "#754294",
  lavender: "#b885d7",
  lime: "#c7ff4d",
  danger: "#ff7166",
  paper: "#f4f2ed",
} as const;

export function cityBlock(index: number, layer: number) {
  return {
    width: 70 + textureHash(index, 81 + layer) * 62,
    height: 100 + textureHash(index, 91 + layer) * 220,
    antenna: textureHash(index, 71 + layer) > 0.4,
    /** 0 flat-broken, 1 notched, 2 battered corner, 3 collapsed slab. */
    roof: Math.floor(textureHash(index, 61 + layer) * 4),
  };
}

/** Seeded window grid: variable pitch, per-row lit clusters, some bands skipped. */
export function windowGrid(index: number, layer: number) {
  const pitch = 24 + Math.floor(textureHash(index, 97 + layer) * 21);
  const rows: number[][] = [];
  for (let row = 0; row < 7; row++) {
    if (textureHash(index * 13 + row, 31 + layer) > 0.86) { rows.push([]); continue; }
    const cols: number[] = [];
    for (let col = 0; col < 4; col++)
      if (textureHash(index * 31 + row * 3 + col, layer + 50) > 0.45) cols.push(col);
    rows.push(cols);
  }
  return { pitch, rows };
}

/** World-cell indexing, not viewport wrapping: resizing never moves buildings. */
export function paintIndustrialCity(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cameraX: number,
  cameraY: number,
  detail: boolean,
) {
  ctx.save();
  for (let layer = 0; layer < 3; layer++) {
    const factor = [0.09, 0.19, 0.34][layer];
    const step = [105, 145, 210][layer];
    const base = height * 0.78 - cameraY * factor * 0.3;
    const start = Math.floor((cameraX * factor) / step) - 1;
    const end = Math.ceil((cameraX * factor + width) / step) + 1;
    const fill = [INK.purple, INK.deep, INK.black][layer];
    for (let i = start; i <= end; i++) {
      const b = cityBlock(i, layer);
      const x = i * step - cameraX * factor;
      const top = base - b.height * [1.45, 1.2, 1][layer];
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(x, height + 10);
      ctx.lineTo(x + 3, top + 12);
      ctx.lineTo(x + 12, top + 12);
      ctx.lineTo(x + 12, top);
      // Broken roofline variants: notched bite, battered lean, collapsed slab.
      if (b.roof === 1) {
        ctx.lineTo(x + b.width * 0.3, top + 2);
        ctx.lineTo(x + b.width * 0.38, top + 14);
        ctx.lineTo(x + b.width * 0.5, top + 3);
      } else if (b.roof === 2) {
        ctx.lineTo(x + b.width * 0.4, top - 8);
        ctx.lineTo(x + b.width * 0.62, top + 1);
      } else if (b.roof === 3) {
        ctx.lineTo(x + b.width * 0.35, top + 6);
        ctx.lineTo(x + b.width * 0.42, top - 5);
        ctx.lineTo(x + b.width * 0.6, top + 4);
      }
      ctx.lineTo(x + b.width * 0.65, top + 3);
      ctx.lineTo(x + b.width * 0.65, top + 19);
      ctx.lineTo(x + b.width, top + 19);
      ctx.lineTo(x + b.width + 4, height + 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = layer === 0 ? INK.violet : INK.purple;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 4, base);
      ctx.lineTo(x + 4, top + 13);
      ctx.lineTo(x + 12, top + 13);
      ctx.lineTo(x + 12, top + 1);
      ctx.lineTo(x + b.width * 0.64, top + 4);
      ctx.stroke();
      if (b.antenna) {
        ctx.fillRect(x + 19, top - 34, 3, 35);
        ctx.fillRect(x + 9, top - 20, 27, 2);
        ctx.fillRect(x + 48, top - 17, 8, 20);
      }
      if (!detail && i % 2) continue;
      // Screenprinted facade bands, fire escapes, tanks and sagging cables.
      ctx.strokeStyle = layer === 2 ? INK.deep : INK.violet;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = top + 32; y < Math.min(base, height); y += 32) {
        ctx.moveTo(x + 8, y);
        ctx.lineTo(x + b.width - 8, y);
        if (layer > 0) {
          ctx.moveTo(x + b.width - 19, y);
          ctx.lineTo(x + b.width - 19, y + 24);
          ctx.lineTo(x + b.width - 8, y + 24);
        }
      }
      ctx.stroke();
      // Irregular windows: variable pitch + per-row clusters; some bands skipped.
      ctx.fillStyle = layer === 2 ? INK.purple : INK.violet;
      const grid = windowGrid(i, layer);
      for (let row = 0; row < grid.rows.length; row++)
        for (const col of grid.rows[row])
          ctx.fillRect(x + 15 + col * 18, top + 30 + row * grid.pitch, 4, 11);
      if (layer === 1 && i % 3 === 0) {
        ctx.fillStyle = INK.purple;
        ctx.fillRect(x - 8, top + 30, 19, 65);
        ctx.strokeStyle = INK.lavender;
        ctx.strokeRect(x - 8, top + 30, 19, 65);
        ctx.beginPath();
        for (let g = 0; g < 4; g++) {
          const y = top + 38 + g * 13;
          ctx.moveTo(x - 4, y);
          ctx.lineTo(x + 7, y);
          ctx.moveTo(x + 1, y - 3);
          ctx.lineTo(x + 1, y + 8);
          ctx.moveTo(x - 3, y + 5);
          ctx.lineTo(x + 6, y + 5);
        }
        ctx.stroke();
      }
      if (layer === 2) {
        ctx.strokeStyle = INK.black;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 20, top - 16);
        ctx.quadraticCurveTo(x + step * 0.6, top + 72, x + step + 20, top + 12);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** Cached into the terrain canvas; every mark is below the collision surface. */
export function paintRooftopFacade(
  ctx: CanvasRenderingContext2D,
  heights: number[],
  seed: number,
  ox: number,
  oy: number,
  depth: number,
  detail: boolean,
) {
  ctx.save();
  ctx.lineWidth = 1;
  const step = detail ? 64 : 128;
  for (let x = 12; x < heights.length * 4; x += step) {
    const y = surfaceAt(heights, x) + oy;
    const h = textureHash(x, seed);
    const sx = x + ox + h * 9;
    ctx.strokeStyle = INK.purple;
    ctx.beginPath();
    ctx.moveTo(sx, y + 14);
    ctx.lineTo(sx + 5, y + 38);
    ctx.lineTo(sx - 2, y + 50);
    ctx.lineTo(sx + 3, Math.min(depth, y + 70 + h * 90));
    ctx.stroke();
    ctx.fillStyle = INK.deep;
    ctx.fillRect(sx + 12, y + 26 + h * 18, 18 + h * 20, 6);
    ctx.fillRect(sx + 16, y + 48 + h * 8, 12 + h * 17, 2);
    ctx.strokeStyle = INK.violet;
    ctx.beginPath();
    ctx.moveTo(sx + 8, y + 9);
    ctx.lineTo(sx + 26, y + 14);
    ctx.moveTo(sx + 12, y + 30);
    ctx.lineTo(sx + 35, y + 29);
    ctx.stroke();
    // Broken paint, bolt heads and sparse screenprint hatch, not glowing soil.
    ctx.fillStyle = INK.lime;
    ctx.fillRect(sx + 3, y + 5, 5 + h * 12, 1);
    ctx.fillStyle = INK.violet;
    ctx.fillRect(sx + 4, y + 18, 2, 2);
    if (detail) {
      ctx.strokeStyle = INK.deep;
      ctx.beginPath();
      for (let j = 0; j < 6; j++) {
        ctx.moveTo(sx + j * 5, y + 65);
        ctx.lineTo(sx + j * 5 + 19, y + 47);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Rough undersides only: the horizontal landing edge remains exact. */
export function paintInkSlab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  seed: number,
) {
  ctx.save();
  ctx.fillStyle = INK.black;
  ctx.strokeStyle = INK.purple;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width - 3, y + 18);
  for (let p = width - 8; p > 0; p -= 12)
    ctx.lineTo(x + p, y + 15 + textureHash(p, seed) * 12);
  ctx.lineTo(x, y + 15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = INK.lime;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
  for (let p = 7; p < width - 7; p += 22) {
    ctx.fillStyle = INK.violet;
    ctx.fillRect(x + p, y + 8, 2, 2);
    ctx.strokeStyle = INK.purple;
    ctx.beginPath();
    ctx.moveTo(x + p, y + 17);
    ctx.lineTo(x + p + 12, y + 9);
    ctx.stroke();
  }
  ctx.restore();
}

/** An alert reflects existing AI state; it never changes enemy behavior. */
export function paintAlert(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
) {
  ctx.save();
  ctx.fillStyle = INK.lime;
  ctx.strokeStyle = INK.black;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 18; i++) {
    const a = (i * Math.PI) / 9;
    const r = i % 2 ? 9 : 15;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK.black;
  ctx.fillRect(x - 1.5, y - 7, 3, 8);
  ctx.fillRect(x - 1.5, y + 4, 3, 3);
  ctx.restore();
}

/** Tapered cut-ink wedges trailing the pose; reduced-motion callers skip. */
export function paintDashBrush(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  right: boolean,
  seed: number = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(right ? 1 : -1, 1);
  for (let i = 0; i < 3; i++) {
    const h = textureHash(seed * 31 + i, 71);
    const sy = height * (0.22 + i * 0.25) + (h - 0.5) * 4;
    const len = 62 - i * 13 + h * 14;
    const thick = 7 - i * 1.5;
    ctx.fillStyle = i === 1 ? INK.lime : INK.violet;
    ctx.beginPath();
    // Tapered wedge: sharp leading edge at 0, frayed tail cuts at the end.
    ctx.moveTo(2, sy);
    ctx.lineTo(-len, sy - thick * (0.4 + h * 0.3));
    ctx.lineTo(-len + 14 + h * 10, sy - 2);
    ctx.lineTo(-len - 6, sy + 3 + h * 3);
    ctx.lineTo(-len + 18, sy + 4);
    ctx.lineTo(-len * 0.45, sy + thick);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Decorative rooftop equipment has no collision and no traversal-color rim. */
export function paintRoofProp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  kind: string,
  variant: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = INK.black;
  ctx.strokeStyle = INK.violet;
  ctx.lineWidth = 1;
  if (kind === "tree") {
    ctx.fillRect(-3, -64, 6, 64);
    ctx.fillRect(-19, -47, 38, 3);
    ctx.fillRect(-12, -61, 24, 2);
    ctx.beginPath();
    ctx.moveTo(-18, -2);
    ctx.lineTo(0, -49);
    ctx.lineTo(18, -2);
    ctx.stroke();
    if (variant % 2 === 0) {
      ctx.fillStyle = INK.deep;
      ctx.fillRect(4, -49, 15, 28);
      ctx.strokeRect(4, -49, 15, 28);
      ctx.fillStyle = INK.lavender;
      ctx.fillRect(8, -43, 6, 2);
      ctx.fillRect(10, -39, 2, 11);
    }
  } else {
    const w = kind === "rock" ? 24 : 32;
    ctx.fillRect(-w / 2, -14, w, 14);
    ctx.strokeRect(-w / 2, -14, w, 14);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 5, -11 + i * 3);
      ctx.lineTo(w / 2 - 5, -11 + i * 3);
      ctx.stroke();
    }
    ctx.fillRect(w / 2 - 5, -20, 5, 6);
  }
  ctx.restore();
}

/**
 * Segmented ink contour for the terrain surface. Replaces the old per-4px
 * zigzag strokes: the surface is drawn as consolidated segments with varied
 * stroke weight and occasional skipped bands (chipped ink), while every
 * point still sits on the exact collision height (painter offset only).
 * Deterministic via textureHash on chunk index + segment index.
 */
export function paintInkTerrainEdge(
  ctx: CanvasRenderingContext2D,
  heights: number[],
  chunkIndex: number,
  offsetX: number,
  offsetY: number,
  detail: boolean,
): void {
  ctx.save();
  const step = detail ? 12 : 20; // px of surface per segment (was 4)
  const layers: Array<{ weight: number; color: string; lift: number }> = [
    { weight: 9, color: INK.black, lift: 2 }, // bold ink under-lip
    { weight: 7, color: INK.deep, lift: 0 }, // deep plate edge
  ];
  for (const layer of layers) {
    let seg = 0;
    // Loop to the full width: i1 clamps to the last sample, so the bold
    // under-lip reaches the chunk edge (an 8px seam appeared otherwise).
    for (let x0 = 0; x0 < heights.length * 4; x0 += step, seg++) {
      // Chipped ink: deterministically skip some segments on the inner layer.
      if (layer.weight === 7 && textureHash(chunkIndex * 61 + seg, 83) > 0.82) continue;
      const i0 = Math.round(x0 / 4);
      const i1 = Math.min(heights.length - 1, Math.round((x0 + step) / 4));
      ctx.strokeStyle = layer.color;
      ctx.lineWidth = layer.weight * (0.75 + textureHash(chunkIndex * 13 + seg, 89) * 0.5);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(i0 * 4 + offsetX, heights[i0] + layer.lift + offsetY);
      // One mid control point follows the real surface between endpoints.
      const iMid = Math.round((i0 + i1) / 2);
      ctx.lineTo(iMid * 4 + offsetX, heights[iMid] + layer.lift + offsetY);
      ctx.lineTo(i1 * 4 + offsetX, heights[i1] + layer.lift + offsetY);
      ctx.stroke();
    }
  }
  ctx.restore();
}
