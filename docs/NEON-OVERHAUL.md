# Dashverse — neon graphic-novel overhaul

## Approved direction
Black ink silhouettes, opaque scenery, lime interaction accents, violet depth and coral danger. Concept board: /Users/rs-mac/Downloads/dashverse-neon-graphic-novel-concept.png (art direction, not implemented gameplay).

Palette: background #0a0a0f; panels #1c1c2e; lime #c7ff4d; violet #9570ff; coral #ff7166; text #f4f2ed.

## Ownership
- Parent design lead: art direction, world rendering, character readability, integration, visual review, regression verification and final main push.
- GLM 5.3-flash menu worker: isolated ../dashverse-neon-menu, branch design/neon-menu; StartScreen.tsx, optional scoped CSS and targeted tests only.
- GLM 5.3-flash HUD worker: isolated ../dashverse-neon-hud, branch design/neon-hud; HUD.tsx, optional scoped CSS and targeted tests only.
Workers must not merge/push or edit global styles/gameplay. Parent reviews commits before integration. Explicit CLI model/provider overrides leave parent and global delegation settings unchanged.

## Overhaul acceptance criteria
- Real game-world refresh, not merely menu recoloring: readable opaque terrain, layered violet backgrounds, lime hero emphasis, danger distinct from friendly accents.
- Existing characters retain identity; silhouette/contrast improvements do not alter collision geometry.
- Menus retain every game mode and interaction; Play visually dominant.
- HUD retains truthful metrics and contextual level/multiplayer information.
- Touch controls remain usable. Desktop 1280x630 and phone layouts reviewed.
- No new heavy dependencies or full-screen per-frame blur. Existing reduced-motion/particle settings respected.
- Full tests, TypeScript, lint, production build and live-browser checks on integrated result.
- Push only after review; verify exact remote SHA. Document limitations honestly.

## Status
The initial world/menu/HUD pass shipped at `7a60f8b`. The original worker launch notes above describe that completed integration, not running workers.

### Follow-up: menu fit and touch ink pass
- DASH / VERSE is now the main title; Run the edge is the eyebrow.
- All eight destination cards fit a 1280x630 desktop viewport with the keyboard hint still open. Scoped compact typography/spacing preserves the scrolling shell for expanded panels.
- Browser touch controls now use ink panels, lime movement/jump, violet abilities and coral combat; removed backdrop blur and scaling of held targets. Player opacity/size/handedness preferences and input bindings remain intact.
- Live testing found overlapping pause controls. The web page now supplies one shared 44px keyboard/touch pause button, rather than drawing both page and overlay controls.
- Added repeatable Playwright probes for short desktop/320px/390px/768px reflow and live touch-to-player jumps, six action press/release pairs, held icon contrast, and pause. Source contracts for the previous HUD pass and new touch styling now run in `npm test`.
- Parent verification: full `npm run verify` (including 553 core tests, TypeScript and lint), production build, release-evidence check, and both browser probes against the production server passed.
- Scope: browser UI including mobile browsers. The separate React Native menu/control overlays were not restyled or device-tested in this slice.

### Repeat browser QA
Install Playwright outside the application (or in your tooling workspace). Set `PLAYWRIGHT_PACKAGE` to an absolute package.json path from which `require('playwright')` resolves. Google Chrome must be installed. Start the built app separately; never run dev and build against the same `.next` directory concurrently.

```sh
GAME_URL=http://127.0.0.1:3010 PLAYWRIGHT_PACKAGE=/absolute/tooling/package.json node scripts/test-neon-menu-browser.mjs
GAME_URL=http://127.0.0.1:3010 PLAYWRIGHT_PACKAGE=/absolute/tooling/package.json node scripts/test-neon-touch-browser.mjs
```

Screenshot output defaults to `/tmp/dashverse-menu-qa.png` and `/tmp/dashverse-touch-qa.png`; override with `MENU_SCREENSHOT` / `TOUCH_SCREENSHOT`. The browser scripts are opt-in local QA, not part of the dependency-free unit-test command.

### Concept-fidelity pass 2 (2026-09-05, slice F)
- Ink clouds: near-black inked bodies w/ light top rim (were 11%-alpha white
  ellipses — invisible). Opaque fills per art direction.
- Ink city skyline: deterministic silhouette towers between the chromatic
  streams and near ridge — lit windows brighten at night, ~1-in-3 towers carry
  a vertical neon sign (lime/violet/coral, local glow, flicker frozen under
  reduced motion). Contract gate: scripts/test-neon-backdrop.mjs (in npm test).
