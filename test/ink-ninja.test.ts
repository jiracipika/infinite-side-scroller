import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '@/game/data/characters';
import { drawCharacterArt, type CharacterArtPose } from '@/game/rendering/character-art';

function paint(pose: CharacterArtPose = {}, width = 24, height = 38) {
  const polygons: Array<{ color: string; points: number[][] }> = [];
  const strokes: string[] = [];
  let points: number[][] = [];
  let depth = 0;
  const context = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    save() { depth++; }, restore() { depth--; },
    translate() {}, rotate() {}, fillRect() {}, strokeRect() {},
    beginPath() { points = []; }, closePath() {},
    moveTo(x: number,y: number) { points.push([x,y]); },
    lineTo(x: number,y: number) { points.push([x,y]); },
    fill() { polygons.push({ color: this.fillStyle, points: [...points] }); }, stroke() { strokes.push(this.strokeStyle); },
  };
  const ninja = CHARACTERS.find(c => c.id === 'ninja')!;
  drawCharacterArt(context as unknown as CanvasRenderingContext2D, ninja, width, height, pose);
  return { polygons, depth, strokes };
}

describe('graphic-novel ninja shared art', () => {
  it('uses ink anatomy rather than tracing every limb in lime', () => {
    const { strokes } = paint();
    assert.ok(!strokes.includes('#c7ff4d'), 'lime belongs to eyes/scarf, not a closed contour around every limb');
  });
  it('renders angular ink anatomy and a lime scarf rather than a boxed pixel sprite', () => {
    const { polygons, depth } = paint();
    assert.ok(polygons.length >= 8, 'silhouette is articulated polygons');
    assert.ok(polygons.some(p => p.color === '#c7ff4d' && p.points.some(([x]) => x < 0)), 'lime scarf trails behind the collision box');
    assert.equal(depth, 0, 'canvas state balanced');
  });
  it('opens the running stance horizontally instead of only shortening straight legs', () => {
    const lower = (pose: CharacterArtPose) => paint(pose).polygons
      .filter(p => p.color === '#0a0a0f')
      .flatMap(p => p.points.filter(([, y]) => y > 28).map(([x]) => x));
    const idle = lower({});
    const run = lower({ stride: 2 });
    assert.ok(Math.max(...run) - Math.min(...run) > Math.max(...idle) - Math.min(...idle) + 2,
      'running must widen the ink leg stance with bent knees');
  });
  it('keeps airborne, stride and attack poses alive in the new renderer', () => {
    const rest = paint().polygons;
    for (const pose of [{airborne: true}, {stride: 2}, {melee: .5}, {dashing: true}]) {
      assert.notDeepEqual(paint(pose).polygons, rest, JSON.stringify(pose));
    }
  });
  it('retains melee articulation on top of jump and dash poses', () => {
    for (const base of [{airborne: true}, {dashing: true}, {airborne: true, dashing: true}]) {
      assert.notDeepEqual(paint({...base, melee: .5}).polygons, paint(base).polygons,
        `melee must not disappear in ${JSON.stringify(base)}`);
    }
  });
  it('stays finite, opaque and bounded at the actual gameplay size in every pose', () => {
    const ninja = CHARACTERS.find(c => c.id === 'ninja')!;
    const { width, height } = ninja;
    for (const pose of [{}, {stride: -2.5}, {stride: 2.5}, {airborne: true},
      {dashing: true}, {airborne: true, dashing: true}, {melee: .5},
      {airborne: true, tumble: .5}, {airborne: true, tumble: 1}]) {
      const frame = paint(pose, width, height);
      assert.deepEqual(frame, paint(pose, width, height));
      assert.equal(frame.depth, 0);
      for (const p of frame.polygons) {
        assert.match(p.color, /^#[0-9a-f]{6}$/i);
        for (const [x, y] of p.points) {
          assert.ok(Number.isFinite(x) && Number.isFinite(y));
          assert.ok(x >= -width * 1.5 && x <= width * 1.5, `x=${x}`);
          assert.ok(y >= -height * .2 && y <= height * 1.1, `y=${y}`);
        }
      }
    }
  });
  it('is deterministic and keeps decorative geometry close to the hitbox', () => {
    assert.deepEqual(paint({stride: 1}), paint({stride: 1}));
    for (const p of paint().polygons) for (const [x,y] of p.points) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      assert.ok(x >= -30 && x <= 36 && y >= -6 && y <= 41);
    }
  });
});
