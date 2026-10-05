import { CONCEPTS, POSES } from './concepts';

/**
 * Contact-sheet preview: one row per concept, one column per pose, drawn at
 * 6× over a game-like dark backdrop with a faint collision-box outline, plus
 * a chip-size (28px) render per concept to verify character-select legibility.
 */

const SCALE = 6;
const CELL_W = 22 * SCALE + 46;
const CELL_H = 32 * SCALE + 34;
const SHEET_W = 120 + POSES.length * CELL_W + 40;
const SHEET_H = 90 + CONCEPTS.length * (CELL_H + 150) + 40;

function gameBackdrop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0b0b12';
  ctx.fillRect(x, y, w, h);
  // Distant ridge, like the game's midground.
  ctx.fillStyle = '#141422';
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w * 0.2, y + h * 0.45);
  ctx.lineTo(x + w * 0.45, y + h * 0.7);
  ctx.lineTo(x + w * 0.7, y + h * 0.35);
  ctx.lineTo(x + w, y + h * 0.6);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
}

function drawConceptRow(
  ctx: CanvasRenderingContext2D,
  concept: (typeof CONCEPTS)[number],
  rowY: number,
): void {
  ctx.fillStyle = '#f4f2ed';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillText(concept.label, 24, rowY + 8);

  // Chip-size render (what the character-select grid shows).
  const chipY = rowY + 34;
  ctx.fillStyle = '#181826';
  ctx.fillRect(24, chipY, 96, 96);
  ctx.strokeStyle = '#2a2a3c';
  ctx.strokeRect(24.5, chipY + 0.5, 95, 95);
  ctx.save();
  ctx.translate(24 + 34, chipY + 30);
  concept.draw(ctx, 28, 40, {});
  ctx.restore();
  ctx.fillStyle = '#8e799e';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('chip 28px', 24, chipY + 112);

  POSES.forEach((entry, col) => {
    const cellX = 140 + col * CELL_W;
    const cellY = rowY + 24;
    gameBackdrop(ctx, cellX, cellY, CELL_W - 16, CELL_H - 24);
    ctx.save();
    // Origin so the 22×32 collision box sits centered with headroom for
    // the parasol/hair that legitimately overshoots the box.
    ctx.translate(cellX + (CELL_W - 16 - 22 * SCALE) / 2, cellY + 20);
    ctx.save();
    ctx.strokeStyle = 'rgba(199,255,77,0.28)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 22 * SCALE - 1, 32 * SCALE - 1);
    ctx.restore();
    ctx.scale(SCALE, SCALE);
    concept.draw(ctx, 22, 32, entry.pose);
    ctx.restore();
    ctx.fillStyle = '#c7ff4d';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText(entry.label, cellX + (CELL_W - 16) / 2 - entry.label.length * 4, cellY + CELL_H - 6);
  });
}

function heroPortraits(ctx: CanvasRenderingContext2D, y: number): void {
  ctx.fillStyle = '#f4f2ed';
  ctx.font = '600 24px system-ui, sans-serif';
  ctx.fillText('Hero portraits (12×) — silhouette + cherry read', 24, y - 12);
  CONCEPTS.forEach((concept, i) => {
    const x = 60 + i * 480;
    gameBackdrop(ctx, x, y, 430, 420);
    ctx.save();
    ctx.translate(x + 125, y + 30);
    ctx.scale(12, 12);
    concept.draw(ctx, 22, 32, { stride: 0.35 });
    ctx.restore();
  });
}

const canvas = document.getElementById('sheet') as HTMLCanvasElement;
canvas.width = SHEET_W;
canvas.height = SHEET_H;
const ctx = canvas.getContext('2d')!;
ctx.fillStyle = '#101018';
ctx.fillRect(0, 0, SHEET_W, SHEET_H);
ctx.fillStyle = '#f4f2ed';
ctx.font = '700 26px system-ui, sans-serif';
ctx.fillText('Cherry — concept iterations (cherry-goth, red hair)', 24, 42);

CONCEPTS.forEach((concept, row) => {
  drawConceptRow(ctx, concept, 70 + row * (CELL_H + 60));
});

heroPortraits(ctx, 70 + CONCEPTS.length * (CELL_H + 60) + 20);
