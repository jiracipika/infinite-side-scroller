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