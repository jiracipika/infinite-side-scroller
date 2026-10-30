import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../src/game/data/characters';
import { CHARACTER_PERFORMANCES, attackGesture, characterPreviewPose } from '../src/game/rendering/character-performance';
import { FULL_ART_RIGS, resolveRigPose, propOwnerAt } from '../src/game/rendering/fullart-rig';
import { fullArtFrameKey } from '../src/game/rendering/fullart-mesh';
import { advanceCharacterMotion, createCharacterMotion } from '../src/game/rendering/character-motion';
import { courtPose, renderCourtBaddie } from '../src/game/entities/court';
import { Onyx } from '../src/game/entities/Onyx';

describe('individual character performances', () => {
  it('covers the full cast and gives heavy and agile heroes different body language', () => {
    assert.deepEqual(Object.keys(CHARACTER_PERFORMANCES).sort(), CHARACTERS.map(c => c.id).sort());
    const { tank, ninja, mortimer, ember } = CHARACTER_PERFORMANCES;
    assert.ok(tank.weight > ninja.weight && tank.spring < ninja.spring);
    assert.ok(tank.strideLength > ninja.strideLength);
    assert.ok(mortimer.armSwing < ember.armSwing, 'a butler carries his candles more steadily than a fire dancer');
    assert.equal(FULL_ART_RIGS.spirit.floating, true);
    assert.equal(FULL_ART_RIGS.grimshaw.floating, true);
  });

  it('keeps every attack continuous through anticipation, strike and recovery', () => {
    for (const { gesture } of Object.values(CHARACTER_PERFORMANCES)) {
      for (const p of [0, 1]) {
        const g = attackGesture(p, gesture);
        assert.ok(Math.abs(g.shoulder) + Math.abs(g.elbow) + Math.abs(g.lunge) < 1e-12);
      }
      for (const boundary of [.24, .5]) {
        const a = attackGesture(boundary - 1e-6, gesture), b = attackGesture(boundary + 1e-6, gesture);
        assert.ok(Math.abs(a.shoulder - b.shoulder) < .0001);
        assert.ok(Math.abs(a.elbow - b.elbow) < .0001);
      }
      assert.ok(Object.values(attackGesture(.5, gesture)).every(Number.isFinite));
    }
    assert.notDeepEqual(attackGesture(.5, 'slam'), attackGesture(.5, 'lunge'));
  });

  it('never stretches calves to reach impossible run, dash or jump targets', () => {
    for (const char of CHARACTERS) {
      const rig = FULL_ART_RIGS[char.id];
      for (let frame = 0; frame < 16; frame++) {
        const phase = frame / 16;
        for (const pose of [
          { moving: true, phase, speedRatio: 1.35 },
          { airborne: true, verticalVelocity: -520 + frame * 70 },
          { dashing: true }, { land: 1 },
        ]) {
          const { bones } = resolveRigPose(rig, .72, pose);
          for (const index of [6, 7, 8, 9]) {
            const b = bones[index];
            const rest = Math.hypot(b.restTo[0] - b.restFrom[0], b.restTo[1] - b.restFrom[1]);
            const length = Math.hypot(b.to[0] - b.from[0], b.to[1] - b.from[1]);
            assert.ok(Math.abs(rest - length) < .00001, `${char.id} bone ${index} at ${phase}: ${rest} → ${length}`);
          }
        }
      }
    }
  });

  it('does not freeze a fall, takeoff or landing in a cached frame', () => {
    const poses = [
      { airborne: true, verticalVelocity: 60 }, { airborne: true, verticalVelocity: 480 },
      { airborne: true, verticalVelocity: -60 }, { airborne: true, verticalVelocity: -480 },
      { airborne: true, verticalVelocity: -480, launch: 1 }, { land: 1 }, { land: .5 }, {},
    ];
    assert.equal(new Set(poses.map(p => fullArtFrameKey('knight', p))).size, poses.length);
    const run = { moving: true, phase: .25, speedRatio: 1 };
    assert.equal(fullArtFrameKey('ninja', { ...run, time: 1 }), fullArtFrameKey('ninja', { ...run, time: 101 }), 'repeatable ground strides reuse their baked frame');
  });

  it('keeps Onyx’s face on his head while his club swings independently', () => {
    const rig = FULL_ART_RIGS.onyx;
    assert.equal(propOwnerAt(rig, [.5, .27]), undefined, 'face');
    assert.equal(propOwnerAt(rig, [.45, .14]), undefined, 'hair and horns');
    assert.equal(propOwnerAt(rig, [.86, .11]), 0, 'club head');
    assert.equal(propOwnerAt(rig, [.12, .33]), 0, 'club handle');
  });

  it('menu previews use the same movement cadence and correct weapons as play', () => {
    for (const c of CHARACTERS) {
      const input = { characterId: c.id, x: 280 * c.speed * .05, width: c.width,
        onGround: true, dashing: false, vy: 0, melee: 0, ranged: 0, tumble: 0 };
      const live = advanceCharacterMotion(createCharacterMotion(0, 0), input, .05);
      assert.ok(Math.abs((characterPreviewPose(c, .05, 'run').phase ?? 0) - (live.pose.phase ?? 0)) < 1e-10);
      const attack = characterPreviewPose(c, .35, 'attack');
      assert.equal(Boolean(attack.melee), Boolean(c.hasMelee));
      assert.equal(Boolean(attack.ranged), !c.hasMelee);
    }
  });
});

describe('court character placement and locomotion', () => {
  it('uses actual displacement and freezes with the simulation clock', () => {
    const e = new Onyx(400, 200, 0); e.onGround = true;
    courtPose(e, { moving: true });
    e.x += 8; e.animTimer += .05;
    const first = courtPose(e, { moving: true });
    assert.ok(first.moving && (first.phase ?? 0) > 0);
    assert.deepEqual(courtPose(e, { moving: true }), first);
    e.animTimer += .05;
    const blocked = courtPose(e, { moving: true });
    assert.equal(blocked.moving, false);
    assert.equal(blocked.phase, first.phase, 'blocked enemies do not tread at wall-clock speed');
  });

  it('positions the artwork at the enemy for both facing directions', () => {
    const e = new Onyx(400, 200, 0);
    for (const right of [true, false]) {
      const calls: unknown[][] = [];
      const ctx = new Proxy({} as CanvasRenderingContext2D, {
        get: (_, name) => (...args: unknown[]) => calls.push([name, ...args]),
        set: () => true,
      });
      e.facingRight = right;
      renderCourtBaddie(ctx, e, 100, 50, {}, '#ff2e2e', true);
      assert.ok(calls.some(c => c[0] === 'translate' && c[1] === 300 + e.width / 2 && c[2] === 150));
      assert.ok(calls.some(c => c[0] === 'scale' && c[1] === (right ? 1 : -1) && c[2] === 1));
    }
  });
});
