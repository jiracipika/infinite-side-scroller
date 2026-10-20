# Ink cast, second edition

The reference is the bespoke ink roster before the painted Pixel-sheet overhaul,
not the later square sprites. All 17 default Ink characters have new geometry,
proportions, costume plates, faces and articulated props. This is a redraw, not
another palette pass or a restoration. Character IDs, abilities, unlock costs,
health, collision dimensions, world art and gameplay rules are unchanged.

## Character direction

| Character | Preserved identity / new treatment |
| --- | --- |
| Knight | Violet split cape, lime slit and cross; compact crested helmet, layered steel, articulated sword |
| Ninja | Lime scarf/eyes, swept hair; wrapped jacket, bent limbs, visible hand-held katana |
| Tank | Ember T-visor and tower shield; barrel cuirass, oversized pauldrons and thick greaves |
| Mage | Bent star hat and orb staff; paneled full-length robe, beard, rune clasp |
| Ranger | Forest hood, quiver and bow; asymmetric field cape, leather bandolier, drawn bowstring |
| Cyborg | Cyan visor/core; asymmetric armor plates, antenna, mechanical joints and forearm blade |
| Spirit | Paper hood and dark face; opaque layered wisps, folded tail and floating shards |
| Healer | Mint/white support identity; cap and bun, medical jacket, bag and lantern |
| Ansley | Red twin-tails, pierced cherry print, earbuds and parasol; curled thick locks and scalloped dress |
| Velvet | Bat collar and lace fan; pointed face, corset, layered cape and lace hem |
| Ember | Flame ponytail and twin fans; warm face, bare midriff, asymmetric wrap and flame cores |
| Rosalia | Rose crown and thorn whip; swept hair, petal skirt layers and opaque rose accents |
| Marionette | Porcelain face and ribbons; blunt bob, diamond eyes, frilled collar and puppet skirt |
| Dorian | Cavalier hat and rapier; feather, cravat, split-tail coat and hand-mounted guard |
| Onyx | Crimson martial scarf and kanabo; undercut, broad sleeveless gi, heavy club bands |
| Mortimer | Candle-bearing gentleman; tall hat, waistcoat, chain, three distinct candle flames |
| Grimshaw | Pointed crimson hood and crescent scythe; bone mask, broad folded robe and trailing hem |

## Animation / rendering repairs

- `character-motion.ts` derives gait from actual displacement and simulation time,
  independently for each local/remote Player object. It does not use the score
  distance (which advances during dash / against walls), render-frame counters,
  or wall-clock time. Ground-travel phase is frame-rate independent and resets
  on new-run clock rollback / teleport. Stops settle instead of freezing a split.
- Separate cycle phase distinguishes foot support/recovery even when stride is
  the same. Feet remain on the collision baseline; body-only bob is in the rig.
- Jump / falling leg positions differ. Dash overrides locomotion, then melee /
  ranged articulation layers on top. Weapons originate at the resolved hands;
  the renderer-only duplicate floating Ninja blade is removed.
- Ranged shots have a drawing-only 240ms recoil/casting timer. Projectile cadence,
  damage, input mappings and collision logic are unchanged.
- Cloth/hair follow-through, idle breathing and tumble remain deterministic.
  Reduced motion removes idle/tumble flourishes without hiding attack feedback.
- Default Ink was incorrectly drawing loaded Pixel sheets due to an inverted
  preference check. Ink now stays procedural; Pixel explicitly opts into the
  existing alternate sheets. Menu canvases repaint on preference/image-load
  events. Selected preview animation pauses offscreen / when the tab is hidden;
  roster chips do not each create a RAF loop. Larger thumbnails retain prop space.
- Fixed a discovered Motion hydration regression: replacing a hidden Motion node
  with a plain div retained opacity:0 for reduced-motion users, hiding the title
  and Play button. The stable node now explicitly reaches the visible state.

The old painters are retained, unmodified, only as the historical comparison
reference and unknown-ID fallback. `drawCharacterArt` is the shared live dispatch
for menus, gameplay, remote players and court enemies. `ink-redesign.ts` owns the
new art. The checked-in mobile WebView HTML is rebuilt from the same engine.

## Review artifacts

Open `design/roster-redesign/index.html` directly in a browser: self-contained,
no server needed. It has the 17-row old/new pose sheet plus an animated character
and action picker. `old-vs-new.png` is the static contact sheet.

Regenerate with `npm run art:preview`. This optional tool needs Playwright. If it
is installed outside the repo, set `PLAYWRIGHT_PACKAGE` to that package.json.
Set `ART_SCREENSHOTS` to choose an output directory.

## Verified release evidence

- `npm run verify`: all gates passed; 1,041 Node tests across the complete chain,
  zero failures. Lint has only the existing warnings in historical ink-crimson.ts.
- `npm run build`: successful optimized Next.js production build.
- `npm run test:character-browser` against that production server: all 17
  characters, 85 render-bound frames (idle/run/jump/air attack or cast/dash), real
  keyboard input, zero page errors. Actual loaded-image Ink/Pixel switch and
  immediate menu repaint asserted. Short desktop 1280×630 and phone 390×844
  framing checked; reduced-motion Play CTA visibility asserted.
- Measured production render-call median 0.4ms / p95 0.7ms in this headless probe;
  not a hardware FPS claim.
- `node apps/mobile/scripts/bundle-game-html.js`: regenerated 298KB offline HTML.
- `npm run test:character-mobile`: exercised that exact offline HTML for every
  character at a touch-enabled DPR-2 phone viewport, including native postMessage
  movement and jump input; zero page errors. This is a WebView bundle test, not
  an Android APK / iOS native-device test.
- Full pose-grid regression tests compare original/new geometry and cover
  opaque bounded drawing, both gait halves, attack layering, jump/fall,
  deterministic output, frame-rate-independent clocks, stopping, pause,
  teleport/restart, reduced motion and real ranged-animation recovery.

Browser commands accept `GAME_URL`, `ART_SCREENSHOTS` and `PLAYWRIGHT_PACKAGE`.
Run a production server (`npm run start -- --port 3010`) after building. Never
build into the same `.next` while a dev server is using it.