- Live frame QA: night scene shows ink clouds w/ rim, towers w/ windows, sign
  strips in the approved accent trio. Perf, build, evidence green.

## Concept-fidelity pass 3 — moment FX (2026-09-05, slice G)
- Biome-entry title card: engine dispatches `dashverse-biome` (CustomEvent) once
  per biome change during a run; BiomeTitleCard plays a graphic-novel ink card
  ("NOW ENTERING / VOLCANIC", skewed ink panel, accent underline in the biome
  platform color, ink-wipe entrance, ~1.4s hold, aria-live). Animation frozen
  (static card) under reduced motion. Tracker resets per run.
- Game-over knockout flash: 2-frame ink/paper flash + radial burst lines
  (repeating-conic-gradient) for ~650ms before the results panel reads.
  aria-hidden, pointer-transparent, fully skipped under reduced motion, no
  canvas/engine timing touched.
- Contract gate scripts/test-neon-moments.mjs (9 assertions, in npm test).
  Live QA: card renders + auto-unmounts on event; flash observed on a real
  natural game-over transition (DOM watcher). Verify + build + evidence green.

## Gameplay ink pass 4 — playable graphic-novel world (2026-09-06)
- Three-plate industrial city (`src/game/rendering/ink-city.ts`): deterministic
  world-cell towers ×3 parallax tiers with antennas, fire escapes, water tanks,
  sagging cables; screenprint facade texture baked into the terrain cache; all
  emphasis violet/lavender — lime stays reserved for traversal.
- Terrain is now black ink with a lime traversal rim; platform slabs get rough
  undersides below an exact collision top; decorations are non-colliding ink
  roof props (antenna trees, hazard-hatched boxes). Legacy hills/streams/dup
  skyline removed from background.ts (−500 lines net).
- Knight redrawn as an armored ink silhouette (cape, lime visor) using the
  shared pose solvers; Slime/Beetle recolored to black bodies + coral eyes;
  spikes/crumbling platforms now black with coral tips + warning hatch; enemy
  "!" ink-burst alert on chase/attack entry; brush-cut dash trails (reduced-motion gated);
  HUD panels are angular clip-path slabs with outlined condensed score type.
- Runs open on the violet moon (skyClockOffset phase 0.8); day/night tint now
  renders BEHIND gameplay so hero/hazard ink is never muted; only the dominant
  celestial body draws during dawn/dusk crossfade.
- Gates: test/ink-city.test.ts, test/ink-knight.test.ts, rewritten
  scripts/test-neon-backdrop.mjs + scripts/test-ink-art-browser.mjs (menu/
  gameplay/traversal/combat/dash screenshots + live-engine assertions).
  Verified: 582 core tests + contract suites, typecheck, lint, production
  build, release:evidence, production-server browser probes (menu reflow,
  touch, ink art), mobile game.html rebundled. Render profile on live engine:
  full render median 1.6ms / p95 3.8ms per frame (headless, 1280×720).
- Palette ratios enforced: ~70% black/purple plates, 20% violet/lavender, 10%
  lime/coral accents (bright color only on things the eye must find).

## Graphic-novel fidelity campaign (2026-09-10, stages 1-5)

Plan: docs/plans/graphic-novel-fidelity.md · Evidence: docs/art/graphic-novel-checkpoints.md + ~/Downloads/dashverse-fidelity/

- Stage 1-2 (f26b553): render-bound capture harness (state+canvas read inside a
  matching painted frame, unit-tested) + Ninja redrawn as filled articulated ink
  anatomy (new ink-ninja.ts, 20x30 author scale) + katana slash accent; enemy
  palette gate fixed to not require playwright for source audit.
- Stage 3 (5b809da): ruined skyline (4 seeded roofline variants, windowGrid with
  variable pitch/clustered/skipped bands) + fractured-plate moon (new ink-moon.ts,
  9 gapped shards, gradient-free).
- Stage 4 (3e67dcc): paintInkTerrainEdge replaces per-4px zigzag loops (consolidated
  seeded segments, varied weight, chipped bands, exact collision Y); dash redrawn
  as tapered cut-ink wedges.
- Stage 5 (f868b6e): comic-panel camera framing — focusX 0.4, horizontalFocusY 0.6.
  No zoom (vision analysis showed right-edge entity clipping); lookahead preserved
  and vision-verified.
- All stages TDD (RED first), full npm run verify green each time, mobile bundle
  rebundled each time, live browser probes (art/menu/touch) passing.

## One drawn mark set — interface ink pass (2026-11-24)

