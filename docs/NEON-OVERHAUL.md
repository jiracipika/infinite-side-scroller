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

### Remaining visual work
- Deliberate sun/moon and cloud treatment; current scenery can display both celestial bodies.
- Broader native-shell theme parity and physical-device verification.
- GLM 5.3 Flash independently reviewed the diff and re-ran the test suite and both browser probes: no regressions found. Parent also re-ran its independent expanded-panel and pause/resume probes successfully. Expanded settings are scrollable, not fully contained within the viewport (the worker report overstates this as "fully onscreen").
- GLM noted a preexisting accessibility gap: the Saves + Shop disclosure lacks aria-expanded/aria-controls. Same-Wi-Fi two-peer behavior was not tested this slice.
- Independent QA report: `/tmp/dashverse-glm-qa/report.md`; probes: `menu-edge.mjs` and `touch-edge.mjs` in the same directory.
- User approved committing and pushing the verified slice after independent QA. Local production preview was verified on port 3010.
