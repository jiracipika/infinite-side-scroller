import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceCharacterMotion,
  createCharacterMotion,
  LAUNCH_TIME,
  LAND_TIME,
  RUN_SPEED_REFERENCE,
} from '@/game/rendering/character-motion';
import { resolveSpringScale } from '@/game/rendering/character-art';

const baseInput = {
  x: 0, width: 24, onGround: true, dashing: false, vy: 0,
  melee: 0, ranged: 0, tumble: 0,
};

type Motion = ReturnType<typeof advanceCharacterMotion>;

/** Advance in simulation-sized steps (dt is clamped to 0.1s inside the solver). */
function settle(motion: Motion, inputOverrides: object, from: number, to: number): Motion {
  let m = motion;
  for (let t = from + 0.05; t < to + 1e-9; t += 0.05) {
    m = advanceCharacterMotion(m.state, { ...baseInput, ...inputOverrides, x: m.state.x } as never, t);
  }
  return m;
}

describe('takeoff and landing impulses', () => {
  it('fires a takeoff stretch on a real jump (ground → air with upward velocity)', () => {
    let motion = { state: createCharacterMotion(0, 0), pose: {}, bob: 0 };
    motion = advanceCharacterMotion(motion.state, baseInput, 0.016);
    const jumped = advanceCharacterMotion(
      motion.state,
      { ...baseInput, x: 5, onGround: false, vy: -520 },
      0.032,
    );
    assert.equal(jumped.state.launch, 1, 'launch impulse starts at full intensity');
    assert.ok(jumped.pose.launch === 1);
  });

  it('does not stretch when walking off a ledge (vy ≈ 0 at the moment of leaving)', () => {
    let motion = advanceCharacterMotion(createCharacterMotion(0, 0), baseInput, 0.016);
    motion = advanceCharacterMotion(
      motion.state,
      { ...baseInput, x: 5, onGround: false, vy: 0 },
      0.032,
    );
    assert.equal(motion.state.launch, 0);
  });

  it('launch decays to zero over LAUNCH_TIME and never goes negative', () => {
    let motion = advanceCharacterMotion(
      createCharacterMotion(0, 0),
      { ...baseInput, onGround: false, vy: -520 },
      0.016,
    );
    motion = advanceCharacterMotion(
      motion.state,
      { ...baseInput, x: 5, onGround: false, vy: -200 },
      0.016 + LAUNCH_TIME * 0.5,
    );
    assert.ok(motion.state.launch > 0 && motion.state.launch < 1, 'half-decayed');
    motion = settle(motion, { onGround: false, vy: -100 }, 0.016 + LAUNCH_TIME * 0.5, 0.016 + LAUNCH_TIME * 2);
    assert.equal(motion.state.launch, 0);
  });

  it('fires a landing squash scaled by impact speed with a visible floor', () => {
    let motion = advanceCharacterMotion(
      createCharacterMotion(0, 0),
      { ...baseInput, onGround: false, vy: -520 },
      0.016,
    );
    const soft = advanceCharacterMotion(
      motion.state,
      { ...baseInput, x: 5, onGround: true, vy: 0, landingVy: 90 },
      0.032,
    );
    const medium = advanceCharacterMotion(
      motion.state,
      { ...baseInput, x: 5, onGround: true, vy: 0, landingVy: 260 },
      0.032,
    );
    const hard = advanceCharacterMotion(
      motion.state,
      { ...baseInput, x: 5, onGround: true, vy: 0, landingVy: 700 },
      0.032,
    );
    assert.equal(soft.state.land, 0.35, 'grazes get the visible-squash floor');
    assert.ok(Math.abs(medium.state.land - 0.5) < 1e-9, 'mid impacts scale linearly');
    assert.equal(hard.state.land, 1, 'huge impacts clamp at 1');
  });

  it('landing squash decays to zero over LAND_TIME', () => {
    let motion = advanceCharacterMotion(
      createCharacterMotion(0, 0),
      { ...baseInput, onGround: false, vy: -520 },
      0.016,
    );
    motion = advanceCharacterMotion(
      motion.state,
      { ...baseInput, x: 5, onGround: true, vy: 0, landingVy: 520 },
      0.032,
    );
    assert.equal(motion.state.land, 1);
    motion = settle(motion, { onGround: true, vy: 0 }, 0.032, 0.032 + LAND_TIME * 2);
    assert.equal(motion.state.land, 0);
  });

  it('reduced motion zeroes both impulses in the pose', () => {
    let motion = advanceCharacterMotion(
      createCharacterMotion(0, 0),
      { ...baseInput, onGround: false, vy: -520 },
      0.016,
    );
    motion = advanceCharacterMotion(
      motion.state,
      { ...baseInput, x: 5, onGround: false, vy: -300 },
      0.032,
      true,
    );
    assert.equal(motion.pose.launch, 0);
    assert.equal(motion.pose.land, 0);
  });
});

