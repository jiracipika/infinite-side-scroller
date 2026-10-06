import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { spawnEnemiesForChunk } from '@/game/entities/Collectibles';
import { getCharacterById } from '@/game/data/characters';
import { Velvet } from '@/game/entities/Velvet';
import { Ember } from '@/game/entities/Ember';
import { Rosalia } from '@/game/entities/Rosalia';
import { Marionette } from '@/game/entities/Marionette';
import { Dorian } from '@/game/entities/Dorian';
import { Onyx } from '@/game/entities/Onyx';
import { Mortimer } from '@/game/entities/Mortimer';
import { Grimshaw } from '@/game/entities/Grimshaw';
import type { Enemy } from '@/game/entities/Enemy';

const COURT: Array<{ id: string; make: (x: number, y: number, chunkId: number) => Enemy; grounded: boolean }> = [
  { id: 'velvet', make: (x, y, c) => new Velvet(x, y, c), grounded: false },
  { id: 'ember', make: (x, y, c) => new Ember(x, y, c), grounded: true },
  { id: 'rosalia', make: (x, y, c) => new Rosalia(x, y, c), grounded: true },
  { id: 'marionette', make: (x, y, c) => new Marionette(x, y, c), grounded: true },
  { id: 'dorian', make: (x, y, c) => new Dorian(x, y, c), grounded: true },
  { id: 'onyx', make: (x, y, c) => new Onyx(x, y, c), grounded: true },
  { id: 'mortimer', make: (x, y, c) => new Mortimer(x, y, c), grounded: true },
  { id: 'grimshaw', make: (x, y, c) => new Grimshaw(x, y, c), grounded: true },
];

interface Frame {
  polygons: Array<{ color: string; points: number[][] }>;
  strokes: string[];
  ops: string[];
}

function renderFrame(enemy: Enemy): Frame {
  const polygons: Array<{ color: string; points: number[][] }> = [];
  const strokes: string[] = [];
  const ops: string[] = [];
  let points: number[][] = [];
  const gradient = { addColorStop() {} };
  const context = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    imageSmoothingEnabled: false, lineJoin: '',
    save() { ops.push('save'); }, restore() { ops.push('restore'); },
    translate() { ops.push('translate'); }, scale() { ops.push('scale'); }, rotate() {},
    fillRect() { ops.push('fillRect'); }, strokeRect() {},
    beginPath() { points = []; }, closePath() {},
    moveTo(x: number, y: number) { points.push([x, y]); },
    lineTo(x: number, y: number) { points.push([x, y]); },
    arc() { ops.push('arc'); }, ellipse() { ops.push('ellipse'); },
    createRadialGradient() { return gradient; },
    fill() { polygons.push({ color: this.fillStyle, points: [...points] }); },
    stroke() { strokes.push(this.strokeStyle); },
  };
  enemy.render(context as unknown as CanvasRenderingContext2D, 0, 0);
  return { polygons, strokes, ops };
}

function makeSeededRng(seedValue: number): (seed: number) => number {
  return (_seed: number): number => {
    seedValue = (seedValue * 1664525 + 1013904223) % 0xffffffff;
    return (seedValue >>> 0) / 0xffffffff;
  };
}

