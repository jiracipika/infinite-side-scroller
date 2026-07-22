import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { clearRunHistory, loadRunHistory, recordRun, summarizeRunHistory } from '@/lib/run-history';

class StorageMock {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

const originalStorage = globalThis.localStorage;

beforeEach(() => { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new StorageMock() }); });
afterEach(() => { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalStorage }); });

const run = (score: number) => ({ score, distance: score / 10, coins: 3, maxCombo: 2, enemiesDefeated: 1, characterId: 'knight' });

describe('run history', () => {
  it('records newest first and rejects empty runs', () => {
    recordRun(run(100), 1);
    recordRun(run(200), 2);
    recordRun({ ...run(0), distance: 0, coins: 0 }, 3);
    assert.deepEqual(loadRunHistory().map((entry) => entry.score), [200, 100]);
  });

  it('keeps a bounded 20-run window', () => {
    for (let i = 1; i <= 25; i += 1) recordRun(run(i), i);
    const history = loadRunHistory();
    assert.equal(history.length, 20);
    assert.equal(history[0].score, 25);
    assert.equal(history.at(-1)?.score, 6);
  });

  it('normalizes corrupted numeric values', () => {
    localStorage.setItem('dashverse-run-history-v1', JSON.stringify([{ id: 'x', characterId: 'ninja', playedAt: -5, score: -10, distance: 'bad', coins: 4.8 }]));
    assert.deepEqual(loadRunHistory()[0], { id: 'x', characterId: 'ninja', playedAt: 0, score: 0, distance: 0, coins: 4, maxCombo: 0, enemiesDefeated: 0 });
  });

  it('sorts stored runs newest-first and removes duplicate ids', () => {
    localStorage.setItem('dashverse-run-history-v1', JSON.stringify([
      { ...run(100), id: 'older', playedAt: 10 },
      { ...run(300), id: 'newer', playedAt: 30 },
      { ...run(200), id: 'older', playedAt: 20 },
    ]));
    assert.deepEqual(loadRunHistory().map((entry) => entry.score), [300, 200]);
  });

  it('replaces an identical run id instead of duplicating it', () => {
    recordRun(run(100), 50);
    recordRun({ ...run(100), coins: 9 }, 50);
    const history = loadRunHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0].coins, 9);
  });

  it('clears the stored history', () => {
    recordRun(run(100), 1);
    clearRunHistory();
    assert.deepEqual(loadRunHistory(), []);
  });

  it('summarizes averages, bests, and recent trend', () => {
    const history = [600, 500, 400, 300, 200, 100].map((score, index) => ({ ...run(score), id: String(index), playedAt: index }));
    assert.deepEqual(summarizeRunHistory(history), { runs: 6, averageScore: 350, bestScore: 600, averageDistance: 35, scoreTrend: 300 });
  });
});
