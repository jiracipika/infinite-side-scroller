# Multiplayer Latency Improvements

## What Changed

### Networking model (existing + improved)
- The project remains **hybrid authoritative**:
  - Client simulates local movement immediately for responsiveness.
  - Server remains authoritative for shared room state and validates incoming snapshots by clamping unrealistic deltas.
- Added/expanded multiplayer config in `src/game/multiplayer/config.ts`.
- Added sequenced input command structure (`NetInputCommand`) and sync metadata (`ackInputSeq`, tick/snapshot rates, inferred loss).

### Client-side prediction + reconciliation
- Local input is still immediate (already predicted client-side by the engine loop).
- Each sync now sends a sequenced input command (`seq`, `clientTime`, `dtMs`, movement/action flags).
- Client keeps a bounded pending-input buffer and removes acknowledged inputs using `ackInputSeq`.
- On authoritative response:
  - Client reconciles to server snapshot with thresholded correction (small blend, medium smooth offset, large snap).
  - Client replays unacknowledged inputs after correction to preserve responsiveness.

### Remote-player interpolation
- Remote snapshots are buffered with server timestamps.
- Rendering uses interpolation delay (`MP_INTERPOLATION_DELAY_MS`) to reduce jitter.
- Brief extrapolation is allowed when packets are missing and clamped by `MP_MAX_EXTRAPOLATION_MS`.
- Large divergence snaps to authoritative position to prevent unrealistic drift.

### Update strategy and traffic cleanup
- Client sync interval remains adaptive (LAN vs WAN baseline + RTT EWMA).
- Optional command-only sync packets are supported by making `snapshot` optional in payload.
- Client sends snapshot keyframes when state changed or keepalive timeout expires.
- Server snapshots and state responses include compact network metrics for diagnostics.

### Tick/timing cleanup
- Server clock now tracks fixed tick windows and snapshot-rate windows.
- Returned telemetry includes server tick rate and snapshot rate.
- Client render/update remains decoupled from network sync cadence.

### Lag-comp groundwork
- Server stores bounded per-player history (`MP_HISTORY_BUFFER_DURATION_MS`).
- Added helper for historical lookup by timestamp as a foundation for server-side hit rewind validation.

### Diagnostics overlay
- Added in-game multiplayer debug overlay showing:
  - RTT
  - Jitter
  - Inferred loss
  - Server tick rate
  - Server snapshot rate
  - Client sync/snapshot rate
  - Client FPS
  - Prediction error
  - Reconciliation count
  - Interpolation delay

## Config Values You Can Tune

Defined in `src/game/multiplayer/config.ts`:
- `MP_SERVER_TICK_RATE`
- `MP_SNAPSHOT_RATE`
- `MP_INTERPOLATION_DELAY_MS`
- `MP_MAX_EXTRAPOLATION_MS`
- `MP_RECONCILE_SMALL_THRESHOLD`
- `MP_RECONCILE_MEDIUM_THRESHOLD`
- `MP_RECONCILE_SNAP_THRESHOLD`
- `MP_RECONCILE_SMOOTH_SPEED`
- `MP_INPUT_BUFFER_SIZE`
- `MP_HISTORY_BUFFER_DURATION_MS`

Client-side sync pacing knobs in `src/app/page.tsx`:
- `LAN_SYNC_BASE_MS`
- `WAN_SYNC_BASE_MS`
- `SYNC_MIN_MS`
- `SYNC_MAX_MS`
- `SNAPSHOT_KEEPALIVE_MS`
- `SNAPSHOT_DELTA_EPS`

## How To Test Locally

1. Run app:
   - `npm run dev`
2. Open host and joiner on two devices (same LAN).
3. Start multiplayer and keep debug overlay visible.
4. Validate:
   - Local movement feels immediate.
   - Remote movement is smooth (minimal jitter/teleporting).
   - Reconciliation count grows occasionally but no constant hard snapping.

### Artificial latency/jitter/loss simulation
Use URL query params (percent for loss):
- `?netLag=50`
- `?netLag=100`
- `?netLag=150`
- `?netLag=100&netJitter=30`
- `?netLag=100&netJitter=30&netLoss=5`

Examples:
- `http://localhost:3000/?netLag=50`
- `http://localhost:3000/?netLag=150&netJitter=40&netLoss=5`

Expected behavior:
- Local controls remain responsive due to prediction.
- Remote interpolation should remain stable with moderate jitter/loss.
- Larger corrections should be less frequent and visually smoother.

## Known Limitations / Future Improvements
- Full deterministic lockstep is not implemented; this remains hybrid to avoid a risky rewrite.
- Combat/hit rewind is currently groundwork only (history buffer + lookup helper). Full server rewind validation can be layered in next.
- Remote rendering currently prioritizes a single visible peer in-game UI; extending to render all peers simultaneously is a separate UX pass.
- For stronger anti-cheat, server-side full movement simulation against world collision would be the next major step.
