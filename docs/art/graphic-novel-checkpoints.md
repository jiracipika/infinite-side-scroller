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

## Stage 6 — release + handoff — VERIFIED (final commit of campaign)
- Independent review (glm-5.3, /tmp/dashverse-stage45-review.log): SPEC PASS; QUALITY REQUEST_CHANGES with 1 real blocker — 8px contour seam at chunk ends in high detail (loop bound stopped one step short). Fixed: loop now runs to full width (i1 clamps), round lineCap added. Reviewer also found dash seed param inert at call site — fixed with distance-based seed (stable per position, no frame jitter). Tests tightened per review: exact-Y ±4 with nonzero offsetX=40 case, new full-width coverage test incl. low detail tier.
- Post-fix: full test suite green, verify 0, build 0, mobile rebundled, final probe stage-6-final (knight 0.8/1.4ms, ninja 0.7/1.4ms, 0 errors).
- Camera change independently verified sound by reviewer (left-wall clamp exact; split/portrait only affected via focusX, fine for rightward runner; lookahead spawn window shift benign).
- release:evidence gates all present.

## Campaign complete — final state
- 6 pushed commits: 7eef70a(pre) → f26b553(S1-2) → 5b809da(S3) → 3e67dcc(S4) → f868b6e(S5) → stage6-final(this).
- Remaining known polish (optional future work, not regressions): bottom ~15% flat black under root detail; cyan orb vs moon-burst focal competition; hero still ~3% frame height (zoom rejected for hazard visibility); native-shell theme parity untested this campaign.

## Next action
None — campaign per plan complete. If resumed: start from remaining polish list above, or new user direction.

## Server/tooling
- GAME_URL=http://127.0.0.1:3010 (restart after each rebuild: kill background proc, npm run start)
- Probe: node scripts/test-fidelity-browser.mjs

## Polish pass — Sep 11, 2026 — VERIFIED (all 4 remaining items)
- Underground flat black (textures.ts): STRATA_DEPTHS extended 3→8 bands (18..560px), deep bands (>=150px) stroke #8e799e violet at boosted alpha/min-0.16 cap and 1.8w; speckle maxDepth 0.6/120→0.92/640. Vision: layered violet treatment confirmed, not flat. Legacy world-textures test (strictly decreasing alphas) kept green.
- Shield orb/aura focal competition (renderer.ts + game-engine.ts): orb #67e8f9/#0891b2 → #c4b5fd/#7c3aed, glyph #ecfeff→#f5f3ff, player aura #06b6d4*→#8b5cf6*. Source test bans cyan in the shield case.
- Hero prominence (camera.ts WORLD_ZOOM=1.5 + game-engine render-pass transform): save/translate(0.4w,0.6h)/scale/translate-back before drawTerrain, restore after drawParticles. Camera math, culling, chunk cache, HUD untouched. Vision progression: 1.25 "doesn't read" → 1.35 "subtle" → 1.5 = hero ~6% frame height (from ~3.5%), 70%+ area gain. Reviewer's 15-25% target = 4-6x zoom, rejected: a runner needs hazard reaction distance; 1.5 keeps coins/hazards visible to the right edge (vision-verified twice).
- Mobile shell theme parity (apps/mobile app/(tabs) + components): #0A84FF→#c7ff4d (lime), #101014→#0a0a0f, rgba(10,132,255,*)→ink-violet rgba(142,121,158,*) (accent-alpha cases → lime rgba), white→ink text on lime buttons. New test/mobile-theme-parity.test.ts enforces: no iOS blue/#101014 anywhere in shell, tokens present, dark text on lime.
- Gates: 605 tests green, typecheck 0, build 0, verify 0, mobile game.html 164.0 KB, live probe polish-final (render 1.1/2.5ms knight, 1.2/2.8ms ninja, 0 errors), menu probe PASS.
- Evidence: ~/Downloads/dashverse-fidelity/polish{,2,3,-final}/
- Vision flags deliberately not actioned: hero 15-25% zoom (breaks runner lookahead), coin-cluster gap (procedural spawn rhythm, not art), x≈945 backdrop shade shift (parallax plate boundary, low contrast by design).

## Menu cover polish — Sep 11, 2026 — VERIFIED (the "only if still needed" Stage-5 conditional; it was needed)
- Vision review of menu vs new gameplay art: splash + knight portrait already on-identity; clashes = SPD/JMP stat bars (old neon #7170ff blue / #10b981 teal), undocumented coral compete edge, bare-dot profile button.
- Fixes (TDD, test/menu-theme.test.ts RED first): SPD → ink violet #9d82ff, JMP → ink lime #c7ff4d (HP stays coral — shared health semantic with the in-game orb); coral compete edge documented in StartScreen.module.css as the deliberate COMPETE semantic accent; profile button's bare ● replaced by the player's initial (Impact italic, "??" fallback).
- Vision re-check: bars confirmed violet/lime, profile glyph present (reads "P"), no layout breaks; menu probe PASS, mobile shell untouched this pass.
- Gates: tests green, typecheck 0, build 0, verify 0, game.html 164.0 KB.
- Evidence: ~/Downloads/dashverse-fidelity/menu-review (before) / menu-fixed (after).
- Remaining known items now: NONE from the campaign list. Off-palette-but-defensible (documented, not changed): HP coral, gold coin icons, gray bank chip.
