import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MP_TICK_RATE_HZ,
  MP_TICK_MS,
  MP_P2P_TICK_RATE_HZ,
  MP_P2P_TICK_MS,
  MP_HTTP_TICK_DIVISOR,
  MP_SERVER_TICK_RATE,
  MP_SNAPSHOT_RATE,
  MP_INTERPOLATION_DELAY_MS,
  MP_P2P_INTERPOLATION_DELAY_MS,
  MP_MAX_EXTRAPOLATION_MS,
  MP_RECONCILE_SMALL_THRESHOLD,
  MP_RECONCILE_MEDIUM_THRESHOLD,
  MP_RECONCILE_SNAP_THRESHOLD,
  MP_RECONCILE_SMOOTH_SPEED,
  MP_INPUT_BUFFER_SIZE,
  MP_HISTORY_BUFFER_DURATION_MS,
} from '@/game/multiplayer/config';

// ── Structural invariants ────────────────────────────────────────────

describe('multiplayer config timing invariants', () => {
  it('MP_TICK_MS is the reciprocal of MP_TICK_RATE_HZ', () => {
    assert.ok(Math.abs(MP_TICK_MS - 1000 / MP_TICK_RATE_HZ) < 0.001);
  });

  it('P2P tick is faster than HTTP fallback tick', () => {
    assert.ok(MP_P2P_TICK_RATE_HZ > MP_TICK_RATE_HZ, 'P2P should run at higher Hz');
    assert.ok(MP_P2P_TICK_MS < MP_TICK_MS, 'P2P tick should be shorter (faster)');
  });

  it('tick intervals are positive and finite', () => {
    assert.ok(Number.isFinite(MP_TICK_MS) && MP_TICK_MS > 0);
    assert.ok(Number.isFinite(MP_P2P_TICK_MS) && MP_P2P_TICK_MS > 0);
  });

  it('HTTP tick divisor is a positive integer', () => {
    assert.ok(Number.isInteger(MP_HTTP_TICK_DIVISOR));
    assert.ok(MP_HTTP_TICK_DIVISOR >= 1);
  });

  it('server tick rate matches client tick rate', () => {
    assert.equal(MP_SERVER_TICK_RATE, MP_TICK_RATE_HZ);
  });

  it('snapshot persistence rate matches server tick', () => {
    assert.equal(MP_SNAPSHOT_RATE, MP_TICK_RATE_HZ);
  });
});

describe('multiplayer interpolation / reconciliation thresholds', () => {
  it('P2P interpolation delay is shorter than HTTP fallback', () => {
    assert.ok(
      MP_P2P_INTERPOLATION_DELAY_MS < MP_INTERPOLATION_DELAY_MS,
      'P2P should have less interpolation delay for LAN responsiveness',
    );
  });

  it('max extrapolation exceeds interpolation delay (to cover jitter)', () => {
    assert.ok(
      MP_MAX_EXTRAPOLATION_MS >= MP_INTERPOLATION_DELAY_MS,
      'extrapolation window should cover at least the interpolation delay',
    );
  });

  it('reconciliation thresholds are ascending (small < medium < snap)', () => {
    assert.ok(MP_RECONCILE_SMALL_THRESHOLD < MP_RECONCILE_MEDIUM_THRESHOLD);
    assert.ok(MP_RECONCILE_MEDIUM_THRESHOLD < MP_RECONCILE_SNAP_THRESHOLD);
    assert.ok(MP_RECONCILE_SMALL_THRESHOLD > 0);
  });

  it('reconciliation smooth speed is positive', () => {
    assert.ok(MP_RECONCILE_SMOOTH_SPEED > 0);
  });

  it('input buffer can hold at least 1 second of ticks', () => {
    const ticksPerSecond = MP_TICK_RATE_HZ;
    assert.ok(
      MP_INPUT_BUFFER_SIZE >= ticksPerSecond,
      `buffer (${MP_INPUT_BUFFER_SIZE}) should hold >= 1s of ticks (${ticksPerSecond})`,
    );
  });

  it('history buffer duration is at least 1 second', () => {
    assert.ok(MP_HISTORY_BUFFER_DURATION_MS >= 1000);
  });
});
