# Dashverse — Mobile Beta Runbook (Play Store + App Store)

Status as of 2026-10-07: the app is **build-ready and sign-ready** for both
stores. Every step that does not require a paid store account is already done
or is a single command below. The remaining gates are account-level and
human-only (listed at the bottom).

## What is already in place

| Piece | State |
|---|---|
| Android applicationId / iOS bundle ID | `com.dashverse.app` (never change — store identity) |
| Android versionCode / iOS buildNumber | pinned in `apps/mobile/app.json` (`android.versionCode: 1`, `ios.buildNumber: "1"`) |
| Release signing (Android) | upload keystore `dashverse-release.jks`, wired via `android/keystore.properties` → `app/build.gradle` (farm-managed, gitignored) |
| `eas.json` | production AAB profile (`buildType: app-bundle`), internal APK `preview` profile, iOS production with `autoIncrement` |
| Store listing art | `apps/mobile/store-assets/` — play icon 512², feature graphic 1024×500, 6 phone screenshots 1080×2400 (captured from the real app on the campaign_test emulator) |
| App icon / splash | regenerated 2026-10-07 from the in-app brand mark (lime `#c7ff4d` ∞ on `#0b0813`): `assets/icon.png`, `android-icon-{foreground,background,monochrome}.png`, `splash-icon.png` — the previous set was Expo template placeholder art |
| Cloud CI lane | `codemagic.yaml` (debug APK on main; release AAB/IPA on `v*` tags) — needs a Codemagic account before it runs |

## Versioning discipline (both stores)

- **Android**: bump `android.versionCode` in `apps/mobile/app.json` by 1 for
  every build you intend to upload. Play rejects reused/lower codes.
- **iOS**: bump `ios.buildNumber` (string) per upload; marketing `version`
  (1.0.0) changes only for user-visible releases.
- After editing `app.json`, re-run `npx expo prebuild` for the native
  projects to pick it up (see prebuild caveat below).

## Android beta (Play internal testing)

### Build the AAB (this Mac — the farm flow)

```bash
source /Volumes/ADATA/Android/env.sh        # JDK 21 + SDK on ADATA. NEVER the system JDK 25.
node apps/mobile/scripts/bundle-game-html.js
bash apps/mobile/scripts/patch-android.sh   # copies game.html into android assets + re-wires signing
cd apps/mobile/android
./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab (signed with the upload keystore)
```

Gotchas that have already bitten:

- **Stale game.html**: `bundle-game-html.js` writes `apps/mobile/assets/game.html`;
  gradle bundles `android/app/src/main/assets/game.html`. The copy is step 2
  (`patch-android.sh`), not magic — if gameplay content changed and you skip
  it, the bundle ships the OLD game. Verify with `cmp` before building.
- **JDK**: Gradle 9.0.0 + RN 0.83 fails on the system JDK 25 with
  `JvmVendorSpec IBM_SEMERU` errors. Always `source /Volumes/ADATA/Android/env.sh`.
- **pipestatus**: `./gradlew ... | tail` hides the exit code — check
  `${pipestatus[1]}` or run without the pipe.

### Upload to Play internal testing (user-gated: $25 Play Console account)

1. [Play Console](https://play.google.com/console) → **Create app** (name:
   *Dashverse*, default language, *Game → Arcade*, free, no ads).
2. Fill the minimum listing: use `apps/mobile/store-assets/` (512² icon,
   1024×500 feature graphic, 4 phone screenshots) + the listing copy below.
3. **Testing → Internal testing** → create track → upload `app-release.aab`.
4. Add testers by email list → save → copy the **opt-in link** and share it.
5. Review the pre-launch report after the first upload; device-coverage
   warnings are advisory for a beta.

Screenshot set (`apps/mobile/store-assets/`, all 1080×2400 from the real app):
`shot-1-menu`, `shot-2-gameplay`, `shot-3-run-start`, `shot-4-pause`,
`shot-5-stats`, `shot-6-settings`. Play requires at least 2; upload all 6
plus `feature-graphic-1024x500.png` and `play-icon-512.png`.

Internal testing rolls out to testers within minutes and needs no Google
review. Closed testing (larger lists, still no review friction) is the next
rung; production review only happens when you promote.

## iOS beta (TestFlight)

**Recommended lane: EAS cloud builds.** This Mac has no Xcode 26 (Expo SDK 55
needs Xcode 26 + macOS 15.6+; host is 16.4 / 15.3.2), but EAS builds iOS in
Expo's cloud, so no local Xcode is needed.

### One-time setup (user-gated accounts)

1. **Apple Developer Program** ($99/yr) — required for TestFlight.
2. **Expo account** → `npm i -g eas-cli && eas login` → `cd apps/mobile && eas init`
   (writes the project id into `app.json → extra.eas.projectId`, currently null).

### Build + submit

```bash
cd apps/mobile
eas build -p ios --profile production        # cloud IPA, auto-increments buildNumber
eas submit -p ios --latest \
  --asc-app-id <AppStoreConnectAppID>        # or configure App Store Connect API key when prompted
```

EAS manages iOS certificates/provisioning automatically on first build
(accept the prompts to register the `com.dashverse.app` bundle ID).

### TestFlight (user-gated)

1. In [App Store Connect](https://appstoreconnect.apple.com) create the
   *Dashverse* app (SKU `dashverse`, bundle ID `com.dashverse.app`).
2. After `eas submit`, the build processes in TestFlight (10–30 min).
3. **Internal testers** (up to 100, instant) — add your team.
4. **External testing** (up to 10k) — create a group, add testers, submit the
   brief **Beta App Review** (usually <1 day for a beta with no IAP/ads).
5. Testers install TestFlight from the App Store and accept the invite.

### Alternative lanes (both viable, neither wired to accounts yet)

- **Codemagic** (`codemagic.yaml` already defines `ios-release` on `v*` tags):
  needs a Codemagic account + iOS signing config for `com.dashverse.app`.
- **Local Xcode**: after the user upgrades to macOS 15.6+ / Xcode 26, the
  standard `ios/Dashverse.xcworkspace` archive flow works (Pods are installed).

## Store listing copy (draft)

- **Name**: Dashverse
- **Short description** (Play, ≤80 chars): `Endless side-scroll dash — bank coins, keep the flow, beat your best.`
- **Keywords** (iOS): `endless runner,arcade,dash,side scroller,retro`
- **Category**: Games → Arcade
- **Full description**:

> Dashverse is an endless side-scrolling dash adventure. One-thumb control:
> move, jump and dash as the world speeds up.
>
> - Endless runs with autosaving checkpoints — continue where you died
> - Coin bank + shop with 11 permanent upgrades
> - Character roster to unlock and run with
> - Personal-best tracking with per-run stats (distance, coins, combos)
> - Runs work offline — progress saves on device
> - Tune audio, particles and touch-control size in Settings
>
> Beta notes: online leaderboards, nearby multiplayer and split-screen are
> on the roadmap — the mobile beta focuses on the run loop. Progress lives
> on your device.

## Human-only gates (nothing left for the builder to do)

1. Google Play Console account ($25 one-time) → AAB from this farm uploads as-is.
2. Apple Developer Program ($99/yr) → then the EAS lane above ships TestFlight
   without needing a local Xcode upgrade.
3. macOS 15.6+ / Xcode 26 upgrade — only needed for the local-IPAC lane, not for EAS.

## Release APK/AAB artifact locations

- AAB: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`
- APK (side-load/internal): `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Keystore + credentials: `/Volumes/ADATA/mobile-setup/build-farm/` (see its
  `BUILD-MATRIX.md`; passwords in `secrets.csv`, never committed, never logged).
