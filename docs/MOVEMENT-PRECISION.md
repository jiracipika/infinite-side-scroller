# Movement precision pass

## Player-facing changes
- Direction + dash on the same simulation tick now dashes in the requested direction, rather than using the previous facing direction. Uses the existing unified horizontal input axis (keyboard, touch, gamepad).
- Neutral dash retains facing; an active dash commits to its original direction.
- Double jumps work underneath one-way platforms and when moving off a platform edge.
- Landing prediction uses the same vertical crossing tolerance and post-movement horizontal bounds as platform collision. Landing-buffered jumps preserve the air jump.
- The controls hint distinguishes Ninja/power-up double jumps from ordinary characters.

## Regression coverage
`test/movement-precision.test.ts` exercises five real Player.update scenarios: simultaneous directional dash, committed neutral dash, platform touchdown, departing a platform edge, and overhead-platform double jump.

Run `node scripts/run-tests.mjs`, `node scripts/test-controls-hint.mjs`, `npx tsc --noEmit`, `npx next lint`, and `npx next build`.

These are deterministic engine and build checks. Physical controller/mobile playtesting and live-browser verification of this pass are not yet recorded.
