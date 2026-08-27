/**
 * Multiplayer timing + reconciliation tuning.
 *
 * The netcode is tick-based: the client fires a sync every MP_TICK_MS and the
 * server reports the same fallback rate while WebRTC P2P can run faster.
 * Keep these in one place so we can tune feel under varying latency.
 */

/** Fixed simulation / sync tick rate in Hz. */
export const MP_TICK_RATE_HZ = 25;
/** Milliseconds per tick — the single source of truth for HTTP/fallback sync cadence. */
export const MP_TICK_MS = 1000 / MP_TICK_RATE_HZ; // 40ms
/** P2P WebRTC sends movement every animation frame-ish tick for LAN responsiveness. */
export const MP_P2P_TICK_RATE_HZ = 60;
export const MP_P2P_TICK_MS = 1000 / MP_P2P_TICK_RATE_HZ;

/**
 * HTTP polling fires every Nth tick. P2P (WebRTC) and split-screen fire every
 * tick (60 Hz for P2P, 25 Hz for split-screen). Same-Wi‑Fi fallback needs
 * every tick so remote input does not feel delayed when P2P is still connecting.
 */
export const MP_HTTP_TICK_DIVISOR = 1;

/** Server-side tick rate (matches the client tick). */
export const MP_SERVER_TICK_RATE = MP_TICK_RATE_HZ;
/** How often the server persists a snapshot. Tick-based = every tick. */
export const MP_SNAPSHOT_RATE = MP_TICK_RATE_HZ;

export const MP_INTERPOLATION_DELAY_MS = 115;
/** Reduced interpolation delay for P2P (WebRTC) — LAN packets usually arrive inside one frame. */
export const MP_P2P_INTERPOLATION_DELAY_MS = 32;
export const MP_MAX_EXTRAPOLATION_MS = 120;
export const MP_RECONCILE_SMALL_THRESHOLD = 4;
export const MP_RECONCILE_MEDIUM_THRESHOLD = 18;
export const MP_RECONCILE_SNAP_THRESHOLD = 84;
export const MP_RECONCILE_SMOOTH_SPEED = 10.5;
export const MP_INPUT_BUFFER_SIZE = 90;
export const MP_HISTORY_BUFFER_DURATION_MS = 1800;

/* ── Adaptive interpolation ────────────────────────────────────────────
   The render delay for remote players is derived from measured RTT instead
   of being a fixed constant. One-way latency ≈ RTT / 2; buffer about 1.5×
   that plus a small floor to absorb jitter, then clamp between the LAN
   floor and the static worst-case value. */

/** Lowest render delay we will ever use (one P2P frame of buffering). */
export const MP_INTERP_MIN_MS = 32;
/** Highest render delay we will ever use (the legacy static value). */
export const MP_INTERP_MAX_MS = MP_INTERPOLATION_DELAY_MS;
/** Delay headroom multiplier over one-way RTT (absorbs jitter spikes). */
export const MP_INTERP_JITTER_FACTOR = 1.5;
/** Fixed buffer added on top of scaled one-way RTT (scheduling slack). */
export const MP_INTERP_BASE_SLACK_MS = 24;

/**
 * Derive an interpolation delay from a smoothed RTT.
 * Works for both transports: P2P RTT ~1–5 ms → near the floor; HTTP polling
 * RTT ~40–150 ms → scales up smoothly toward MP_INTERP_MAX_MS.
 */
export function computeInterpolationDelayMs(rttMs: number): number {
  if (!Number.isFinite(rttMs) || rttMs <= 0) return MP_INTERP_MAX_MS;
  const target = (rttMs / 2) * MP_INTERP_JITTER_FACTOR + MP_INTERP_BASE_SLACK_MS;
  return Math.round(Math.min(MP_INTERP_MAX_MS, Math.max(MP_INTERP_MIN_MS, target)));
}
