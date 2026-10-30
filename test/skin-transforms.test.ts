import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FULL_ART_RIGS, bindVertex, deformVertex, resolveRigPose, resolveSkinTransforms } from '../src/game/rendering/fullart-rig';

describe('shared skin transforms retain the original artwork deformation', () => {
  for (const [id, rig] of Object.entries(FULL_ART_RIGS)) {
    it(`${id}: matches the original per-vertex solver across movement and combat`, () => {
      const aspect = .72, rest = resolveRigPose(rig, aspect, {}).bones;
      const poses = [{}, { moving: true, phase: .13, speedRatio: 1.3 }, { moving: true, phase: .73, speedRatio: .6 },
        { airborne: true, verticalVelocity: -520, launch: 1 }, { airborne: true, verticalVelocity: 400 },
        { land: .7 }, { dashing: true }, { melee: .45 }, { ranged: .7 }, { time: 1.4 }];
      for (let y = 0; y <= 1; y += .1) for (let x = 0; x <= 1; x += .1) {
        const vertex = bindVertex(rig, aspect, [x, y], rest);
        assert.deepEqual(vertex, bindVertex(rig, aspect, [x, y]), 'shared rest skeleton retains every skin weight');
        for (const pose of poses) {
          const resolved = resolveRigPose(rig, aspect, pose);
          const reference = deformVertex(vertex, resolved);
          const optimized = deformVertex(vertex, resolved, resolveSkinTransforms(resolved));
          assert.deepEqual(optimized, reference, 'batch transforms retain identical coordinates');
        }
      }
    });
  }
});
