import { CHARACTERS } from '../../src/game/data/characters';
import { drawCharacterArt } from '../../src/game/rendering/character-art';
import type { CharacterArtPose } from '../../src/game/rendering/character-art';

/**
 * Crimson court contact sheet: Cherry's red-and-black family at every pose
 * through the REAL drawCharacterArt dispatch, plus a 28px chip render.
 */

const CRIMSON = ['velvet', 'ember', 'rosalia', 'marionette', 'dorian', 'onyx', 'mortimer', 'grimshaw'];
const CAST = CHARACTERS.filter((c) => CRIMSON.includes(c.id));

const POSES: Array<{ label: string; pose: CharacterArtPose }> = [
  { label: 'idle', pose: {} },
  { label: 'run', pose: { stride: 2.4 } },
  { label: 'air', pose: { airborne: true } },
  { label: 'dash', pose: { dashing: true } },
  { label: 'melee', pose: { melee: 0.5 } },
  { label: 'tumble', pose: { airborne: true, tumble: 0.5 } },
];

const SCALE = 5;
const CHIP = 28;
const COL_W = 34 * SCALE + 44;
const ROW_H = 40 * SCALE + 40;

const canvas = document.getElementById('sheet') as HTMLCanvasElement;
canvas.width = 150 + POSES.length * COL_W + 20;
canvas.height = 60 + CAST.length * ROW_H + 20;
const ctx = canvas.getContext('2d')!;

ctx.fillStyle = '#0b0b12';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#f4f2ed';
ctx.font = '700 24px system-ui, sans-serif';
ctx.fillText('DashVerse — the crimson court (real dispatch)', 24, 38);

CAST.forEach((char, row) => {
  const rowY = 58 + row * ROW_H;
  // Chip-size render (character-select legibility).
  ctx.fillStyle = '#181826';
  ctx.fillRect(24, rowY + 14, 72, 72);
  ctx.strokeStyle = '#2a2a3c';
  ctx.strokeRect(24.5, rowY + 14.5, 71, 71);
  ctx.save();
  ctx.translate(24 + (72 - CHIP) / 2, rowY + 14 + 6);
  drawCharacterArt(ctx, char, CHIP, CHIP, {});
  ctx.restore();
  ctx.fillStyle = '#c7ff4d';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(char.name, 24, rowY + 100);

  POSES.forEach((entry, col) => {
    const cellX = 116 + col * COL_W;
    const boxW = char.width * SCALE;
    const boxH = char.height * SCALE;
    // Game-like backdrop per cell.
    ctx.fillStyle = '#10101c';
    ctx.fillRect(cellX, rowY, COL_W - 14, ROW_H - 26);
    ctx.fillStyle = '#161628';
    ctx.beginPath();
    ctx.moveTo(cellX, rowY + ROW_H - 26);
    ctx.lineTo(cellX + (COL_W - 14) * 0.3, rowY + (ROW_H - 26) * 0.55);
    ctx.lineTo(cellX + (COL_W - 14) * 0.6, rowY + (ROW_H - 26) * 0.75);
    ctx.lineTo(cellX + COL_W - 14, rowY + (ROW_H - 26) * 0.5);
    ctx.lineTo(cellX + COL_W - 14, rowY + ROW_H - 26);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(cellX + (COL_W - 14 - boxW) / 2, rowY + 16);
    ctx.strokeStyle = 'rgba(199,255,77,0.22)';
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(0.5, 0.5, boxW - 1, boxH - 1);
    ctx.setLineDash([]);
    ctx.scale(SCALE, SCALE);
    drawCharacterArt(ctx, char, char.width, char.height, entry.pose);
    ctx.restore();
    ctx.fillStyle = '#c7ff4d';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(entry.label, cellX + 6, rowY + ROW_H - 8);
  });
});
