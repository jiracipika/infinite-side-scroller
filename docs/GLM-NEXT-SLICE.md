# GLM Next Slice — Infinite Side Scroller

Status: implementation-ready handoff
Status updated: 2026-09-02 — wall-slide FX IMPLEMENTED (see Completed, slice D).
Owner: GLM 5.2/5.3 polish lane
Priority: P2 premium visual/product polish; no correctness emergency

## Completed

- 2026-09-02 (slice D): Wall-slide FX. Contact feedback for wall slides was
  two static yellow pixels. Now: (1) shimmering 3-chip sparkle at the
  wall-side edge in drawPlayer, phase keyed to screen.y (NOT
  distanceTraveled — vx-derived clocks freeze against a wall, a dead-wiring
  trap), pure function of rendered state, no RNG; (2) new
  ParticleSystem.spawnWallSlideDust(x, y, facingRight) — 6 grit chips
  (3 under reducedParticles) originating at the wall-side edge and kicking
  AWAY from the wall (player faces INTO the wall while sliding), drifting
  up; (3) engine emits bursts at 0.14s cadence while player.wallSliding,
  timer reset on contact so the first burst is instant, skipped when
  carried by remote; (4) renderer draws wall_slide particles as tilted
  squares (scraped-grit read, tilt a pure function of life). 4 tests in
  test/wall-slide-fx.test.ts (539 total); verify:particles now asserts the
  emitter, reducedParticles cap, engine wiring, and renderer case. Mobile
  bundle regenerated (152.7KB).

- 2026-09-02 (slice C): Double-jump tumble FX. Player.airbornePose (set to 1
  when the double jump is consumed, decays ~0.5s, cleared on landing) is now
  consumed by the renderer: pure solvers resolveTumbleRotation (eased
  (^1.6) half flip around the sprite center, mirrored by facing) and
  resolveTumbleArms (sine-envelope arm tuck, ≤3px integer offsets, weapons
  follow the front arm) in character-art.ts. Pose 0 keeps the transform at
  identity, so grounded/single-jump rendering is unchanged. Fully suppressed
  under reduced motion at the drawPlayer call site (same contract as the
  magnet/speed FX). Local player only — NetPlayerSnapshot carries no pose
  field, so the remote sprite stays neutral rather than guessing. 7 solver
  tests in test/tumble-pose.test.ts + 4 player-state tests in
  test/double-jump-fx.test.ts (535 total); verify:visual-textures asserts
  the solvers, renderer wiring, and the reducedMotion gate. Mobile bundle
  regenerated (151.8KB).

- 2026-09-02 (slice B): Power-up FX for the two visually silent effects. New pure
  solver module src/game/rendering/power-fx.ts: resolveMagnetFieldPose (pulsing
  triple amber ring filling the real magnetRadius), resolveSpeedLinesPose (4
  deterministic trailing streaks), powerFxIntensity (0.25s fade-in / 0.4s fade-out
  ramp — no pop-in/out). FX are time-seeded (no RNG) for multiplayer parity;
  magnet degrades to a static faint ring under reduced-motion or LOW quality;
  speed streaks are fully suppressed in both cases. 12 solver tests in
  test/power-fx.test.ts (524 total); verify:visual-textures now asserts the
  solvers, engine wiring, no-RNG, and reduced-motion gates. Live-verified: magnet
  rings + coin pull stream visible around the player during a real run.

- 2026-09-02 (slice A): Character micro-animations. New pure solvers `resolveArmPose`
  (arms cross-swing opposite the run cycle, raise asymmetrically airborne, trail back
  compressed while dashing, thrust at the melee peak) and `resolveHeadPose` (1px bob at
  stride extremes, forward lean + lift airborne, crouch-lean dashing, lean into melee).
  Weapons (sword/bow) now follow the front arm. Renderer passes `melee: meleeProgress`.
  16 new tests in test/character-arm-head-pose.test.ts; 512 total green. Mobile bundle
  regenerated (149.5KB). Motion is deliberately small (≤3px) so silhouettes stay crisp.

- 2026-09-02: Mobile melee button + airborne sprite pose. TouchControls gains a red
  `Melee slash` button (action row, between Attack and Carry) emitting `melee-press`,
  so mobile players can finally use Knight/Ninja/Tank/Cyborg melee (gap open since the
  Aug 6 combat slice). `drawCharacterArt` now consumes the previously-dead `airborne`
  pose flag via a pure `resolveLegPose` solver (rear leg tucks up, front leg reaches);
  8 new unit tests in test/character-leg-pose.test.ts. verify:touch asserts the new
  markers. 496 tests, full verify, typecheck, lint, build all green; mobile bundle
  regenerated (148.7KB). Browser-verified with CDP touch events + canvas pixel probes.

- 2026-08-27: Procedural music engine (WebAudio, zero assets): layered pad/bass/arpeggio/hat
  soundtrack that builds with run distance; plays only during runs; ducks out on pause/game-over;
  mutes on tab-hide; Music volume sliders live on web (Start + Pause settings) and mobile;
  `verify:music` gate added; mobile game.html re-bundled. Browser-verified: oscillators schedule
  only while playing, pause freezes them, slider changes take effect live.
2fe148a docs: quick-verify section + script reference (qwen-worker T1/T2)
0086472 feat(ui): daily-challenge streak — fix history wipe + streak display
39664ae feat(ui): next-star threshold hint on level-complete screen
1b2653e feat(ui): start-screen controls hint (keyboard/touch adaptive)
c353f6b feat(ui): level-select continue banner, star summary, next badge, unlock hints

## Baseline evidence

- `npm run verify` passes.
- 443 automated tests pass.
- Production `npm run build` passes.
- `npm run release:evidence` passes.
- Typecheck and lint pass.
- Existing CI runs on `main` are successful.

## Scope

This project is technically green. Do not destabilize the verification suite for speculative polish. Work in one player-facing vertical slice:

`landing page → choose world/level → understand controls → start run → complete/fail → restart or continue`

## Recommended slice

Improve the level-selection and run-start experience:

- authored biome preview with clear visual identity
- level difficulty and target explained before launch
- character/ability affordance shown without clutter
- mobile controls preview
- clear primary `Start Run` action
- explicit locked/unlocked/complete states
- results screen makes `Next Level`, `Retry`, and `Back to Worlds` hierarchy obvious

## Constraints

- Preserve engine APIs and multiplayer timing contracts.
- Preserve save-slot normalization and monotonic progression behavior.
- Preserve reduced-motion and touch-control behavior.
- Do not add a dependency for animation.
- Do not replace authored biome data with random placeholder cards.
- Do not change the release verification assertions unless a test is demonstrably stale and the source contract changed first.

## TDD / verification

Add a focused UI/state test before changing the flow. Then run:

```bash
npm run verify
npm run build
npm run release:evidence
```

For browser QA, verify desktop and narrow mobile widths with headless DOM assertions for:

- one primary launch action
- no horizontal overflow
- keyboard focus order
- aria labels on controls
- reduced-motion class/behavior
- locked states not clickable

## Definition of done

- The first run is understandable without reading documentation.
- The player can reach gameplay in one obvious path.
- Retry/continue choices are unambiguous.
- Existing 443 tests and release evidence remain green.
- Visual changes are documented with before/after screenshots or DOM evidence.
