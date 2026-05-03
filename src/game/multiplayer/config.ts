/**
 * Multiplayer timing + reconciliation tuning.
 * Keep these in one place so we can quickly tune feel under varying latency.
 */

export const MP_SERVER_TICK_RATE = 30;
export const MP_SNAPSHOT_RATE = 15;
export const MP_INTERPOLATION_DELAY_MS = 115;
export const MP_MAX_EXTRAPOLATION_MS = 120;
export const MP_RECONCILE_SMALL_THRESHOLD = 4;
export const MP_RECONCILE_MEDIUM_THRESHOLD = 18;
export const MP_RECONCILE_SNAP_THRESHOLD = 84;
export const MP_RECONCILE_SMOOTH_SPEED = 10.5;
export const MP_INPUT_BUFFER_SIZE = 90;
export const MP_HISTORY_BUFFER_DURATION_MS = 1800;
