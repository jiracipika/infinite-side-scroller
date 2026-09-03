import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveTumbleRotation,
  resolveTumbleArms,
} from '@/game/rendering/character-art';

describe('resolveTumbleRotation', () => {
  it('neutral pose resolves zero rotation (no spin on single jump)', () => {
    assert.equal(resolveTumbleRotation(1, 0), 0);
    assert.equal(resolveTumbleRotation(-1, 0), 0);
  });

  it('scales monotonically with pose intensity toward a half flip at peak', () => {
    const a = Math.abs(resolveTumbleRotation(1, 0.25));
    const b = Math.abs(resolveTumbleRotation(1, 0.5));
    const c = Math.abs(resolveTumbleRotation(1, 1));
    assert.ok(a < b, 'rotation grows with pose intensity');
    assert.ok(b < c, 'rotation grows with pose intensity (mid < peak)');
    assert.ok(Math.abs(c - Math.PI) < 1e-9, 'peak pose is a half flip (PI)');
  });

  it('mirrors with facing direction (forward flip both ways)', () => {
    assert.ok(
      Math.abs(resolveTumbleRotation(1, 0.5) + resolveTumbleRotation(-1, 0.5)) <
        1e-9,
      'facing left mirrors facing right',
    );
    assert.equal(resolveTumbleRotation(-1, 1), -Math.PI);
  });

  it('is deterministic and clamps out-of-range poses', () => {
    const wild = resolveTumbleRotation(1, 7);
    const peak = resolveTumbleRotation(1, 1);
    assert.ok(Math.abs(wild) <= Math.PI, 'rotation never exceeds a half flip');
    assert.equal(wild, peak);
    assert.equal(resolveTumbleRotation(1, 0.5), resolveTumbleRotation(1, 0.5));
  });
});

describe('resolveTumbleArms', () => {
  it('adds nothing at pose 0 (grounded and single-jump art unchanged)', () => {
    const arms = resolveTumbleArms(0);
    assert.equal(arms.frontArmDx, 0);
    assert.equal(arms.frontArmDy, 0);
    assert.equal(arms.rearArmDx, 0);
    assert.equal(arms.rearArmDy, 0);
  });

  it('lifts arms at mid-tumble and settles clean by pose 1', () => {
    const mid = resolveTumbleArms(0.5);
    assert.ok(mid.frontArmDy < 0, 'front arm lifts at mid-tumble');
    assert.ok(mid.rearArmDy < 0, 'rear arm lifts at mid-tumble');
    const end = resolveTumbleArms(1);
    assert.equal(end.frontArmDx, 0);
    assert.equal(end.frontArmDy, 0);
    assert.equal(end.rearArmDx, 0);
    assert.equal(end.rearArmDy, 0);
  });

  it('keeps arm offsets inside the sprite bounds and deterministic', () => {
    for (const pose of [0.2, 0.4, 0.6, 0.8]) {
      const arms = resolveTumbleArms(pose);
      for (const v of [
        arms.frontArmDx,
        arms.frontArmDy,
        arms.rearArmDx,
        arms.rearArmDy,
      ]) {
        assert.ok(Math.abs(v) <= 4, `offset ${v} stays within 4px`);
        assert.ok(Number.isInteger(v), 'offsets are integers (pixel art)');
      }
    }
    assert.deepEqual(resolveTumbleArms(0.4), resolveTumbleArms(0.4));
  });
});
