# GLM Next Slice — Infinite Side Scroller

Status: implementation-ready handoff
Owner: GLM 5.2/5.3 polish lane
Priority: P2 premium visual/product polish; no correctness emergency

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
