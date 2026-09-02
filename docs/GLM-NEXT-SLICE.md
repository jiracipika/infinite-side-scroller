# GLM Next Slice — Infinite Side Scroller

Status: implementation-ready handoff
Status updated: 2026-09-02 — mobile melee button + airborne sprite pose IMPLEMENTED (see Completed below).
Owner: GLM 5.2/5.3 polish lane
Priority: P2 premium visual/product polish; no correctness emergency

## Completed

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
