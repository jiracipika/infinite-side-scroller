# Dashverse Five-Phase Iteration Plan — Round 2

Generated: 2026-06-30 (round 2)
Status: Active

## Baseline
- npm run verify clean (game content + multiplayer tuning + typecheck + lint)
- npm run build clean
- Round 1 completed: iteration plan, build-contract hardening, game content verifier, multiplayer verifier, tester checklist UI, release verification command

## Phase 1 — Progression data integrity verifier
Scope:
- Extend verify:game to validate shop upgrade costs, slot defaults, and character unlock costs.
- Catch duplicate upgrade IDs, negative costs, and invalid bonus fields.

## Phase 2 — Achievement condition verifier
Scope:
- Add a script that validates achievement definitions: unique IDs, non-empty titles, and that condition functions do not throw on default stats.

## Phase 3 — Save slot resilience tests
Scope:
- Add a Node test that loads malformed localStorage payloads through the normalize path and confirms safe fallbacks.

## Phase 4 — HUD invariant tests
Scope:
- Add a Node test that verifies heart count clamping, coin display, and combo flash logic against edge-case GameStats values.

## Phase 5 — Mobile bundle sanity check
Scope:
- Add a script that verifies the mobile app entry exists, has required fields, and the game HTML bundle is present.

## Done definition
Each phase: code committed, verify/typecheck/lint/build pass, pushed to main.
