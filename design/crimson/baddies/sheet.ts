import { Velvet } from '../../../src/game/entities/Velvet';
import { Ember } from '../../../src/game/entities/Ember';
import { Rosalia } from '../../../src/game/entities/Rosalia';
import { Marionette } from '../../../src/game/entities/Marionette';
import { Dorian } from '../../../src/game/entities/Dorian';
import { Onyx } from '../../../src/game/entities/Onyx';
import { Mortimer } from '../../../src/game/entities/Mortimer';
import { Grimshaw } from '../../../src/game/entities/Grimshaw';
import type { Enemy } from '../../../src/game/entities/Enemy';

const CAST: Array<{ name: string; make: (x: number, y: number, c: number) => Enemy }> = [
  { name: 'Velvet', make: (x, y, c) => new Velvet(x, y, c) },
  { name: 'Ember', make: (x, y, c) => new Ember(x, y, c) },
  { name: 'Rosalia', make: (x, y, c) => new Rosalia(x, y, c) },
  { name: 'Marionette', make: (x, y, c) => new Marionette(x, y, c) },
  { name: 'Dorian', make: (x, y, c) => new Dorian(x, y, c) },
  { name: 'Onyx', make: (x, y, c) => new Onyx(x, y, c) },
  { name: 'Mortimer', make: (x, y, c) => new Mortimer(x, y, c) },
  { name: 'Grimshaw', make: (x, y, c) => new Grimshaw(x, y, c) },
];

const SCALE = 5;
const CELL_W = 56 * SCALE;
const CELL_H = 46 * SCALE;

const canvas = document.getElementById('sheet') as HTMLCanvasElement;
canvas.width = 60 + 3 * (CELL_W + 30);
canvas.height = 50 + CAST.length * (CELL_H + 46);
const ctx = canvas.getContext('2d')!;
ctx.fillStyle = '#0b0b12';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#f4f2ed';
ctx.font = '700 22px system-ui, sans-serif';
ctx.fillText('the crimson court — baddies (idle / hunt / attack)', 20, 32);

const STATES = ['stalking', 'hunting you', 'attacking'] as const;
CAST.forEach((entry, row) => {
  const rowY = 50 + row * (CELL_H + 46);
  STATES.forEach((_, col) => {
    const e = entry.make(0, 0, 1);
    if (col === 1) { e.aiState = 'chase'; e.animTimer = 0.4; }
    if (col === 2) { e.aiState = 'attack'; e.animTimer = 0.25; if ('cycle' in e) (e as any).cycle = 0.35; if ('phase' in e) (e as any).phase = 'lunge'; if ('phaseTimer' in e) (e as any).phaseTimer = 0.13; if ('lungeTimer' in e) (e as any).lungeTimer = 0.2; }
    if (col === 0) { e.aiState = 'idle'; e.animTimer = 0.9; }
    e.onGround = entry.name !== 'Velvet';
    e.facingRight = false;
    ctx.save();
    ctx.translate(60 + col * (CELL_W + 30), rowY);
    ctx.scale(SCALE, SCALE);
    e.render(ctx, 0, 0);
    ctx.restore();
  });
  ctx.fillStyle = '#c7ff4d';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(entry.name, 20, rowY + CELL_H / 2);
});
STATES.forEach((label, col) => {
  ctx.fillStyle = '#c7ff4d';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(label, 60 + col * (CELL_W + 30) + 8, canvas.height - 10);
});