System emoji were the last foreign object on the meta screens: they differ per
OS, sit outside the palette, and (as the touch cluster's "ATK"/"HELP" labels
and pencil-like melee mark showed) cannot be tuned for legibility. Every
interface mark is now drawn by `src/components/Icon.tsx` on one 24-unit stroke
grid.

- **Drawn, never emoji.** `<Icon name="…" />` is the only way to put a mark on
  a screen. Names are typed (`IconName`), so a typo in data is a compile error
  rather than a blank tile at runtime.
- **Where the data lives.** `icon-paths.ts` is generated — Lucide 0.454.0 path
  data with the ISC notice embedded — by `scripts/generate-icon-paths.mjs`;
  add a name to `ICON_NAMES` and regenerate (`--sheet` renders a visual check).
  Marks Lucide lacks (bow, dunes, volcano, alien, fox, owl, the touch verbs,
  pause, close) are hand-drawn in `ink-paths.ts`.
- **The engine still speaks emoji.** `stats.powerUps` carries the emoji strings
  the engine pushes; `POWER_UP_EMOJI` in `HUD.tsx` only translates them to drawn
  marks. Never render one.
- **Ink controls everywhere.** The base `ios-*` classes (buttons, cards, rows,
  sliders, switches) are re-themed on the palette, unscoped, in `globals.css`.
  Until then the selected segment of every settings control was still the iOS
  blue→purple gradient, and split screen's buttons with it. The
  `.dash-run-dialog` rules are the older, narrower copy of the same palette.
- **No blur on a moving backdrop.** Sheets, cards and overlays are opaque. The
  only backdrop blur left is the 5px scrim of the run dialogs, which open over a
  paused game; the achievements dialog (opened over the animated menu) opts out
  via `dash-still-dialog`.
- **Lime is the one achievement ink.** Stars, coins, "New High Score" and
  unlocked achievements are lime; gold survives only as the HUD's mid-urgency
  ramp and in the engine's own canvas popups.

Fixed in the same pass, all pre-existing and verified on the deployed build
first: the achievements modal was anchored to the scrolled menu content (so it
never appeared on phones, where its opener sits below the fold) and its scrim
painted beneath the menu; split screen in a landscape phone viewport stacked two
220px panes into ~340px of height (both outer Jump and move controls off-screen
— the panes now go side by side whenever the stack cannot fit); the Carry button
was offered in solo play, where the engine ignores the input; and the HUD's
right cluster slid under the pause button by 4–8px on phones.

Touch contract, updated: five solo actions press and release (jump, dash,
attack, melee, special); Carry renders only with `canCarry` (both co-op
surfaces). `scripts/test-neon-touch-browser.mjs` pins it live.

Verification note: `scripts/test-offline-service-worker.mjs` simulates a deploy
by editing `public/sw.js` on disk, so its deploy-purge check only runs against
a server that serves this checkout (its other ten checks run against any
`GAME_URL`).

## Remaining visual work
- ~~Deliberate sun/moon treatment; scenery could display both celestial bodies.~~ DONE 2026-09-05:
  `resolveCelestialAlphas(gameTime)` (pure, RNG-free) cross-fades the sun and moon —
  sunAlpha + moonAlpha ≤ 1 at every phase, so only one body ever owns the sky.
  Live-verified by frame capture: day/dusk shows the sun alone with its lime rim,
  night shows the moon alone with a violet halo (concept-board identity).
  13 solver tests in `test/celestial-cycle.test.ts` + `scripts/test-neon-sky-a11y.mjs`
  gate (wired into `npm test`).
- Broader native-shell theme parity and physical-device verification.
- 2026-11-24: landscape split screen and the touch cluster were verified in
  Chromium device emulation only (750×342 and 844×390). Not yet verified on a
  physical phone or in WebKit/iOS Safari.
- GLM 5.3 Flash independently reviewed the diff and re-ran the test suite and both browser probes: no regressions found. Parent also re-ran its independent expanded-panel and pause/resume probes successfully. Expanded settings are scrollable, not fully contained within the viewport (the worker report overstates this as "fully onscreen").
- FIXED 2026-09-05: all six disclosure cards (Saves+Shop, Settings, Run Lab, Same-Wi-Fi,
  Leaderboard, plus panel wiring) now carry aria-expanded/aria-controls pointing at real
  panel ids; enforced by the a11y contract gate in `npm test`. Same-Wi-Fi two-peer behavior was not tested this slice.
- Independent QA report: `/tmp/dashverse-glm-qa/report.md`; probes: `menu-edge.mjs` and `touch-edge.mjs` in the same directory.
- User approved committing and pushing the verified slice after independent QA. Local production preview was verified on port 3010.
