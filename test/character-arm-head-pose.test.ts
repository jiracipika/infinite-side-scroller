import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveArmPose,
  resolveHeadPose,
  characterLegAnchorY,
  type CharacterArmPose,
  type CharacterHeadPose,
} from '@/game/rendering/character-art';

/**
 * Sprite geometry reference (local space, collision-box origin):
 *   torsoY = 15 → arm base Y = 17
 *   armLen  = min(10, max(10, height - 25))
 */
describe('resolveArmPose', () => {
  const W = 24;
  const H = 38;
  const BASE_Y = 17;
  const ARM_LEN = 10;

  it('idle ground pose plants both arms at the torso with equal length', () => {
    const arms = resolveArmPose(W, H, { stride: 0 });
    assert.equal(arms.rearArmX, 0);
    assert.equal(arms.frontArmX, W - 4);
    assert.equal(arms.rearArmY, BASE_Y);
    assert.equal(arms.frontArmY, BASE_Y);
    assert.equal(arms.rearArmH, ARM_LEN);
    assert.equal(arms.frontArmH, ARM_LEN);
  });

  it('running arms swing opposite the legs (cross-phase with stride)', () => {
    const fwd = resolveArmPose(W, H, { stride: 2.4 });
    assert.ok(fwd.rearArmY < BASE_Y, 'rear arm swings up when rear leg extends');
    assert.ok(fwd.frontArmY > BASE_Y, 'front arm swings down when rear leg extends');
    const back = resolveArmPose(W, H, { stride: -2.4 });
    assert.ok(back.rearArmY > BASE_Y, 'phase flips with stride sign');
    assert.ok(back.frontArmY < BASE_Y);
  });

  it('arm swing stays inside the torso band', () => {
    const wild = resolveArmPose(W, H, { stride: 99 });
    assert.ok(wild.rearArmY >= 15, 'arm never rises above torso top');
    assert.ok(wild.frontArmY + wild.frontArmH <= 15 + Math.max(10, H - 25) + 2);
  });

  it('airborne raises both arms above the ground baseline', () => {
    const air = resolveArmPose(W, H, { airborne: true });
    const ground = resolveArmPose(W, H, { stride: 0 });
    assert.ok(air.rearArmY < ground.rearArmY, 'rear arm lifts');
    assert.ok(air.frontArmY <= ground.frontArmY, 'front arm lifts');
    assert.ok(air.frontArmH < ground.frontArmH, 'raised arm reads shorter');
  });

  it('airborne arms are asymmetric (front reaches higher than rear)', () => {
    const air = resolveArmPose(W, H, { airborne: true });
    assert.ok(air.frontArmY < air.rearArmY);
  });

  it('dashing sweeps arms back and compresses them', () => {
    const dash = resolveArmPose(W, H, { dashing: true });
    const ground = resolveArmPose(W, H, {});
    assert.ok(dash.rearArmX < ground.rearArmX, 'rear arm trails behind body edge');
    assert.ok(dash.frontArmX < ground.frontArmX, 'front arm sweeps back');
    assert.ok(dash.rearArmH < ARM_LEN, 'streaming arms read shorter');
  });

  it('melee thrust peaks mid-swing (front arm up + short) and relaxes at ends', () => {
    const rest = resolveArmPose(W, H, { melee: 0 });
    const peak = resolveArmPose(W, H, { melee: 0.5 });
    const done = resolveArmPose(W, H, { melee: 0.95 });
    assert.ok(peak.frontArmY < rest.frontArmY, 'front arm rises at thrust peak');
    assert.ok(peak.frontArmH < rest.frontArmH, 'thrust arm reads extended up');
    assert.ok(done.frontArmY > peak.frontArmY, 'arm relaxes after the peak');
  });

  it('returns a complete pose object for every input', () => {
    const arms: CharacterArmPose = resolveArmPose(W, H, {});
    for (const key of [
      'rearArmX', 'rearArmY', 'rearArmH',
      'frontArmX', 'frontArmY', 'frontArmH',
    ] as const) {
      assert.equal(typeof arms[key], 'number', `${key} must be a number`);
      assert.ok(Number.isFinite(arms[key]), `${key} must be finite`);
    }
  });

  it('leg anchor helper still matches the torso block (regression guard)', () => {
    assert.equal(characterLegAnchorY(38), 15 + 13 - 1);
  });
});

describe('resolveHeadPose', () => {
  const W = 24;

  it('idle head is neutral', () => {
    const head = resolveHeadPose(W, { stride: 0 });
    assert.equal(head.offsetX, 0);
    assert.equal(head.offsetY, 0);
  });

  it('head bobs 1px down at stride extremes (|stride| > 1.2)', () => {
    const bob = resolveHeadPose(W, { stride: 2.4 });
    assert.equal(bob.offsetY, 1);
    assert.equal(bob.offsetX, 0);
  });

  it('small stride sway does not bob the head', () => {
    const still = resolveHeadPose(W, { stride: 0.35 });
    assert.equal(still.offsetY, 0);
  });

  it('airborne head lifts and leans forward', () => {
    const head = resolveHeadPose(W, { airborne: true });
    assert.equal(head.offsetY, -1);
    assert.equal(head.offsetX, 1);
  });

  it('dashing head leans forward and crouches', () => {
    const head = resolveHeadPose(W, { dashing: true });
    assert.equal(head.offsetX, 1);
    assert.equal(head.offsetY, 1);
  });

  it('melee thrust leans the head into the swing', () => {
    const head = resolveHeadPose(W, { melee: 0.5 });
    assert.equal(head.offsetX, 1);
  });

  it('returns a complete pose object and stays within 1px bounds', () => {
    const head: CharacterHeadPose = resolveHeadPose(W, {
      stride: 5, airborne: true, dashing: true, melee: 0.5,
    });
    for (const key of ['offsetX', 'offsetY'] as const) {
      assert.equal(typeof head[key], 'number');
      assert.ok(Math.abs(head[key]) <= 1, `${key} must stay within 1px`);
    }
  });
});
