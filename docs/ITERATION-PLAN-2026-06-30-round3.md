# Dashverse Five-Phase Iteration Plan — Round 3

Generated: 2026-06-30 (round 3)
Status: Active

## Baseline
- Round 1 hardened the build contract and added game/multiplayer verification.
- Round 2 expanded verification across progression, achievements, saves, HUD, and mobile bundle sanity.
- Current `npm run verify` includes seven static verifiers plus typecheck and lint.

## Phase 1 — Web manifest and installability guard
Scope:
- Add a verifier for public/App Router manifest fields and required PWA metadata.
- Keep installability regressions from hiding behind a successful Next build.

## Phase 2 — Engine API surface guard
Scope:
- Add a verifier that scans React call sites and confirms required GameEngine methods exist.
- Target the historical class of bugs where UI calls missing engine methods.

## Phase 3 — Multiplayer API contract guard
Scope:
- Add a verifier for multiplayer API route existence and recovery/durable-state markers.
- Guard same-Wi-Fi host/join/sync flows at source level.

## Phase 4 — Touch controls and in-game action guard
Scope:
- Add a verifier for mobile/touch control markers and essential in-game controls.
- Guard against accidental removal of pause, jump/action buttons, or mobile control affordances.

## Phase 5 — Release evidence command
Scope:
- Add a release evidence script that prints one concise summary of all Dashverse verification gates.
- Wire it as a non-mutating command usable before mobile/web release handoff.

## Done definition
Each phase: code/script/docs changed, `npm run verify && npm run build` passes, commit pushed to `origin/main`.
