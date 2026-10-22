# GPT-concept roster redesign (third edition) — plan

Created 2026-10-22. Status: **waiting on reference art** — the user is pulling the
named ChatGPT chats ("Knight concept sheet", "cyborg design sheet") that hold the
preferred round-1 character sheets. Implementation starts only after those land.

## Goal

Redraw all 17 playable Ink characters to match the ChatGPT **round-1** concept
sheets — chunky chibi pixel-style game-sprite sheets (front/side/back + 3
expressions), NOT the round-2 "cuter" ornate profile style. The user explicitly
prefers round 1.

**Hard constraints (same as the second edition, see docs/art/roster-redesign.md):**
character IDs, abilities, unlock costs, health, collision dimensions, world art
and gameplay rules are unchanged. Art stays procedural (canvas code in
`src/game/rendering/`), never loaded sprite sheets, for the default Ink look.

## Reference inventory

`/Volumes/ADATA/projects/dashverse-art/gpt-concepts/` (outside the repo):

| File | Round | Note |
|---|---|---|
| knight-concept.png | 1 (~Oct 14 01:00) | **pending user confirmation** — user said "not the one" about an early find; verify before trusting |
| mage/ninja/ranger/tank-concept.png | — | byte-identical copies of the knight sheet (md5 7e26d9c2…) |
| cyborg-, healer-, spirit-, velvet-, ansley-concept.png | 2 (~Oct 14 16:00) | "cuter" ornate profiles — useful as per-character identity sources (palette, props, personality), wrong framing |

Missing round-1 sheets for the rest of the roster should come from the user's
ChatGPT chats. Land them in `gpt-concepts/round1/<character>-concept.png`.

Roster source of truth: `src/game/data/characters.ts` (`CHARACTERS`, 17 ids:
knight, ninja, tank, mage, ranger, cyborg, spirit, healer, ansley/cherry†,
velvet, ember, rosalia, marionette, dorian, onyx, mortimer, grimshaw).
†data says `cherry`, redesign sheet says `Ansley` — reconcile from
characters.ts, never from the sheets.

## Current architecture (what gets edited)

- `src/game/rendering/character-art.ts` — `drawCharacterArt` shared dispatch
  (menus, gameplay, remote players, court enemies).
- `src/game/rendering/ink-redesign.ts` — owns the current (2nd edition) art.
  The 3rd edition should follow the same pattern (new module, e.g.
  `ink-gpt-edition.ts`, or in-place evolution — decide when the references land).
- Supporting: `ink-roster.ts`, `ink-ninja.ts`, `ink-cherry.ts`, `ink-crimson.ts`,
  `ink-kit.ts`, `character-motion.ts` (gait — do not break).
- Per-character identity direction from the 2nd edition table in
  docs/art/roster-redesign.md carries over (costume plates, props, faces) —
  restyled toward the round-1 chunky-pixel look, not redrawn from scratch
  semantically.

## Stages

1. **References locked** — user drops round-1 sheets; reconcile 17 ids ↔ sheets;
   copy into the repo under `design/gpt-concepts/` (committed) so the work is
   self-contained.
2. **Pilot: Knight** — implement, regenerate `npm run art:preview`, visually
   compare against the round-1 knight sheet, get user sign-off BEFORE rolling out.
3. **Roster rollout** — remaining 16 in roster order, batch previews every ~4
   characters.
4. **Verification chain** (all must pass):
   `npm run verify` (or at minimum verify:game, verify:mobile, typecheck, lint),
   `npm run test:character-browser`, `node apps/mobile/scripts/bundle-game-html.js`,
   `npm run test:character-mobile`.
5. **Ship**: commit + push `main` (website deploys via Vercel), then rebuild the
   mobile app bundle (the WebView game.html ships in the next codemagic
   `android-testing` build; no store upload without explicit user go-ahead).

## Open questions for the user (blocking stage 1)

1. Confirm/replace knight-concept.png as the round-1 anchor ("not the one"?).
2. Do round-1 sheets exist for all 17, or only a subset? For missing ones: is
   round-2 sheet + 2nd-edition identity enough, or generate new prompts?
3. Pixel-look rendering: stylized chunky-pixel PROCEDURAL drawing (crisp
   integer-stepped shapes, limited palette per character) — confirm that's the
   intent vs literally snapping the renderer to a pixel grid.

## Progress 2026-10-22 (late)

- User shared the "Design Cyborg Sheet" ChatGPT conversation
  (chatgpt.com/share/6ad9a454-cacc-83ea-95ac-ede044f24e86). The images are
  auth-gated for logged-out automation (401 from backend-anon even in-browser),
  but the full prompt text was extracted from the page payload into
  `/Volumes/ADATA/projects/dashverse-art/gpt-concepts/round1-cyborg-sheet/design-brief.txt`:
  the exact round-1 style recipe (chibi, chunky pixels, dark outline, bg
  #191725 family, violet rim #9570ff, lime accent #c7ff4d, front+side+back+3
  expressions) plus per-character specs for 12 characters: ANSLEY, CYBORG,
  DORIAN, EMBER, GRIMSHAW, HEALER, MARIONETTE, MORTIMER, ONYX, ROSALIA,
  SPIRIT, VELVET (12 sediment image files exist in the chat, ~1448×1086 each).
- To obtain the actual raster sheets, the user can open the share link in
  their logged-in Safari and save the 12 images into
  `gpt-concepts/round1-cyborg-sheet/` named by character. The other named chat
  ("Knight concept sheet") presumably covers KNIGHT/NINJA/TANK/MAGE/RANGER.
- Knight pilot launched as idle-time task `offpeak-960db51e` (background):
  procedural chunky-pixel knight in a new module, opt-in wiring, all-pose
  verification, no commit — pilot needs user sign-off before roster rollout.
