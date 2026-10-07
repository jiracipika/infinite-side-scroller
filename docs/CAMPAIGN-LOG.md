
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

**Run-variety slice (same day, evening):** picked up the "terrain variety"
candidate the bounded way — runs now PLAY differently per biome with zero
geometry changes (classification: **Better**). New pure module
src/game/spawn-patterns.ts authors 8 per-biome spawn profiles resolved from
the existing biome identities (level biome ids + endless registry names):
pattern archetypes (scatter / CLUSTER / RHYTHM string / WIDE-SINGLE spike
bands), per-biome spike width windows (desert wide-but-rare, sky narrow
hop-rhythm), spike-chunk cadence, and enemy density multipliers. Fairness
pinned per profile × seed in test/spawn-patterns.test.ts: inter-group gap
≥150px reaction floor, band span ≤120px, widths within [24,48], chunk-0
safe zone intact, legacy no-profile spawner byte-identical. 777 tests
(+17); verify + build + release:evidence green; game.html regenerated —
APK rebuild is the operator's cycle. Commit: see git log "per-biome
run-variety".

## Day 4 — 2026-10-06

**Morning round (pre-window):** SFX gap-fill 9e521fd — redeemSuccess/
redeemReject synths wired at the React boundary (the CHERRYBOMB field was
silent), shared playUiClick/playUiClickOnAdjustKey helpers, all gating
engine-side, sliders click on pointerUp/keyup (no drag spam); 944 tests;
survey correction: UI clicks already existed via getSfxEngine().play —
a narrow `sfx\.play` grep misses them. Farm APK 83MB rebuilt @ 9e521fd
(coin doubler + crimson court + court baddies + chiptune engine),
emulator boot + mid-run evidence in /Volumes/ADATA/mobile-setup/evidence/
dashverse-2026-10-06-*.png.

**Afternoon double + chime (3 commits, 946 tests, verify/build/
release:evidence EXIT:0 on the combined tree):** 069788d SFX finish —
every secondary surface answers (roster chips, shop, multiplayer Host/
Join, save-slot grid, board scope tabs, ghost Race, Run Lab, achievements,
LevelCompleteScreen, SplitScreenMode, ControlsHint); bank-pill 5-tap
secret asserted silent. aab0e8a PWA OFFLINE (the day's NEW bet): hand-
written sw.js, NETWORK-FIRST for the HTML doc + /_next/static chunks,
deny-by-default allowlist (api/cross-origin pass through), one-visit
install precache (load-bearing: first-visit requests fire before SW
control), versioned cache + activate purge + skipWaiting/claim, styled
"SIGNAL LOST" offline page; LIVE invalidation proof (real v2-bump deploy
in test: caches=v2 only, fresh network hits; 3 runtime bugs caught pre-
ship); production verified (sw.js max-age=0 must-revalidate, offline.html
200). a8d136e purchase chime (SfxName #15): square E6 strike → triangle
B5 ring — a descending fourth specifically so it can't duplicate the coin
pitches; wired on buy-success only (failures stay click).

**Durable gotcha:** the WEB game bundle is the /_next/static chunk set —
apps/mobile/assets/game.html is the RN WebView asset and is NOT served by
the web origin (pinned by contract in verify-offline-sw.mjs). Purchase
chime changed game.html (+214 bytes) → fresh farm APK rebuild running at
EOD.

**P/B/N classifications:** SFX finish Better-completion; PWA offline NEW
(one isolated bet, strict invalidation bar — network-first makes stale-
serves structurally impossible online); purchase chime Better-completion
(Proven arcade convention).

**Overnight (parallel session, certified):** chiptune 4a8b37d, AdSense
759fca0, crimson court 609a8c4 + court baddies 14fe000 + roster uplift
f238a64 + coin doubler 6d1006c + secret code 2a7867a.

**Next steps:** human playtest for feel passes; candidates noted: dedicated
haptics audit for new surfaces, service-worker cache-size ceiling tuning
(80-asset cap), multiplayer/leaderboard auth if ever needed.

## Day 5 — 2026-10-07 (FINAL campaign day)

**Lanes:** 39dee4b service-worker precache-cap falsification (honest
no-op on the number): the install handler's `.slice(0, 80)` is INERT —
a production document references exactly 12 unique /_next/static assets
(whole build ships 24), so no truncation is possible today; the cap is
now pinned so it gets revisited when the app grows
(verify-offline-sw.mjs section 2c: cap must exist and never shrink
below the 24-asset whole-build floor; test-offline-service-worker.mjs
live probe fails the first visit where refs ≥ cap and reports
refs-vs-cap). BONUS REAL BUG fixed: the offline-SW suite's source pins
were DEAD CODE — process.exit(0) on the no-GAME_URL path killed the
module before node:test executed the queue, so the pre-existing pins
never ran in npm test (proven by a planted failing canary exiting 0);
restructured into an else block, all 5 pins now genuinely execute and a
failing pin fails the run. Parallel session shipped 37a0034
(consequences-buzz haptics: success/error/milestone patterns for buys,
redemptions, unlocks, level completes, delayed record milestone) — our
haptics-audit lane became an honest no-op audit confirming the shipped
work meets the bar (run-start, bank-pill secret, save-slot ops,
leaderboard toggle correctly silent).

**Verification:** npm run verify + build + release:evidence all EXIT 0
(875 tests); live deploy verified — production sw.js byte-matches local,
live probe PASS (12 refs vs cap 80). Finding: the production URL was
recorded nowhere in the repo (found via the vercel.app convention).

**Mobile:** dashverse-2026-10-07.apk (83 MB) rebuilt from 37a0034,
release-signed, AVD boot + mid-run evidence in
/Volumes/ADATA/mobile-setup/evidence/dashverse-2026-10-07-*.png.
Honest finding: the embedded game.html is byte-identical to the Oct 6
APK — the haptics call sites are web-layer only (src/game/input/
haptics.ts is imported by nothing inside src/game), so the WebView
payload did not change. Pitch-therapy gates: typecheck:mobile +
bundle:android:smoke both EXIT 0.

**P/B/N classifications:** SW-cap falsification Better (infra
robustness, decided by measurement); haptics audit no-op (sibling's
commit was already the Better). No New bets today — day-4's PWA offline
bet stands validated in production.

**Next steps:** human playtest for feel; SW cap auto-revisit is pinned;
mobile payload parity check (web-layer haptics invisible in the WebView
shell) is a candidate for a future mobile-native slice if the user
wants haptics in the app build.
