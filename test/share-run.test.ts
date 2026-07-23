import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRunShareText, shareRunResult } from '@/lib/share-run';

const run = {
  score: 12345,
  distance: 987.9,
  coins: 42,
  maxCombo: 7,
  enemiesDefeated: 18,
};

describe('buildRunShareText', () => {
  it('formats the complete run summary for sharing', () => {
    assert.equal(
      buildRunShareText(run),
      [
        'My Dashverse run',
        'Score 12,345 · 987m',
        '42 coins · x7 combo · 18 defeated',
        'Can you beat it?',
      ].join('\n'),
    );
  });

  it('normalizes invalid, negative, and fractional values', () => {
    assert.equal(
      buildRunShareText({
        score: Number.NaN,
        distance: -20,
        coins: 3.9,
        maxCombo: Number.POSITIVE_INFINITY,
      }),
      [
        'My Dashverse run',
        'Score 0 · 0m',
        '3 coins · x0 combo · 0 defeated',
        'Can you beat it?',
      ].join('\n'),
    );
  });
});

describe('shareRunResult', () => {
  it('uses the native share sheet when available', async () => {
    let payload: unknown;
    const outcome = await shareRunResult(
      run,
      { share: async (data) => { payload = data; } },
      'https://dashverse.example',
    );

    assert.equal(outcome, 'shared');
    assert.deepEqual(payload, {
      title: 'Dashverse run',
      text: buildRunShareText(run),
      url: 'https://dashverse.example',
    });
  });

  it('falls back to the clipboard when native sharing fails', async () => {
    let clipboardText = '';
    const outcome = await shareRunResult(
      run,
      {
        share: async () => { throw new Error('share unavailable'); },
        clipboard: { writeText: async (text) => { clipboardText = text; } },
      },
      'https://dashverse.example',
    );

    assert.equal(outcome, 'copied');
    assert.equal(clipboardText, `${buildRunShareText(run)}\nhttps://dashverse.example`);
  });

  it('treats dismissing the native share sheet as a cancellation', async () => {
    let copied = false;
    const abort = new Error('cancelled');
    abort.name = 'AbortError';
    const outcome = await shareRunResult(run, {
      share: async () => { throw abort; },
      clipboard: { writeText: async () => { copied = true; } },
    });

    assert.equal(outcome, 'cancelled');
    assert.equal(copied, false);
  });

  it('reports unavailable when no share mechanism succeeds', async () => {
    assert.equal(await shareRunResult(run, {}), 'unavailable');
    assert.equal(
      await shareRunResult(run, {
        clipboard: { writeText: async () => { throw new Error('denied'); } },
      }),
      'unavailable',
    );
  });
});
