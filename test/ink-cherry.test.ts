import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, getCharacterById } from '@/game/data/characters';
import { drawCharacterArt, type CharacterArtPose } from '@/game/rendering/character-art';
import { Player } from '@/game/entities/player';

function paint(pose: CharacterArtPose = {}, width = 22, height = 32) {
  const polygons: Array<{ color: string; points: number[][] }> = [];
  const strokes: string[] = [];
  let points: number[][] = [];
  let depth = 0;
  const context = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    save() { depth++; }, restore() { depth--; },
    translate() {}, rotate() {}, fillRect() {}, strokeRect() {},
    beginPath() { points = []; }, closePath() {},
    moveTo(x: number, y: number) { points.push([x, y]); },
    lineTo(x: number, y: number) { points.push([x, y]); },
    fill() { polygons.push({ color: this.fillStyle, points: [...points] }); }, stroke() { strokes.push(this.strokeStyle); },
  };
  const cherry = getCharacterById('cherry');
  drawCharacterArt(context as unknown as CanvasRenderingContext2D, cherry, width, height, pose);
  return { polygons, depth, strokes };
}

describe('graphic-novel cherry shared art', () => {
  it('keeps cherry red in fills — never a closed contour around limbs', () => {
    const { strokes } = paint();
    assert.ok(!strokes.includes('#e5304a'), 'cherry belongs to hair/canopy/charm fills, not limb outlines');
    assert.ok(!strokes.includes('#ff5d73'), 'eye red stays a fill accent too');
  });

  it('renders articulated anatomy: trailing twin-tails and a front parasol canopy', () => {
    const { polygons, depth } = paint();
    assert.ok(polygons.length >= 10, 'silhouette is articulated polygons');
    assert.ok(
      polygons.some(p => p.color === '#e5304a' && p.points.some(([x]) => x < 0)),
      'twin-tails stream back behind the collision box',
    );
    assert.ok(
      polygons.some(p => p.color === '#e5304a' && p.points.some(([x]) => x > 21)),
      'closed parasol canopy rides in front of the box',
    );
    assert.equal(depth, 0, 'canvas state balanced');
  });

  it('opens the running stance horizontally instead of only shortening straight legs', () => {
    const lower = (pose: CharacterArtPose) => paint(pose).polygons
      .filter(p => p.color === '#141019')
      .flatMap(p => p.points.filter(([, y]) => y > 28).map(([x]) => x));
    const idle = lower({});
    const run = lower({ stride: 2 });
    assert.ok(Math.max(...run) - Math.min(...run) > Math.max(...idle) - Math.min(...idle) + 2,
      'running must widen the ink leg stance with bent knees');
  });

  it('keeps airborne, stride and attack poses alive in the renderer', () => {
    const rest = paint().polygons;
    for (const pose of [{ airborne: true }, { stride: 2 }, { melee: .5 }, { dashing: true }]) {
      assert.notDeepEqual(paint(pose).polygons, rest, JSON.stringify(pose));
    }
  });

  it('retains parasol articulation on top of jump and dash poses', () => {
    for (const base of [{ airborne: true }, { dashing: true }, { airborne: true, dashing: true }]) {
      assert.notDeepEqual(paint({ ...base, melee: .5 }).polygons, paint(base).polygons,
        `melee must not disappear in ${JSON.stringify(base)}`);
    }
  });

  it('the parasol actually swings: melee canopy reaches past the rest pose', () => {
    const restFront = paint().polygons
      .filter(p => p.color === '#e5304a')
      .flatMap(p => p.points.map(([x]) => x));
    const swingFront = paint({ melee: .5 }).polygons
      .filter(p => p.color === '#e5304a')
      .flatMap(p => p.points.map(([x]) => x));
    assert.ok(Math.max(...swingFront) > Math.max(...restFront) + 2,
      'the canopy sweeps forward through the bonk arc');
  });

  it('stays finite, opaque and bounded at the actual gameplay size in every pose', () => {
    const cherry = getCharacterById('cherry');
    const { width, height } = cherry;
    for (const pose of [{}, { stride: -2.5 }, { stride: 2.5 }, { airborne: true },
      { dashing: true }, { airborne: true, dashing: true }, { melee: .5 },
      { airborne: true, tumble: .5 }, { airborne: true, tumble: 1 }]) {
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

  it('still reads at the character-select chip size', () => {
    // CharacterSprite renders a 28×28 idle portrait for the roster grid.
    const frame = paint({}, 28, 28);
    assert.equal(frame.depth, 0);
    assert.ok(frame.polygons.some(p => p.color === '#e5304a' && p.points.some(([x]) => x < 0)),
      'tails survive the chip render');
    assert.ok(frame.polygons.some(p => p.color === '#e5304a' && p.points.some(([x]) => x > 24)),
      'parasol canopy survives the chip render');
    for (const p of frame.polygons) for (const [x, y] of p.points) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      assert.ok(x >= -42 && x <= 42 && y >= -6 && y <= 31, `chip overflow at ${x},${y}`);
    }
  });
});

describe('cherry roster entry', () => {
  it('is a unique mid-tier unlock with a parasol melee kit', () => {
    const ids = CHARACTERS.map(c => c.id);
    assert.equal(ids.filter(id => id === 'cherry').length, 1);
    const cherry = getCharacterById('cherry');
    assert.equal(cherry.name, 'Cherry');
    assert.equal(cherry.hasMelee, true, 'parasol bonks are her melee');
    assert.equal(cherry.meleeDamage, 1, 'quick light bonks, ninja-tier damage');
    assert.ok(cherry.unlockCost > 0, 'unlocked via the coin shop');
    assert.equal(cherry.specialName, 'Cherry Bomb');
    assert.equal(cherry.specialColor, '#e5304a');
  });

  it('slots between ninja and knight: faster than knight, sturdier than ninja', () => {
    const cherry = getCharacterById('cherry');
    const knight = getCharacterById('knight');
    const ninja = getCharacterById('ninja');
    assert.ok(cherry.speed > knight.speed && cherry.speed < ninja.speed);
    assert.ok(cherry.maxHealth > ninja.maxHealth && cherry.maxHealth <= knight.maxHealth);
  });

  it('starts with an innate double jump like the other floaty archetypes', () => {
    const cherry = new Player();
    cherry.applyCharacter(getCharacterById('cherry'));
    assert.equal(cherry.canDoubleJump, true, 'cherry floats on her parasol from frame one');
    assert.equal(cherry.meleeEnabled, true);

    const knight = new Player();
    knight.applyCharacter(getCharacterById('knight'));
    assert.equal(knight.canDoubleJump, false, 'contrast: knight still needs the pickup');
  });
});
