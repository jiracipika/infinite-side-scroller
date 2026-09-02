import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  characterLegAnchorY,
  resolveLegPose,
  type CharacterLegPose,
} from '@/game/rendering/character-art';

describe('resolveLegPose', () => {
  const W = 24;
  const H = 38;

  it('ground pose plants both boots on the same baseline when stride is 0', () => {
    const legs = resolveLegPose(W, H, { stride: 0 });
    assert.equal(legs.airborne, false);
    assert.equal(legs.rearBootY, H - 3);
    assert.equal(legs.frontBootY, H - 3);
  });

  it('ground pose swaps leg lengths with stride (front reaches, rear trails)', () => {
    const forward = resolveLegPose(W, H, { stride: 2.4 });
    const back = resolveLegPose(W, H, { stride: -2.4 });
    assert.ok(forward.rearLegH > forward.frontLegH, 'positive stride lengthens rear leg');
    assert.ok(back.frontLegH > back.rearLegH, 'negative stride lengthens front leg');
  });

  it('stride is clamped so leg geometry stays inside the collision box', () => {
    const wild = resolveLegPose(W, H, { stride: 99 });
    const calm = resolveLegPose(W, H, { stride: 2.5 });
    assert.equal(wild.rearLegH, calm.rearLegH);
    assert.equal(wild.frontLegH, calm.frontLegH);
    // Boot baseline never drops more than the clamp below the box.
    assert.ok(wild.rearBootY <= H - 3 + 2.5 + 0.01);
  });

  it('airborne pose tucks the rear leg shorter than any ground pose', () => {
    const air = resolveLegPose(W, H, { airborne: true });
    const ground = resolveLegPose(W, H, { stride: 0 });
    assert.equal(air.airborne, true);
    assert.ok(air.rearLegH < ground.rearLegH, 'rear leg tucks up mid-air');
    assert.ok(air.rearLegY <= ground.rearLegY, 'tucked leg attaches slightly higher');
  });

  it('airborne pose extends the front leg longer than any ground pose', () => {
    const air = resolveLegPose(W, H, { airborne: true });
    const ground = resolveLegPose(W, H, { stride: 0 });
    assert.ok(air.frontLegH > ground.frontLegH, 'front leg reaches forward mid-air');
  });

  it('airborne boots ride up with the tucked/extended legs instead of planting', () => {
    const air = resolveLegPose(W, H, { airborne: true });
    assert.ok(
      air.rearBootY < H - 3,
      'rear boot is raised off the ground baseline mid-air',
    );
  });

  it('returns a complete pose object for every input', () => {
    const legs: CharacterLegPose = resolveLegPose(W, H, {});
    for (const key of [
      'rearLegX', 'rearLegY', 'rearLegH',
      'frontLegX', 'frontLegY', 'frontLegH',
      'rearBootX', 'rearBootY',
      'frontBootX', 'frontBootY',
    ] as const) {
      assert.equal(typeof legs[key], 'number', `${key} must be a number`);
      assert.ok(Number.isFinite(legs[key]), `${key} must be finite`);
    }
  });

  it('leg anchor matches the torso block for short and tall characters', () => {
    // torsoY(15) + torsoH(max(10, h-25)) - 1
    assert.equal(characterLegAnchorY(30), 15 + 10 - 1);
    assert.equal(characterLegAnchorY(48), 15 + 23 - 1);
  });
});
