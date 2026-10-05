
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

## 2026-10-05 — CampaignGoal day 3

**Commits:** 9bb7132 (visible how-to-unlock copy on locked level cards),
b837897 (patch-android.sh Fix 4 — auto-restores release signing halves
after clean prebuild; end-to-end tested), 5d9cd8d (authored biome preview
stripes + ControlsHint on level select), 66d8523 (overflow-at-390 +
keyboard focus-order QA pins), cff47b6 (GLM-NEXT-SLICE marked COMPLETE).

**What improved:** GLM-NEXT-SLICE is fully consumed — locked cards now say
HOW to unlock (matches the 5d9cd8d biome identity work), level select has
authored per-biome stripe gradients instead of generic placeholders, and
the rendered-QA bar (Playwright, 8 contracts) is part of the evidence
ladder. 768 tests green; verify + build + release:evidence all pass.

**Mobile:** game.html proved byte-identical across the UI slices (engine
is UI-independent), so the 2026-10-05 farm-signed APK (79MB) already
contains today's menu work. Boot + gameplay screencaps refreshed at
/Volumes/ADATA/mobile-setup/evidence/.

**Build farm:** BUILD-MATRIX.md now documents the secrets.csv no-header
rule (never head/cat; grep '^<app>-release.jks|') and Dashverse's signing
auto-restore.

**Next steps:** roadmap exhausted — new work needs a fresh brief (terrain
variety, SFX pass, and daily-run leaderboards are the visible candidates).
