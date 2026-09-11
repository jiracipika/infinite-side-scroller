# Dashverse Sketch-to-Gameplay Fidelity Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Parent owns visual judgment and final verification. User requested staged planning first; do not mistake this document for completed implementation.

**Goal:** Make infinite-side-scroller's playable world resemble the approved inked graphic-novel concept, not merely its palette.

**Architecture:** Preserve physics, level generation, collision geometry, character identity and controls. Improve deterministic Canvas 2D art through shared ink primitives, cached environment details and existing pose solvers. Treat composition/zoom as a separate measured decision rather than quietly changing gameplay to match an illustration.

**Tech Stack:** Next.js 15, React 19, TypeScript, Canvas 2D, existing Node test runner, external Playwright tooling, bundled React Native WebView game.

---

## Resume here

- Repository: `/Users/rs-mac/projects/infinite-side-scroller`.
- Initial inspection: clean worktree, `git pull --ff-only` returned already up to date; HEAD `7eef70a`.
- Planning status: STAGES 1-5 COMPLETE AND PUSHED (f26b553 stage1-2, 5b809da stage3, 3e67dcc stage4, f868b6e stage5). Stage 6 (independent review of 4+5, final docs, release evidence) IN PROGRESS.
- NEXT: finish stage 6; see docs/art/graphic-novel-checkpoints.md for full per-stage evidence and remaining polish niggles.
- Approved reference: `/Users/rs-mac/Downloads/dashverse-neon-graphic-novel-concept.png`.
- Historical screenshot inspected: `/Users/rs-mac/Downloads/dashverse-ink-overhaul/gameplay.png`. This is saved evidence, NOT a fresh runtime verification of HEAD.
- Previous work and constraints: `docs/NEON-OVERHAUL.md`.
- Skills: `canvas-game-art-direction`, `html5-canvas-game`, `test-driven-development`; load implementation/review skills when executing.
- Scope: infinite-side-scroller only. Do not touch automated-newsletter or pitchforge. No global model/provider changes.

## What the picture actually asks us to reproduce

The left panel is a composition reference, not a level specification; the right panel is a menu/character study, not a sidebar that must occupy gameplay.

1. Near-black solid silhouettes with broken, heavy ink contours, not wireframe outlines.
2. A recognizable spiky-haired ninja, bent limbs and cloth/scarf gestures, with sharp lime eyes and torn directional action strokes.
3. Irregular ruined industrial towers, exposed cross-bracing and dense vertical signs. Distance reads through distinct opaque violet values.
4. A fractured lavender moon made of uneven plates/chips, distressed printing and missing pieces, not a regular polygon with a few thick cracks.
5. Thick black platform masses with chipped facades and scratched/hatch texture. Thin lime landing lips; coral spike tips and enemy danger cues.
6. Selective distressed printing and diagonal brush marks. Not uniform random noise across everything, glow, blur or transparent scenery.
7. A sparse readable HUD and forceful cut-paper/brush typography. Gameplay art must come first.

## Honest gap assessment

The saved gameplay has the correct purple/black/lime family, layered towers and traversal rims, but still looks like tidy vector geometry. Windows repeat regularly; facades are sparse; the moon is a clean cracked polygon; ground has a repeated zigzag pattern. The hero occupies a small part of the frame and reads largely as a thin outline. A large empty black lower region weakens composition. These are silhouette, shape, texture and framing problems, not reasons to recolor the UI again.

Do not promise exact replication of an illustrated board in every procedural frame. Target its visual language while preserving predictable landings and look-ahead.

## Rules for every implementation slice

- One bounded visual objective per slice; retain a playable build throughout.
- Write/extend a focused failing test, run it and record the actual failure, implement, then rerun. Source regex alone cannot prove visual quality.
- Runtime painter tests must check determinism, finite geometry, balanced save/restore and opaque fills. Hazard/terrain art cannot suggest a different collision edge.
- Cache static texture. No per-frame random speckle, full-screen blur or unbounded line/particle counts.
- Keep lime for hero/readable interactions and landing lips; environment accents violet/lavender; danger coral. Preserve existing character identities.
- Test normal and reduced detail/motion. Keep existing input and multiplayer behavior unchanged.
- After a slice: capture a live frame, inspect against the reference, document remaining mismatch. A green palette test is not visual acceptance.
- Before committing code run full verification; after any game-source change rebundle mobile. Commit explicit owned files, push main only after verification, confirm remote SHA.

