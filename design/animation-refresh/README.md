# Full roster animation refresh

Serve this directory over HTTP and open `index.html` to compare all 17 characters walking in both directions, jumping/landing, dashing and attacking. Every character now uses twelve complete authored poses in the default Full Art style. The selectable Ink and legacy Pixel styles remain available.

`roster.json` defines the coverage: Knight, Ninja, Tank, Mage, Ranger, Cyborg, Spirit, Healer, Ansley (`cherry`), Velvet, Ember, Rosalia, Marionette, Dorian, Onyx, Mortimer and Grimshaw. The runtime coverage test compares the generated atlas keys with the actual game roster, so a missing character fails verification.

Each character has twelve 128px RGBA frames: four locomotion poses, idle, rise, fall, landing, dash, anticipation, strike and recovery. Tank and Onyx retain heavier steps; the casters keep their props and controlled gestures; Velvet and Rosalia move within their gowns; Spirit and Grimshaw glide without invented legs. Marionette retains her strings and jointed limbs. Ansley's darker complexion, red twin tails, earbuds, cherry dress and bag remain intact.

## Identity and workflow

Created using [Pixel Game Asset Skills](https://github.com/Mickls/pixel-game-asset-skills), specifically [generate-pixel-character-animation](https://github.com/Mickls/pixel-game-asset-skills/blob/b9f6cabf327a02521f380806eae497c7c20bcd56/skills/generate-pixel-character-animation/SKILL.md), at commit `b9f6cabf327a02521f380806eae497c7c20bcd56`.

The game's existing `design/full-art` figures provide identity references. The neutral walk guide was generated with that repository's `make_neutral_walk_guides.py`. Image generation produced complete pose studies; packing follows the skill's shared-scale, transparency and APNG workflow. No third-party character artwork was imported.

Where early action studies repeated a leading leg or changed scale, their first row is excluded and replaced by an independent four-frame locomotion sheet. Asymmetric ankle details make anatomical leg alternation inspectable. Healer's action study received a correction to remove a duplicated staff. Spectral and gown movement preserve each character's anatomy and silhouette. This is a side-scrolling Canvas integration, not a claim of four-direction/Godot validation.

## Packing and validation

Run `python scripts/build-character-animations.py` with Pillow installed. It writes the embedded game data, individual frames, lossless APNG previews, review-page roster and `packing-evidence.json`. All characters must pass before runtime data is emitted.

The packer preserves full-color RGB and binary alpha, applies a shared scale per character, and aligns locomotion by the head so a changing boot or weapon does not slide the torso sideways. Grounded frames share baseline 118; gliding frames keep the head height stable while their tails change length. It rejects opaque rectangular backgrounds (95% or more of a cropped cell), clipped frames, duplicate locomotion poses, unstable contact silhouettes (IoU below 0.85), horizontal drift above 6.5% and vertical drift above 3.5% of the frame. Source hashes and all frame bounds are recorded in the evidence file.

A conservative connected-component cleanup removes small isolated neighboring-cell fragments and tiny distant specks before computing bounds. It preserves connected weapons and substantial interior accessories. `python scripts/test-animation-packing.py` exercises boundary bleed, adjacent specks, preservation cases and opaque background rejection. Left APNG previews mirror complete right frames; limbs are never mirrored to fabricate alternating steps. APNG timing is 150/110/150/110 ms with full-frame replacement (`disposal=0`, `blend=0`). Numeric checks supplement visual inspection of identities, leg alternation, props and complexion.

After packing, run `npm run art:rig` and `npm --prefix apps/mobile run bundle-game` to refresh the animation studio and offline mobile bundle. Playback uses existing simulation travel phase and combat timers, with one image draw per character pose. All 17 decoded RGBA atlases total 12.75 MiB. The original art remains a loading fallback. No new animation loop, particle reduction, resolution change or per-frame sprite construction is introduced. Authored jump and landing frames contain their own compression; the generic spring transform is skipped once an atlas loads. Tumble retains its shared rotation.

Validation: `npm run verify`, `npm run build`, `npm run test:character-framing`, `npm run test:character-browser`, and `npm run test:character-mobile`. Browser framing checks cover all characters, all three styles, both directions and small/large menu previews, including the actual authored sheet cells.

## Full-roster validation results

- All 17 characters / 204 poses pass packing; a fresh temporary-directory repack produces byte-identical PNGs and APNGs.
- All 34 APNGs retain four frames, exact mirrored directions, full-frame replacement and the specified timing.
- Browser framing passes 9,792 preview checks across three styles and inspects all 204 authored cells with no clipping.
- Production gameplay passes 85 captured action checks across all 17 characters; the checked-in offline mobile HTML passes movement and jump bridge checks for all 17.
- `npm run verify`, production build and five packing regression tests pass. Visual review includes the full roster, combat poses and Marionette's corrected transparent background.

The production browser probe observed a 0.4 ms median / 0.6 ms p95 for its paused-scene render sample on the test machine. This is a local renderer measurement, not a device FPS guarantee or a before/after benchmark.
