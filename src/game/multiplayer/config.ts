/**
 * Multiplayer timing + reconciliation tuning.
 *
 * The netcode is tick-based: the client fires a sync every MP_TICK_MS and the
 * server reports the same rate. Keep these in one place so we can tune feel
 * under varying latency.
 */

/** Fixed simulation / sync tick rate in Hz. */
export const MP_TICK_RATE_HZ = 25;
/** Milliseconds per tick — the single source of truth for sync cadence. */
export const MP_TICK_MS = 1000 / MP_TICK_RATE_HZ; // 40ms

/** Server-side tick rate (matches the client tick). */
export const MP_SERVER_TICK_RATE = MP_TICK_RATE_HZ;
/** How often the server persists a snapshot. Tick-based = every tick. */
export const MP_SNAPSHOT_RATE = MP_TICK_RATE_HZ;

export const MP_INTERPOLATION_DELAY_MS = 115;
export const MP_MAX_EXTRAPOLATION_MS = 120;
export const MP_RECONCILE_SMALL_THRESHOLD = 4;
export const MP_RECONCILE_MEDIUM_THRESHOLD = 18;
export const MP_RECONCILE_SNAP_THRESHOLD = 84;
export const MP_RECONCILE_SMOOTH_SPEED = 10.5;
export const MP_INPUT_BUFFER_SIZE = 90;
export const MP_HISTORY_BUFFER_DURATION_MS = 1800;
