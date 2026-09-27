
## 2026-09-27 — CampaignGoal day 1 (11:00–21:00 ET)

**Commit:** 354366e (know-before-you-go difficulty + results hierarchy).

**Tests:** 677 unit tests green (5 new difficulty-solver tests), 6 new
level-select display contracts, 5 new results-hierarchy contracts, full
verify + build green.

**What improved (UI + game design):**
- Level-select cards now explain difficulty BEFORE launch: pure
  rateLevelDifficulty() solver (enemy/hazard density, variety, boss ->
  CALM/STEADY/WILD) rendered as a 3-dot meter + label with aria text.
- Results screen has ONE dominant primary action (Next when advancing,
  else Retry) instead of three equal buttons; pinned by
  data-primary-action for tests.
- verify:codemagic was still asserting the push-trigger config removed by
  2579775 (minutes policy) — now pins the manual-only contract instead,
  unblocking the whole verify ladder.

**Known issues:** apps/mobile/assets/game.html regenerated mid-day by the
mobile-infrastructure lane (committed incidentally with this slice —
idempotent artifact).

**Next steps:** mobile APK + AVD evidence (agent lane), locked-level
"how to unlock" affordance audit, biome preview art per GLM-NEXT-SLICE.
