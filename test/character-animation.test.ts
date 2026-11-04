import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { characterAnimationFrame } from '../src/game/rendering/character-animation';

describe('authored character animation playback', () => {
  it('alternates contact and passing poses without idle flashes', () => {
    assert.deepEqual([0, .35, .5, .9, 1].map(phase => characterAnimationFrame({ moving: true, phase, stride: 0 })), [0, 1, 2, 3, 0]);
    assert.equal(characterAnimationFrame({ moving: false, stride: 2 }), 4);
  });
  it('holds the same pose when the simulation is paused', () => {
    assert.equal(characterAnimationFrame({ moving: true, phase: .6, time: 1 }), characterAnimationFrame({ moving: true, phase: .6, time: 100 }));
  });
  it('shows rise, fall, landing, dash and three attack phases', () => {
    assert.equal(characterAnimationFrame({ airborne: true, verticalVelocity: -20 }), 5);
    assert.equal(characterAnimationFrame({ airborne: true, verticalVelocity: 20 }), 6);
    assert.equal(characterAnimationFrame({ land: .7, moving: true }), 7);
    assert.equal(characterAnimationFrame({ dashing: true, airborne: true }), 8);
    for (const action of ['melee', 'ranged']) {
      assert.deepEqual([.1, .35, .8].map(progress => characterAnimationFrame({ [action]: progress, moving: true })), [9, 10, 11]);
    }
  });
});