## Stage 1 — Fresh baseline and visual comparison harness

**Objective:** Establish what HEAD actually looks like and prevent another palette-only pass.

**Files:**
- Modify: `scripts/test-ink-art-browser.mjs`
- Modify: `scripts/test-ink-perf-browser.mjs`
- Create: `docs/art/graphic-novel-checkpoints.md`
- Create: `docs/art/reference/graphic-novel-concept.png` (copy approved Downloads source unchanged)

**Small tasks:**
1. Recheck git status and pull before editing. Resolve external Playwright package path and local server availability; never guess them.
2. Run existing art probe on a production build. Save untouched baseline under `~/Downloads/dashverse-fidelity/stage-1/`.
3. Extend capture coverage to explicitly select the Ninja and also retain default-character coverage. Record character, viewport, DPR, biome and action state with each image.
4. Capture actual idle, run, jump, dash and combat states plus a naturally reached elevated-platform scene. Any debug-set scene must be labeled separately from real-input evidence.
5. Add scoped render-method timings (median/p95) to the performance probe; retain existing metrics but never call headless rAF cadence device FPS.
6. Record baseline costs and the top three visual gaps in the checkpoint document.

**Acceptance:** Reproducible full-size frames with known character/action, no page errors, real movement/jump/attack assertions passing. A versioned copy of the reference and fresh evidence exist. Do not infer fresh visual state from historical screenshots.

## Stage 2 — Hero silhouette and pose fidelity

**Objective:** Make the Ninja read as the reference's inked character at actual gameplay size.

**Files:**
- Modify: `src/game/rendering/character-art.ts`
- Modify only rendering integration as needed: `src/game/entities/player.ts`
- Test: `test/ink-ninja.test.ts`, `test/ink-knight.test.ts`

**Small tasks:**
1. Inspect pose solvers/render transforms. Add failing painter tests for finite silhouette paths and balanced context in idle/run/jump/dash/attack.
2. Replace fragile thin body geometry with filled head/torso/limb masses. Use recognizable hair spikes, negative-space limb separation and a small lime visor.
3. Add angular cloth/scarf shapes and limited hatch/fold strokes attached to existing pose joints; retain other characters' identities.
4. Review normal-size and enlarged diagnostic images. Enlarge the capture for diagnosis, not the collision box.
5. Compare active poses, reduced motion, default Knight and Ninja at desktop and phone sizes.

**Acceptance:** Hero remains readable against all three city depth plates. Run, jump and attack differ in silhouette, not only FX. Hitbox, attack timing and movement unchanged. If too small at gameplay scale, record it for Stage 5 rather than silently scaling physics.

## Stage 3 — Ruined city and fractured moon

**Objective:** Replace clean modular geometry with deliberate illustrated shapes and opaque depth.

**Files:**
- Modify: `src/game/rendering/ink-city.ts`
- Modify: `src/game/rendering/background.ts`
- Create if shared primitives are needed: `src/game/rendering/ink-marks.ts`
- Test: `test/ink-city.test.ts`, `test/ink-world.test.ts`
- Existing wiring gate: `scripts/test-neon-backdrop.mjs`

**Small tasks:**
1. Add deterministic geometry and opaque-color tests before changes. Assert world-cell stability while resizing/moving the camera.
2. Create several seeded broken-roof silhouettes rather than one repeated stepped roof.
3. Add sparse exposed braces, irregular window groups, rooftop structures and violet sign silhouettes. Vary clusters rather than sprinkling every detail evenly.
4. Redraw the moon as uneven separated plates with small chips and clipped distressed patches. Preserve day-cycle visibility rules.
5. Cache static print marks and cap details by fidelity tier. Inspect bright/dark biome transitions and reduced-detail mode.

**Acceptance:** Three readable depth layers; irregular industrial silhouette; fractured moon recognizable at normal size. No lime environment clutter, resize jumps, shimmer, transparent scenery or new full-screen effects. Compare measured render cost with Stage 1.

## Stage 4 — Terrain, hazards and action marks

**Objective:** Make the playable foreground feel inked, weighty and dangerous where appropriate.

**Files:**
- Modify: `src/game/rendering/ink-city.ts`, `src/game/rendering/renderer.ts`
- Inspect/integrate cache: `src/game/engine/terrain-cache.ts`
- Rendering-only changes as needed: `src/game/hazards/index.ts`, `src/game/entities/particles.ts`, `src/game/rendering/power-fx.ts`
- Test: `test/ink-city.test.ts`, `test/ink-world.test.ts`
- Gate: `scripts/test-ink-enemy-palette.mjs`

