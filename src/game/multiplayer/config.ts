/**
 * Multiplayer timing + reconciliation tuning.
 * Keep these in one place so we can quickly tune feel under varying latency.
 */

export const MP_SERVER_TICK_RATE = 30;
export const MP_SNAPSHOT_RATE = 20;
export const MP_INTERPOLATION_DELAY_MS = 80;
export const MP_MAX_EXTRAPOLATION_MS = 100;
export const MP_RECONCILE_SMALL_THRESHOLD = 2;
export const MP_RECONCILE_MEDIUM_THRESHOLD = 14;
export const MP_RECONCILE_SNAP_THRESHOLD = 72;
export const MP_RECONCILE_SMOOTH_SPEED = 14;
export const MP_INPUT_BUFFER_SIZE = 90;
export const MP_HISTORY_BUFFER_DURATION_MS = 1800;