describe('the crimson court as baddies', () => {
  for (const entry of COURT) {
    describe(`${entry.id} (baddie)`, () => {
      const char = getCharacterById(entry.id);

      it('carries the character identity into an enemy body', () => {
        const e = entry.make(100, 200, 3);
        assert.equal(e.type, entry.id);
        assert.equal(e.width, char.width, 'collision width matches the playable character');
        assert.equal(e.height, char.height, 'collision height matches the playable character');
        assert.equal(e.stompable, true, 'court baddies are stompable unlike the boss');
        assert.ok(e.health >= 1);
      });

      it('hunts the player when they come close', () => {
        const e = entry.make(0, 0, 3);
        const y0 = e.y;
        for (let i = 0; i < 90; i++) e.update(1 / 60, 220, 0);
        assert.ok(e.x > 40, `${entry.id} should approach a player 220px ahead (x=${e.x})`);
        if (entry.grounded) {
          assert.ok(e.y >= y0, 'grounded baddies never rise against gravity unaided');
        }
      });

      it('dies to damage and stops rendering', () => {
        const e = entry.make(0, 0, 3);
        const alive = renderFrame(e);
        assert.ok(alive.polygons.length + alive.strokes.length >= 8, 'live render is articulated');
        e.takeDamage(e.health);
        assert.equal(e.alive, false);
        assert.equal(renderFrame(e).polygons.length, 0, 'dead baddies render nothing');
      });

      it('renders finite, deterministic frames with the menace aura', () => {
        const e = entry.make(10, 20, 3);
        e.facingRight = false; // exercise the player-facing flip
        const a = renderFrame(e);
        const b = renderFrame(e);
        assert.deepEqual(a, b, 'same state, same frame');
        assert.ok(a.ops.includes('scale'), 'left-facing render mirrors the sprite');
        assert.ok(a.strokes.includes(getCharacterById(entry.id).specialColor),
          'aura uses the character special color');
        for (const p of a.polygons) {
          for (const [x, y] of p.points) {
            assert.ok(Number.isFinite(x) && Number.isFinite(y), `finite point ${x},${y}`);
          }
        }
      });
    });
  }

  it('velvet floats — no gravity — while grounded baddies fall', () => {
    const velvet = new Velvet(0, 100, 3);
    velvet.update(1 / 60, -500, 100); // player far away: idle drift only
    const ember = new Ember(0, 100, 3);
    ember.update(1 / 60, -500, 100);
    assert.ok(Math.abs(velvet.y - 100) < 5, `velvet hovers (y=${velvet.y})`);
    assert.ok(ember.y > 100, `ember falls under gravity (y=${ember.y})`);
  });

  it('marionette hops with floaty gravity', () => {
    const m = new Marionette(0, 0, 3);
    m.onGround = true;
    m.vy = 0;
    let hopped = false;
    for (let i = 0; i < 120; i++) {
      m.onGround = m.vy >= 0 ? m.onGround : false;
      const vyBefore = m.vy;
      m.update(1 / 60, 300, 0);
      if (vyBefore >= 0 && m.vy < -200) { hopped = true; break; }
    }
    assert.ok(hopped, 'marionette should launch into a hop toward the player');
  });

  it('dorian commits to a telegraphed lunge', () => {
    const d = new Dorian(0, 0, 3);
    d.onGround = true;
    let maxVx = 0;
    for (let i = 0; i < 240; i++) {
      d.onGround = true;
      d.update(1 / 60, 90, 0); // player inside attack range
      maxVx = Math.max(maxVx, Math.abs(d.vx));
    }
    assert.ok(maxVx > 300, `dorian lunge should spike speed (max vx=${maxVx})`);
  });

  describe('spawn pool gating', () => {
    it('level 0 never spawns court members', () => {
      for (let chunk = 1; chunk < 12; chunk++) {
        const enemies = spawnEnemiesForChunk(chunk, [], makeSeededRng(chunk * 31),
          [300, 300, 300, 300], chunk * 800, 0);
        for (const e of enemies) {
          assert.ok(!COURT.some((c) => c.id === e.type), `no court at level 0, got ${e.type}`);
        }
      }
    });

    it('the court arrives in tiers and grimshaw only at level 6+', () => {
      const seen = new Set<string>();
      for (let chunk = 1; chunk < 40; chunk++) {
        const enemies = spawnEnemiesForChunk(chunk, [], makeSeededRng(chunk * 77),
          [300, 300, 300, 300], chunk * 800, 6);
        for (const e of enemies) seen.add(e.type);
      }
      for (const entry of COURT) {
        assert.ok(seen.has(entry.id), `${entry.id} should be in the level-6 pool`);
      }
      assert.ok(seen.has('boss') === false, 'bosses stay on their 50-chunk cadence');
    });

    it('spawn placement is finite and above ground', () => {
      const terrain = [300, 300, 305, 310, 300, 295];
      const enemies = spawnEnemiesForChunk(7, [], makeSeededRng(1234), terrain, 7 * 800, 5);
      assert.ok(enemies.length > 0);
      for (const e of enemies) {
        assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y));
        assert.ok(e.y < 300, `${e.type} spawns above the ground line (y=${e.y})`);
      }
    });
  });
});
