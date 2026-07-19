import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { fpsBucket } from '@/components/fps-readout';

/**
 * fpsBucket color-codes the HUD FPS readout. Thresholds must stay in sync with
 * the engine's adaptive-quality bands (game-engine.ts updateAdaptiveQuality):
 *
 *   fps >= 50 → 'good'  (engine "high" quality, full particles)
 *   30..49    → 'ok'    (engine "medium" quality)
 *   fps < 30  → 'bad'   (engine "low" quality, reduced particles)
 *
 * These tests pin that contract so a drift in either place is caught.
 */
describe('fpsBucket', () => {
  it('returns "good" at and above the high-quality threshold (50)', () => {
    assert.equal(fpsBucket(50), 'good');
    assert.equal(fpsBucket(60), 'good');
    assert.equal(fpsBucket(120), 'good');
  });

  it('returns "ok" in the medium-quality band (30..49)', () => {
    assert.equal(fpsBucket(30), 'ok');
    assert.equal(fpsBucket(35), 'ok');
    assert.equal(fpsBucket(49), 'ok');
  });

  it('returns "bad" below the low-quality drop threshold (<30)', () => {
    assert.equal(fpsBucket(29), 'bad');
    assert.equal(fpsBucket(15), 'bad');
    assert.equal(fpsBucket(0), 'bad');
  });

  it('treats the exact 30 and 50 boundaries as the higher bucket', () => {
    // 30 is the start of "ok", 50 is the start of "good" — both inclusive.
    assert.equal(fpsBucket(30), 'ok');
    assert.equal(fpsBucket(50), 'good');
    // And just below each boundary falls into the lower bucket.
    assert.equal(fpsBucket(29), 'bad');
    assert.equal(fpsBucket(49), 'ok');
  });
});