**Small tasks:**
1. Add recorder-context tests that enforce exact visible collision tops and roughness only below/around those surfaces.
2. Replace repeated zigzags with a few seeded facade variants: broken slab, braced wall, distressed masonry. Bake into terrain cache.
3. Keep landing lips crisp and sparse. Separate coral spike tips from violet decoration; do not change hazard extents.
4. Refine dash/attack into tapered cut-ink wedges with a few directional scratches instead of diffuse trails. Respect reduced motion and existing particle caps.
5. Review overlapping combat/enemy/collectible cases. Expand the palette gate only when necessary; do not rewrite AI.

**Acceptance:** Landing surfaces remain unambiguous; danger reads before contact; character not obscured by FX. No collision, spawn or combat behavior changes. Ground variety is stable across chunk reuse.

## Stage 5 — Composition and presentation

**Objective:** Improve the image as a whole after its main forms work.

**Files:**
- Inspect first: `src/game/engine/camera.ts`, `src/game/rendering/renderer.ts`
- Test if camera changes justified: `test/camera-reduced-motion.test.ts`
- Menu polish only if still needed: `src/components/StartScreen.tsx`, `src/components/StartScreen.module.css`
- Existing QA: `scripts/test-neon-menu-browser.mjs`, `scripts/test-neon-touch-browser.mjs`

**Small tasks:**
1. Compare whole frames with the concept. Determine how much weak framing is camera scale versus the flat opening segment; inspect later gameplay before deciding.
2. Prefer richer foreground composition over cropping away visibility. Prototype camera framing separately only if the hero still reads too small.
3. Any camera adjustment requires tests for look-ahead, safe landings, touch-control clearance and reduced motion; reject it if playability declines.
4. Polish menu brush shapes/character portrait only after gameplay passes. Preserve every destination and settings disclosure.

**Acceptance:** Strong hero/terrain/background hierarchy without copying the concept's sidebar or changing level generation to fake a match. No clipped HUD, menu overflow, hidden hazards or touch overlap at 320px, 390px, 768px and desktop widths.

## Stage 6 — Integrated release and handoff

**Objective:** Ship a verified improvement with evidence that supports the visual claim.

**Commands from repo root (production server separate from builds):**

    npm run verify
    npm run build
    npm run release:evidence
    node apps/mobile/scripts/bundle-game-html.js

Resolve `PLAYWRIGHT_PACKAGE` to a real tooling package with Playwright installed and `GAME_URL` to the actual production server before running:

    node scripts/test-ink-art-browser.mjs
    node scripts/test-ink-perf-browser.mjs
    node scripts/test-neon-menu-browser.mjs
    node scripts/test-neon-touch-browser.mjs

**Small tasks:**
1. Run full verification and production build, fixing real regressions before release claims.
2. Run art/menu/touch and performance probes with the resolved environment variables; save outputs in the stage's evidence directory.
3. Inspect paired before/after frames against the concept. Document which gaps remain instead of reporting exact fidelity.
4. Confirm bundled mobile game is regenerated. Physical-device/native overlay parity remains unverified unless actually exercised.
5. Commit owned changes, push, verify `git rev-parse HEAD` against `git ls-remote origin refs/heads/main`.
6. Update this plan and `docs/NEON-OVERHAUL.md` with exact completion state, tests and screenshots.

**Release acceptance:** Full checks pass, fresh real-input screenshots inspected, no new runtime errors, measured performance acceptable relative to baseline, mobile bundle current, remote commit verified. A target of full-render p95 around 4ms at 1280x720 is a comparison budget from prior work, not a guaranteed result or FPS claim.

## Mandatory checkpoint after every stage / before context runs out

Update `docs/art/graphic-novel-checkpoints.md` and the Resume section above with:

    Stage: [number/name]
    Status: [not started / in progress / verified / blocked]
    Local commit / remote SHA: [actual values, distinguish unpushed]
    Changed files: [exact paths]
    Tests: [commands + observed results; not expected results]
    Images: [absolute paths + what was visually inspected]
    Remaining mismatch: [specific visible gap]
    Next action: [one concrete task]
    Server/tooling: [URL, launch command, Playwright package path]
    Uncommitted work / blockers: [explicit]

Never start the next large stage with an undocumented half-finished one. Resume by reading this plan, checkpoint, git status/diff and current code—not by redoing the menu or trusting a previous completion summary.
