# Dashverse / Infinite Side Scroller Five-Phase Iteration Plan

Generated: 2026-06-30
Owner: Hermes Agent
Repository: https://github.com/jiracipika/infinite-side-scroller

## North-star outcome
Dashverse should be a stable cross-platform arcade game: fast canvas gameplay, honest multiplayer behavior, reliable local progression, shippable mobile wrapper, and repeatable verification that catches broken engine/content wiring before deployment.

## Guardrails
- Finish, verify, commit, and push one phase before starting the next phase.
- Keep web and mobile in the same repo; do not fork into a standalone replacement.
- Do not hide broken code behind Next build suppression. Typecheck and lint must run explicitly and production build should not skip them.
- Canvas/gameplay changes must preserve responsiveness; networking changes must keep HTTP fallback when P2P fails.

## Phase 1 — Build-contract hardening
Scope:
- Record the five-phase iteration plan in-repo.
- Remove Next.js production build suppression now that explicit typecheck/lint pass.
- Keep README verification commands aligned with the stricter contract.

Verification:
- npm run typecheck
- npm run lint
- npm run build

## Phase 2 — Game content integrity verifier
Scope:
- Add a zero-dependency Node verifier for level and character data.
- Catch duplicate IDs, invalid thresholds, invalid density ranges, missing base characters, and invalid unlock costs.
- Wire it into package scripts so future phases can run it before builds.

Verification:
- npm run verify:game
- npm run typecheck
- npm run lint
- npm run build

## Phase 3 — Multiplayer tuning manifest
Scope:
- Add a script that extracts multiplayer timing constants and fails on unsafe latency envelopes.
- Document expected HTTP vs P2P cadence and interpolation windows.
- Make future latency tuning reviewable without manual source spelunking.

Verification:
- npm run verify:multiplayer
- npm run typecheck
- npm run lint
- npm run build

## Phase 4 — Player-facing diagnostics
Scope:
- Add a compact diagnostics checklist to the start/menu flow so testers know how to prove local, split-screen, and same-Wi-Fi modes.
- Keep the menu readable and avoid hiding critical join/host advice.

Verification:
- npm run typecheck
- npm run lint
- npm run build

## Phase 5 — Release verification bundle
Scope:
- Add one top-level verification command that runs all static game checks plus framework checks.
- Update README with release and production smoke-test procedure.
- Leave the repo with repeatable evidence for future pushes.

Verification:
- npm run verify
- npm run build
