import type { CharacterArtPose } from './character-art';
import type { CharacterDef } from '../data/characters';

export type CharacterPreviewAction = 'idle' | 'run' | 'jump' | 'attack';

export type AttackGesture = 'cleave' | 'cut' | 'slam' | 'cast' | 'bow' | 'pulse' | 'bonk' | 'fan' | 'whip' | 'puppet' | 'lunge' | 'serve' | 'reap';

/** Animation direction, independent of combat stats and collision geometry.
 * These are the same people in the same costumes, with their own body language. */
export interface CharacterPerformance {
  strideLength: number;
  reach: number;
  footLift: number;
  armSwing: number;
  lean: number;
  weight: number;
  breath: number;
  cloth: number;
  spring: number;
  gesture: AttackGesture;
  weaponArm: 0 | 1;
}

const balanced: CharacterPerformance = {
  strideLength: 1, reach: 1, footLift: 1, armSwing: 1, lean: 1,
  weight: 1, breath: 1, cloth: 1, spring: 1, gesture: 'cleave', weaponArm: 0,
};
const performance = (values: Partial<CharacterPerformance>): CharacterPerformance => ({ ...balanced, ...values });

export const CHARACTER_PERFORMANCES: Readonly<Record<string, CharacterPerformance>> = {
  knight: performance({ armSwing: .72, cloth: 1.1 }),
  ninja: performance({ strideLength: .88, reach: 1.12, footLift: .8, armSwing: .6, lean: 1.5, weight: .55, breath: 1.2, cloth: 1.7, spring: 1.15, gesture: 'cut' }),
  tank: performance({ strideLength: 1.22, reach: .72, footLift: .64, armSwing: .42, lean: .6, weight: 1.6, breath: .65, cloth: .35, spring: .48, gesture: 'slam', weaponArm: 1 }),
  mage: performance({ strideLength: 1.08, reach: .72, footLift: .8, armSwing: .35, lean: .55, weight: .65, breath: .8, cloth: 1.4, spring: .8, gesture: 'cast' }),
  ranger: performance({ strideLength: .95, reach: 1.08, footLift: 1.1, armSwing: .65, lean: 1.1, weight: .7, cloth: 1.2, gesture: 'bow', weaponArm: 1 }),
  cyborg: performance({ strideLength: 1.12, reach: .9, footLift: .72, armSwing: .45, lean: .65, weight: 1.2, breath: .45, cloth: .2, spring: .4, gesture: 'pulse' }),
  spirit: performance({ strideLength: 1.2, reach: .3, footLift: .2, armSwing: .3, lean: .35, weight: .2, breath: .7, cloth: 1.8, spring: .55, gesture: 'cast', weaponArm: 1 }),
  healer: performance({ strideLength: 1.08, reach: .68, footLift: .8, armSwing: .3, lean: .4, weight: .6, breath: .75, cloth: 1.25, spring: .75, gesture: 'cast' }),
  cherry: performance({ strideLength: .88, reach: .85, footLift: 1.25, armSwing: 1.1, lean: .9, weight: .55, breath: 1.2, cloth: 1.6, spring: 1.18, gesture: 'bonk', weaponArm: 1 }),
  velvet: performance({ strideLength: 1.18, reach: .6, footLift: .65, armSwing: .4, lean: .3, weight: .45, breath: .65, cloth: 1.5, spring: .65, gesture: 'fan', weaponArm: 1 }),
  ember: performance({ strideLength: .9, reach: 1.1, footLift: 1.2, armSwing: 1.25, lean: 1.05, weight: .55, breath: 1.3, cloth: 1.6, spring: 1.1, gesture: 'fan', weaponArm: 1 }),
  rosalia: performance({ strideLength: 1.16, reach: .6, footLift: .65, armSwing: .45, lean: .4, weight: .55, breath: .75, cloth: 1.4, spring: .7, gesture: 'whip', weaponArm: 1 }),
  marionette: performance({ strideLength: .82, reach: .8, footLift: 1.35, armSwing: 1.1, lean: .65, weight: .45, breath: .55, cloth: 1.5, spring: .9, gesture: 'puppet', weaponArm: 1 }),
  dorian: performance({ strideLength: 1.05, reach: 1.12, footLift: .9, armSwing: .6, lean: .8, weight: .65, breath: .9, cloth: 1.35, spring: .8, gesture: 'lunge' }),
  onyx: performance({ strideLength: 1.2, reach: .92, footLift: .8, armSwing: .5, lean: .9, weight: 1.5, breath: .7, cloth: .6, spring: .55, gesture: 'slam' }),
  mortimer: performance({ strideLength: 1.15, reach: .65, footLift: .65, armSwing: .2, lean: .3, weight: .8, breath: .7, cloth: .9, spring: .6, gesture: 'serve' }),
  grimshaw: performance({ strideLength: 1.3, reach: .4, footLift: .3, armSwing: .35, lean: .5, weight: .35, breath: .55, cloth: 1.8, spring: .6, gesture: 'reap', weaponArm: 1 }),
};

