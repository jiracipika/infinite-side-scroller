# Character identity in pixel art

The pixel roster uses the original bespoke ink painters as its art masters.
It preserves each character's anatomy, costume, palette and signature prop
instead of rebuilding the cast on one shared block-body template. The original
ink style remains available through the existing per-character unlock.

`../roster/preview/identity-comparison.png` compares the previous pixel update,
the original design and the restored pixel design for all 17 characters.

## Regeneration

With Playwright and a Chromium browser available:

```sh
node scripts/paint-character-sheets.mjs
node scripts/generate-character-sheets.mjs
node apps/mobile/scripts/bundle-game-html.js
```

The painter accepts `PLAYWRIGHT_PACKAGE` (an absolute package.json path for an
external Playwright installation) and `CHROMIUM_EXECUTABLE` (a browser path).
Playwright is only needed to repaint artwork, not to build or run the game.

Each PNG contains idle, run, air, dash, melee and tumble frames. The artwork
is rendered at two pixels per original world unit, then snapped to its
original solid colours and binary transparency. This preserves small costume
details while producing crisp pixels instead of anti-aliased edges.

`layouts.json` records the union of all six silhouettes, a shared body origin,
the original body dimensions and the idle preview bounds. Transparent padding
keeps scarves, capes, hats and weapons inside each frame. The renderer positions
every pose from the original body origin; the menu fits the entire idle
silhouette. Neither path changes the collision box or character statistics.

The generated TypeScript embeds both the PNGs and layouts, so web and offline
mobile gameplay use the same assets without network requests.
