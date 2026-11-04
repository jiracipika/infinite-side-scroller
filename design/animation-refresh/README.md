# Knight, Ninja and Ansley animation refresh

Open `index.html` alongside this directory to inspect walking in both directions, jumping/landing, dashing and the three-stage attack. The game uses these complete authored frames in the default Full Art style. The other fourteen characters retain their existing art; the selectable Ink and legacy Pixel styles remain available.

Each character has twelve 128px RGBA frames: four alternating contact/passing poses, idle, rise, fall, landing, dash, anticipation, strike and recovery. Playback uses the existing simulation travel phase and combat timers. No extra animation loop, mesh deformation, particle reduction or resolution change is introduced. Jump and landing drawings already contain their body compression, so the generic spring transform is skipped for these loaded authored frames. Tumble still uses the shared rotation.

The legacy Pixel lane also respects explicit movement through zero-stride crossings and shows ranged attacks. It no longer flashes idle between steps or ignores a caster's attack.

## Identity and workflow

Created using [Pixel Game Asset Skills](https://github.com/Mickls/pixel-game-asset-skills), specifically [generate-pixel-character-animation](https://github.com/Mickls/pixel-game-asset-skills/blob/b9f6cabf327a02521f380806eae497c7c20bcd56/skills/generate-pixel-character-animation/SKILL.md), at commit `b9f6cabf327a02521f380806eae497c7c20bcd56`.

- The identity board derives from the game's existing character references: Knight's steel armor/lime cross/purple cape, Ninja's dark outfit/lime scarf and dagger, and Ansley's red twin tails/earbuds/cherry dress/bag and warm brown skin.
- The neutral right-walk guide was generated with that repository's `make_neutral_walk_guides.py`. Fresh identity + motion references were used for each complete walk attempt.
- Early action studies repeated a leading leg; their first row is excluded. The final walks are independent complete four-frame generations. Knight and Ninja use compact guarded steps to retain stable silhouettes; Ansley keeps her expressive arm swing. Small asymmetric knee/thigh/sock details make anatomical leg alternation inspectable.
- Ansley's action study received a skin-only correction to retain her darker complexion. Her clothing, socks and earbuds retain their colors.
- No third-party character artwork was imported. The side-scroller consumes right-facing frames and its existing facing transform mirrors them. This is a Canvas integration, not a claim of four-direction/Godot validation.

## Reproduction and checks

`python scripts/build-character-animations.py` (Pillow required) packs the source sheets, writes the embedded game data and lossless APNG previews. It preserves full-color RGB, uses binary alpha, applies shared scaling, aligns locomotion by the head rather than the changing boot/weapon bounds, and anchors every frame at baseline 118. It rejects clipped frames, duplicate walk poses, unstable contact silhouettes (IoU below 0.85), and excessive horizontal/vertical drift. Left previews mirror complete right frames; limbs are never mirrored to fabricate alternating steps.

The current contact silhouette IoU values are Knight 0.926, Ninja 0.940 and Ansley 0.945. Source hashes, frame order and bounds are recorded in `packing-evidence.json`. APNG previews use 150/110/150/110 ms with full-frame replacement (`disposal=0`, `blend=0`). Manual inspection checks the marked leg alternation, attached weapons, character identity and complexion in addition to numeric checks.

After packing, run `npm run art:rig` and `npm --prefix apps/mobile run bundle-game` to refresh the animation studio and offline mobile bundle. The three runtime sheets occupy 2.25 MiB of decoded RGBA pixels and require one image draw per character pose. Existing bounded mesh caching remains for the rest of the roster.

Validation commands: `npm run verify`, `npm run build`, `npm run test:character-framing`, `npm run test:character-browser`, and `npm run test:character-mobile`.