export function characterPerformance(id: string): CharacterPerformance {
  return CHARACTER_PERFORMANCES[id] ?? balanced;
}

/** Menu rehearsal uses the same pose vocabulary and travel cadence as play. */
export function characterPreviewPose(char: CharacterDef, time: number, action: CharacterPreviewAction): CharacterArtPose {
  const cycle = time % 1.5;
  if (action === 'run') {
    const phase = (time * 280 * char.speed / (Math.max(88, char.width * 3.4) * characterPerformance(char.id).strideLength)) % 1;
    return { time, moving: true, phase, stride: Math.sin(phase * Math.PI * 2) * 2.4, speedRatio: char.speed };
  }
  if (action === 'jump') {
    const airborne = cycle < .95;
    return { time, airborne, verticalVelocity: -520 + cycle / .95 * 1040,
      launch: airborne ? Math.max(0, 1 - cycle / .22) : 0,
      land: !airborne ? Math.max(0, 1 - (cycle - .95) / .3) : 0 };
  }
  if (action === 'attack') {
    const progress = cycle < .7 ? cycle / .7 : 0;
    return { time, melee: char.hasMelee ? progress : 0, ranged: char.hasMelee ? 0 : progress };
  }
  return { time, moving: false };
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };

/** Readable anticipation → fast contact → soft recovery. Continuous at each
 * boundary and at attack start/end; no pose snap when the timer expires. */
export function attackGesture(progress: number, gesture: AttackGesture): { shoulder: number; elbow: number; lunge: number } {
  const p = clamp(progress);
  const windup = smooth(p / .24);
  const strike = smooth((p - .24) / .26);
  const recover = 1 - smooth((p - .5) / .5);
  const sweep = (-.35 * windup + 1.35 * strike) * recover;
  const contact = strike * recover;
  switch (gesture) {
    case 'slam': return { shoulder: -1.35 * sweep, elbow: -.65 * sweep, lunge: contact * .035 };
    case 'lunge': return { shoulder: -.5 * sweep, elbow: -.95 * sweep, lunge: contact * .055 };
    case 'reap': return { shoulder: -1.05 * sweep, elbow: -.4 * sweep, lunge: contact * .02 };
    case 'fan': return { shoulder: -.85 * sweep, elbow: .55 * sweep, lunge: contact * .018 };
    case 'whip': return { shoulder: -1.1 * sweep, elbow: -.8 * sweep, lunge: contact * .018 };
    case 'puppet': return { shoulder: -.9 * sweep, elbow: .8 * sweep, lunge: contact * .012 };
    case 'bonk': return { shoulder: -1.2 * sweep, elbow: -.25 * sweep, lunge: contact * .025 };
    case 'serve': return { shoulder: -.45 * sweep, elbow: -.6 * sweep, lunge: contact * .012 };
    case 'bow': return { shoulder: -.2 * sweep, elbow: -.9 * sweep, lunge: contact * .008 };
    case 'cast': return { shoulder: -.55 * sweep, elbow: -.4 * sweep, lunge: contact * .008 };
    case 'pulse': return { shoulder: -.6 * sweep, elbow: -.75 * sweep, lunge: contact * .02 };
    case 'cut': return { shoulder: -.95 * sweep, elbow: -.55 * sweep, lunge: contact * .035 };
    default: return { shoulder: -.8 * sweep, elbow: -.4 * sweep, lunge: contact * .02 };
  }
}

/** Cache the pose that will actually be painted. Every deformation input is
 * represented, including continuous fall velocity and launch/landing impulses. */
export function quantizeCharacterPose(pose: CharacterArtPose): CharacterArtPose {
  const q = (n: number | undefined, steps: number) => Math.round((n ?? 0) * steps) / steps;
  return {
    moving: !!pose.moving, airborne: !!pose.airborne, dashing: !!pose.dashing,
    phase: q(pose.phase, 48), stride: pose.moving ? 0 : q(pose.stride, 12),
    time: pose.moving && !pose.airborne ? 0 : Math.round((pose.time ?? 0) * 24) / 24,
    verticalVelocity: (pose.verticalVelocity ?? 0) === 0 ? 0
      : Math.sign(pose.verticalVelocity!) * Math.max(60, Math.round(Math.abs(pose.verticalVelocity!) / 60) * 60),
    melee: q(pose.melee, 32), ranged: q(pose.ranged, 32),
    launch: q(pose.launch, 16), land: q(pose.land, 16), speedRatio: q(pose.speedRatio ?? (pose.moving ? 1 : 0), 8),
  };
}
