import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CHARACTERS, getCharacterById } from '@/game/data/characters';
import { drawCharacterArt, type CharacterArtPose } from '@/game/rendering/character-art';

const UPLIFTED = ['tank', 'mage', 'ranger', 'cyborg', 'spirit', 'healer'] as const;

const ROSTER_SRC = readFileSync(new URL('../src/game/rendering/ink-roster.ts', import.meta.url), 'utf8');

interface PaintResult {
  polygons: Array<{ color: string; points: number[][] }>;
  strokes: string[];
  depth: number;
  alpha: number;
}

function paint(characterId: string, pose: CharacterArtPose = {}, width?: number, height?: number): PaintResult {
  const polygons: Array<{ color: string; points: number[][] }> = [];
  const strokes: string[] = [];
  let points: number[][] = [];
  let depth = 0;
  let alpha = 1;
  const context = {
    fillStyle: '', strokeStyle: '', lineWidth: 1,
    get globalAlpha() { return alpha; },
    set globalAlpha(v: number) { alpha = v; },
    save() { depth++; }, restore() { depth--; },
    translate() {}, rotate() {}, fillRect() {}, strokeRect() {},
    beginPath() { points = []; }, closePath() {},
    moveTo(x: number, y: number) { points.push([x, y]); },
    lineTo(x: number, y: number) { points.push([x, y]); },
    arc(x: number, y: number) { points.push([x, y]); },
    fill() { polygons.push({ color: this.fillStyle, points: [...points] }); },
    stroke() { strokes.push(this.strokeStyle); },
  };
  const char = getCharacterById(characterId);
  drawCharacterArt(
    context as unknown as CanvasRenderingContext2D,
    char,
    width ?? char.width,
    height ?? char.height,
    pose,
  );
  return { polygons, strokes, depth, alpha };
}

describe('roster uplift — bespoke ink anatomy for the shared-body six', () => {
  for (const id of UPLIFTED) {
    describe(`${id}`, () => {
      const char = getCharacterById(id);
      const { width, height } = char;

      it('is dispatched to bespoke art, articulated well past a rect body', () => {
        const frame = paint(id);
        assert.ok(frame.polygons.length >= 10, `expected ≥10 articulated polygons, got ${frame.polygons.length}`);
        assert.equal(frame.depth, 0, 'canvas state balanced');
      });

      it('keeps airborne, stride, dash and melee poses alive', () => {
        const rest = paint(id).polygons;
        for (const pose of [{ airborne: true }, { stride: 2 }, { dashing: true }, { melee: .5 }]) {
          assert.notDeepEqual(paint(id, pose).polygons, rest, JSON.stringify(pose));
        }
      });

      it('retains attack articulation layered over jump and dash', () => {
        for (const base of [{ airborne: true }, { dashing: true }, { airborne: true, dashing: true }]) {
          assert.notDeepEqual(paint(id, { ...base, melee: .5 }).polygons, paint(id, base).polygons,
            `melee must not disappear in ${JSON.stringify(base)}`);
        }
      });

      it('stays finite, opaque, bounded and deterministic at the gameplay size', () => {
        for (const pose of [{}, { stride: -2.5 }, { stride: 2.5 }, { airborne: true },
          { dashing: true }, { airborne: true, dashing: true }, { melee: .5 },
          { airborne: true, tumble: .5 }, { airborne: true, tumble: 1 }]) {
          const frame = paint(id, pose, width, height);
          assert.deepEqual(frame, paint(id, pose, width, height), JSON.stringify(pose));
          assert.equal(frame.depth, 0);
          for (const p of frame.polygons) {
            assert.match(p.color, /^(#[0-9a-f]{6}|rgba?\()/i, `color ${p.color}`);
            for (const [x, y] of p.points) {
              assert.ok(Number.isFinite(x) && Number.isFinite(y));
              assert.ok(x >= -width * 1.6 && x <= width * 1.6, `x=${x}`);
              assert.ok(y >= -height * 0.25 && y <= height * 1.12, `y=${y} in ${id}`);
            }
          }
        }
      });

      it('still reads at the 28px character-select chip', () => {
        const frame = paint(id, {}, 28, 28);
        assert.equal(frame.depth, 0);
        assert.ok(frame.polygons.length >= 6, 'chip render keeps the anatomy');
        for (const p of frame.polygons) for (const [x, y] of p.points) {
          assert.ok(Number.isFinite(x) && Number.isFinite(y));
          assert.ok(x >= -45 && x <= 45 && y >= -8 && y <= 34, `chip overflow ${x},${y} in ${id}`);
        }
      });
    });
  }

  it('spirit returns globalAlpha to 1 (translucency never leaks to the next draw)', () => {
    for (const pose of [{}, { dashing: true }, { melee: .5 }, { stride: 2.4 }]) {
      assert.equal(paint('spirit', pose).alpha, 1, JSON.stringify(pose));
    }
  });

  it('every roster id has bespoke art — the shared rect body has no more users', () => {
    const dispatched = new Set([...CHARACTERS.map((c) => c.id)]);
    for (const id of dispatched) {
      const frame = paint(id);
      // The shared body path draws exactly two flat torso rects; bespoke art
      // is always denser.
      assert.ok(frame.polygons.length >= 8, `${id} still renders through the shared rect body`);
    }
  });

  it('identity anchors stay pinned in the roster art source', () => {
    assert.match(ROSTER_SRC, /ember = '#f97316'/, 'tank visor ember');
    assert.match(ROSTER_SRC, /rune = '#fde68a'/, 'mage star rune');
    assert.match(ROSTER_SRC, /leaf = '#4ade80'/, 'ranger eye leaf');
    assert.match(ROSTER_SRC, /cyan = '#22d3ee'/, 'cyborg visor cyan');
    assert.match(ROSTER_SRC, /ctx\.globalAlpha = 0\.62/, 'spirit spectral tail translucency');
    assert.match(ROSTER_SRC, /mint = '#5eead4'/, 'healer lantern mint');
  });
});
