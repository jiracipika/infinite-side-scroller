import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { loadGhostRun, upsertGhostRun } from '@/lib/ghost-runs';

const MEMORY: Record<string, string> = {};
const localStorageStub = {
  getItem: (key: string): string | null => MEMORY[key] ?? null,
  setItem: (key: string, value: string): void => { MEMORY[key] = value; },
  clear: (): void => { for (const key of Object.keys(MEMORY)) delete MEMORY[key]; },
};

const globalAny = globalThis as Record<string, unknown>;
if (!globalAny.window) globalAny.window = globalAny;
globalAny.localStorage = localStorageStub;

beforeEach(() => localStorageStub.clear());

describe('personal-best ghost persistence', () => {
  it('only replays a ghost recorded for the current procedural-world seed', () => {
    upsertGhostRun({
      slotId: 'slot1',
      seed: 12345,
      bestScore: 200,
      bestDistance: 500,
      points: [{ distance: 4, x: 10, y: 20 }],
      updatedAt: 1,
    });

    assert.equal(loadGhostRun('slot1', 54321), null);
    assert.deepEqual(loadGhostRun('slot1', 12345)?.points, [{ distance: 4, x: 10, y: 20 }]);
  });

  it('keeps personal bests for multiple seeds in the same save slot', () => {
    const makeRun = (seed: number, score: number) => ({
      slotId: 'slot1' as const,
      seed,
      bestScore: score,
      bestDistance: score * 2,
      points: [{ distance: 4, x: seed, y: 20 }],
      updatedAt: seed,
    });

    upsertGhostRun(makeRun(101, 200));
    upsertGhostRun(makeRun(202, 300));

    assert.equal(loadGhostRun('slot1', 101)?.bestScore, 200);
    assert.equal(loadGhostRun('slot1', 202)?.bestScore, 300);
  });

  it('does not replace a seed personal best with a lower-scoring run', () => {
    upsertGhostRun({
      slotId: 'slot1', seed: 7, bestScore: 500, bestDistance: 600,
      points: [{ distance: 4, x: 10, y: 20 }], updatedAt: 1,
    });
    upsertGhostRun({
      slotId: 'slot1', seed: 7, bestScore: 400, bestDistance: 900,
      points: [{ distance: 4, x: 99, y: 20 }], updatedAt: 2,
    });

    assert.equal(loadGhostRun('slot1', 7)?.bestScore, 500);
    assert.equal(loadGhostRun('slot1', 7)?.points[0]?.x, 10);
  });

  it('migrates the legacy slot-only record on the next improved run', () => {
    localStorageStub.setItem('iss-ghost-runs-v1', JSON.stringify({
      slot1: {
        slotId: 'slot1', seed: 9, bestScore: 100, bestDistance: 100,
        points: [{ distance: 2, x: 3, y: 4 }], updatedAt: 1,
      },
    }));

    upsertGhostRun({
      slotId: 'slot1', seed: 9, bestScore: 101, bestDistance: 100,
      points: [{ distance: 2, x: 5, y: 4 }], updatedAt: 2,
    });

    const stored = JSON.parse(MEMORY['iss-ghost-runs-v1']) as Record<string, unknown>;
    assert.equal(stored.slot1, undefined);
    assert.ok(stored['slot1:9']);
    assert.equal(loadGhostRun('slot1', 9)?.bestScore, 101);
  });

  it('drops malformed persisted points instead of passing them to the renderer', () => {
    localStorageStub.setItem('iss-ghost-runs-v1', JSON.stringify({
      slot1: {
        slotId: 'slot1', seed: 9, bestScore: 100, bestDistance: 100,
        points: [
          { distance: 2, x: 3, y: 4 },
          { distance: 'bad', x: 5, y: 6 },
          null,
        ],
        updatedAt: 1,
      },
    }));

    assert.deepEqual(loadGhostRun('slot1', 9)?.points, [{ distance: 2, x: 3, y: 4 }]);
  });

  it('returns null when a matching-seed ghost has no usable points', () => {
    localStorageStub.setItem('iss-ghost-runs-v1', JSON.stringify({
      slot1: {
        slotId: 'slot1', seed: 9, bestScore: 100, bestDistance: 100,
        points: [{ distance: Number.NaN, x: 3, y: 4 }], updatedAt: 1,
      },
    }));

    assert.equal(loadGhostRun('slot1', 9), null);
  });
});