describe('gait cadence and speed', () => {
  it('advances one full cycle per ~3.4 body widths of ground travel', () => {
    let motion = advanceCharacterMotion(createCharacterMotion(0, 0), baseInput, 0.016);
    const width = 24;
    const cycleLength = Math.max(88, width * 3.4);
    motion = advanceCharacterMotion(
      motion.state,
      { ...baseInput, x: RUN_SPEED_REFERENCE * 0.016, vy: 0 },
      0.032,
    );
    const expected = (RUN_SPEED_REFERENCE * 0.016) / cycleLength;
    assert.ok(Math.abs(motion.state.phase - expected) < 1e-9);
  });

  it('reports speedRatio normalized to the 280 px/s reference and clamped', () => {
    let motion = advanceCharacterMotion(createCharacterMotion(0, 0), baseInput, 0);
    motion = advanceCharacterMotion(motion.state, { ...baseInput, x: 28 }, 0.1);
    assert.ok(Math.abs(motion.pose.speedRatio! - 1) < 1e-9, '28px in 0.1s = 280px/s = ratio 1');
    const sprint = advanceCharacterMotion(motion.state, { ...baseInput, x: motion.state.x + 700 * 0.05 }, 0.15);
    assert.equal(sprint.pose.speedRatio, 1.35, 'clamped at 1.35');
  });

  it('does not advance the gait while airborne or dashing', () => {
    let motion = advanceCharacterMotion(createCharacterMotion(0, 0), baseInput, 0.016);
    motion = advanceCharacterMotion(
      motion.state,
      { ...baseInput, x: 100, onGround: false, vy: -300 },
      0.032,
    );
    assert.equal(motion.state.phase, 0);
  });
});

describe('resolveSpringScale', () => {
  it('is identity at rest', () => {
    const s = resolveSpringScale({});
    assert.equal(s.scaleX, 1);
    assert.equal(s.scaleY, 1);
  });

  it('stretches tall and narrow on takeoff', () => {
    const s = resolveSpringScale({ launch: 1 });
    assert.ok(s.scaleY > 1, 'takeoff stretches vertically');
    assert.ok(s.scaleX < 1, 'takeoff narrows');
  });

  it('squashes short and wide on landing', () => {
    const s = resolveSpringScale({ land: 1 });
    assert.ok(s.scaleY < 1, 'landing squashes vertically');
    assert.ok(s.scaleX > 1, 'landing widens');
  });

  it('settles back toward identity as impulses decay and clamps wild inputs', () => {
    const half = resolveSpringScale({ launch: 0.01, land: 0.01 });
    assert.ok(Math.abs(half.scaleX - 1) < 0.01 && Math.abs(half.scaleY - 1) < 0.01);
    const wild = resolveSpringScale({ launch: 9, land: -4 });
    assert.ok(wild.scaleY > 1 && wild.scaleY <= 1.2 + 1e-9);
    const wildSquash = resolveSpringScale({ land: 3 });
    assert.ok(wildSquash.scaleY < 1 && wildSquash.scaleY >= 1 - 0.24 - 1e-9);
    assert.deepEqual(resolveSpringScale({ land: 0.4 }), resolveSpringScale({ land: 0.4 }));
  });
});
