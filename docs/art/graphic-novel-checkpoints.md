# Graphic-novel fidelity checkpoints

Plan: docs/plans/graphic-novel-fidelity.md
Reference: docs/art/reference/graphic-novel-concept.png (copied from Downloads 2026-09-10)

## Stage 1 — baseline + comparison harness — VERIFIED (uncommitted at time of writing, landed in stage-2 commit)
- Production server 127.0.0.1:3010 (npm run start). Playwright: PLAYWRIGHT_PACKAGE=/Users/rs-mac/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/package.json
- Baseline (HEAD 7eef70a, pre-change): /Users/rs-mac/Downloads/dashverse-fidelity/stage-1-original (original probe, knight only), stage-1/ (knight+ninja+studies via new scripts/test-fidelity-browser.mjs)
- Baseline render cost: knight median 1.3ms / p95 2.8ms; ninja 1.2/2.3 (90 samples each, headless DPR1)
- Top gaps vs reference: tidy vector city (repeating windows, no ruin); clean polygon moon; zigzag terrain; hero reads thin/outline at gameplay scale; wire-lime limb contours on old ninja; no attack readability mid-air.

## Stage 2 — hero silhouette + pose fidelity — VERIFIED
- ink-ninja.ts: NEW module, author-scale 20x30, filled bent limbs, asymmetric swept hair, broken ink scarf + restrained lime blades, slanted eyes, scabbard muted; character-art.ts delegates to it (old inline painter removed; limb/edge color #8e799e instead of lime contours).
- renderer.ts: ninja-only katana slash accent during meleeActive — paper blade stroke + thin lime edge, local-space with sprite, zero glow; idle frames unaffected.
- TDD: test/ink-ninja.test.ts extended (lime-contour ban; run-stance widening; airborne/dash melee retention — RED then GREEN; finite/opaque/bounded sweep across 9 poses at real 20x30 size).
- Harness: scripts/lib/capture-rendered-frame.mjs + test-fidelity-browser.mjs render-bound captures (state+canvas read inside engine.render for a matching frame; unit tests in scripts/test-render-capture.mjs, 2 pass). Knight+Ninja, idle/run/jump/combat/dash, full-frame + 6x studies; ART_WIDTH/ART_HEIGHT/ART_REDUCED_MOTION env options. Phone 390x844 reduced-motion run captured (stage-2-phone; probe itself verified, run beyond 180s shell timeout was truncated after both runs+studies finished writing evidence).
- Independent review (GPT-6-astra via openai-codex provider, /tmp/dashverse-independent-review.log): found airborne-melee collapse + stale-frame capture pairing; both fixed and regression-tested; nonblocking suggestions partially adopted (pose sweep at real size).
- Post-fix evidence: stage-2-slash (knight 1.1/2.1ms, ninja 1.6/3.6ms median/p95). Vision (zai) confirms mid-air slash arc reads toward upper-right; no geometry glitch.
- verify exit 0 (includes new tests), typecheck 0, build 0, mobile game.html rebundled (162.8KB).

## Remaining mismatch (Stage 3 targets)
- City plates still tidy/regular: no broken rooflines, sparse facades, no sign silhouettes variety.
- Moon is clean cracked polygon; needs uneven plate/chip treatment.
- Terrain zigzag repeat; needs seeded slab variants.
- Composition: hero small vs reference; investigate camera framing AFTER world pass (Stage 5).

## Next action
Stage 3 task 1: add failing ink-city determinism/world-cell tests for broken-roofline variants before touching ink-city.ts.

## Server/tooling
- GAME_URL=http://127.0.0.1:3010 (restart after each rebuild: kill background proc, npm run start)
- Probe: node scripts/test-fidelity-browser.mjs
