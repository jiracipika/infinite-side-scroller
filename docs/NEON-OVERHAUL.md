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
Workers launched with 20-minute run budgets. This document is a coordination brief, not a completion report. Overhaul is not shipped yet.
