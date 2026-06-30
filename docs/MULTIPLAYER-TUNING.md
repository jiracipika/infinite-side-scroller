# Multiplayer Tuning Manifest

Generated: 2026-06-30

The game uses two network timing envelopes:

- HTTP fallback: 25Hz simulation tick, sync every 2 ticks, roughly 12.5Hz network updates, 115ms interpolation delay.
- WebRTC P2P: 60Hz data-channel movement updates, 16ms interpolation delay for low-latency LAN play.

Run this verifier before changing multiplayer constants:

```bash
npm run verify:multiplayer
```

The verifier fails if:
- fallback tick rate drifts too far from the 25Hz server/client contract;
- HTTP interpolation no longer covers the polling interval;
- P2P interpolation is set to zero or too high;
- reconciliation thresholds are no longer ascending;
- input buffer or history windows are too short for reconciliation.

Gameplay rule: never block a match on P2P. If WebRTC fails, HTTP polling remains the reliable fallback.
