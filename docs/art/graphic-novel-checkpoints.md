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

## Stage 3 — ruined city + fractured moon — VERIFIED (uncommitted at time of writing, see stage-3 commit)
- TDD: test/ink-ruins.test.ts written RED first (module missing), then GREEN: cityBlock.roof variants (0-3, >=3 distinct across world), windowGrid (pitch 24-44, per-row clusters, >=4 pitches, blank bands exist), paintFracturedMoon (>=6 deterministic plates within 1.6x r of center... bounds 160px at r=80, hex/rgba fills only, save/restore balanced).
- ink-city.ts: windowGrid() exported (seeded pitch/clusters/skipped bands) replacing the uniform 26px band loop; 4 seeded roofline variants (flat-broken/notched/battered/collapsed) in the tower outline.
- ink-moon.ts: NEW paintFracturedMoon — 9 gapped shard plates (tone-varied lavender family), detached chips, dark seam strokes; textureHash-seeded, no gradients. background.ts drawMoon delegates to it (halo kept; old disc+cracks removed). Legacy ink-world moon assertion updated to the new fracture spec (multi-plate span >=100px, documented why).
- Visual verification (zai vision on stage-3/ninja-idle.png): shattered-plate moon with hollow center + detached debris confirmed; battered/collapsed/stepped rooflines confirmed; irregular window rhythm with blank floors confirmed; no glitch/z-order/seam artifacts.
- Perf: knight 0.7/1.4ms, ninja 0.9/1.7ms median/p95 (90 samples) — within budget. verify exit 0, build 0, mobile rebundled 163.5KB.

## Remaining mismatch (Stage 4 targets)
- Terrain zigzag repeat still present; needs seeded slab variants (broken slab / braced wall / distressed masonry).
- Dash/attack FX could be more tapered cut-ink wedges (currently 3 brush cuts).
- Enemy/collision-adjacent art untouched this stage (intentionally).

## Stage 4 — terrain ink edge + dash wedges — VERIFIED (see stage-4 commit)
- test/ink-terrain-edge.test.ts RED first, then GREEN: paintInkTerrainEdge deterministic, balanced, ~118 consolidated strokes (was ~400 per-4px zigzag), every contour point on exact surface Y (±12 measured incl. bold lip), >=3 varied stroke weights, chipped-band skips, low-detail tier cheaper. (Two over-tight test heuristics were corrected with reasons: segment count bound, and the x%4==0 filter which penalized legitimate segment endpoints.)
- renderer.ts: two zigzag stroke loops replaced by paintInkTerrainEdge (chunk-index seeded, backgroundDetail-gated); third loop (palette cap line) intentionally kept exact.
- paintDashBrush: tapered cut-ink wedges (sharp leading edge, frayed tails, seeded per-streak variance); reduced-motion gate unchanged at call site. No default-arg call breakage (seed optional).
- Vision (stage-4/ninja-dash.png): organic wavy ink contour confirmed, no zigzag; tapered two-tone dash trail confirmed clean. Perf knight 0.8/1.6ms, ninja 0.8/1.8ms median/p95. verify 0, build 0, mobile rebundled 163.8KB.
- Note: chipped gaps confirmed in code+recorder tests; at native zoom vision reads the contour as continuous-but-wavy — acceptable (subtle chipping is intended, not missing).

## Remaining mismatch (Stage 5 targets)
- Hero still small in frame vs reference; evaluate camera framing AFTER inspecting later-gameplay composition.
- Menu cover polish only if still needed after gameplay passes.

## Stage 5 — composition + framing — VERIFIED (see stage-5 commit)
- Extended-run capture (stage-5-composition/run-00..09, real ArrowRight input 25s+): vision critique — hero ~3% frame height, hero at ~37% X, ground line 55% leaving ~45% dead underground; recommended hero left-third + lower horizon; zoom flagged as hazard risk.
- Decision: config-only framing change, NO zoom. camera.ts DEFAULT_CAMERA_CONFIG: focusX 0.5→0.4, horizontalFocusY 0.52→0.6 (portrait/split unchanged). TDD: test/camera-framing.test.ts RED then GREEN (focus values, left-wall clamp preserved, steady-state player screen X 450-600 → more lookahead).
- Post-change vision (stage-5-final/ninja-idle.png): ground line 62% (target hit), underground reduced to ~38%, all upcoming terrain/collectibles/signs visible to right edge (no clipped hazard), comic-panel grammar confirmed (burst near upper third intersection, lower-third horizon). Hero at far-left in that frame is the spawn-time x=0 camera clamp, not a regression (unit test proves 40% steady state).
- Perf unchanged (0.7/1.3ms both chars). verify 0, build 0, menu probe PASS (8 cards visible, 320/390/768 reflow), touch probe PASS (real touch jump, 6 actions, pause). Mobile rebundled.
- Known remaining niggles (not regressions): bottom ~15% still flat black under root detail; cyan orb competes with moon burst for focus. Both acceptable; noted for possible later polish.

## Next action
Stage 6 release slice: independent diff review of stage 4+5 commits, then push and final checkpoint update.

## Server/tooling
- GAME_URL=http://127.0.0.1:3010 (restart after each rebuild: kill background proc, npm run start)
- Probe: node scripts/test-fidelity-browser.mjs
