import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '@/game/data/characters';
import { drawCharacterArt, type CharacterArtPose } from '@/game/rendering/character-art';

function paint(pose: CharacterArtPose = {}) {
  const polygons: Array<{ color: string; points: number[][] }> = [];
  let points: number[][] = [];
  let depth = 0;
  const context = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    save() { depth++; }, restore() { depth--; },
    translate() {}, rotate() {}, fillRect() {}, strokeRect() {},
    beginPath() { points = []; }, closePath() {},
    moveTo(x: number,y: number) { points.push([x,y]); },
    lineTo(x: number,y: number) { points.push([x,y]); },
    fill() { polygons.push({ color: this.fillStyle, points: [...points] }); }, stroke() {},
  };
  const knight = CHARACTERS.find(c => c.id === 'knight')!;
  drawCharacterArt(context as unknown as CanvasRenderingContext2D, knight, 24, 38, pose);
  return { polygons, depth };
}

describe('graphic-novel knight shared art', () => {
  it('renders angular ink anatomy and a violet cape rather than a boxed pixel sprite', () => {
    const { polygons, depth } = paint();
    assert.ok(polygons.length >= 8, 'silhouette is articulated polygons');
    assert.ok(polygons.some(p => p.color === '#754294' && p.points.some(([x]) => x < 0)), 'violet cape trails behind the collision box');
    assert.equal(depth, 0, 'canvas state balanced');
  });
  it('keeps airborne, stride and attack poses alive in the new renderer', () => {
    const rest = paint().polygons;
    for (const pose of [{airborne: true}, {stride: 2}, {melee: .5}, {dashing: true}]) {
      assert.notDeepEqual(paint(pose).polygons, rest, JSON.stringify(pose));
    }
  });
  it('is deterministic and keeps decorative geometry close to the hitbox', () => {
    assert.deepEqual(paint({stride: 1}), paint({stride: 1}));
    for (const p of paint().polygons) for (const [x,y] of p.points) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      assert.ok(x >= -42 && x <= 36 && y >= -6 && y <= 41);
    }
  });
});
