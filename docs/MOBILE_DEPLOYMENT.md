# Dashverse mobile deployment + device debugging

Dashverse keeps the existing Next.js/Vercel web app at the repository root and ships mobile from `apps/mobile`.

## Current app name

- Public game name: Dashverse
- Repository/folder name intentionally remains: `infinite-side-scroller`
- Mobile package IDs:
  - Android: `com.dashverse.app`
  - iOS: `com.dashverse.app`

## Web deployment

The web version remains the root Next.js app, so the existing Vercel deployment should keep working as-is.

Verification command from repo root:

```bash
npm run build
```

## Mobile architecture

`apps/mobile` is an Expo / React Native app.

The game canvas is bundled into:

```text
apps/mobile/assets/game.html
```

The bundler is:

```bash
node apps/mobile/scripts/bundle-game-html.js
```

It uses `esbuild` to bundle the TypeScript game engine correctly. Do not go back to regex-based TypeScript stripping.

## Local mobile development

From repo root:

```bash
cd apps/mobile
npm install
npm run bundle-game
npx expo start
```

Android device flow:

```bash
adb devices
cd apps/mobile
npm run android
```

If the device does not appear:

1. Enable Developer Options on Pixel 7.
2. Enable USB debugging.
3. Plug in USB cable.
4. Accept the RSA fingerprint prompt on the phone.
5. Run:

```bash
adb kill-server
adb start-server
adb devices
```

## Codemagic

Config file:

```text
codemagic.yaml
```

Workflows:

- `android-debug` — builds a debug APK for physical device testing on pushes to `main`.
- `android-release` — builds an Android App Bundle on `v*` tags.
- `ios-release` — builds an iOS IPA on `v*` tags.

Required Codemagic setup:

1. Add this repo as an app in Codemagic.
2. Enable YAML workflows.
3. For Android release signing, create environment group:

```text
android_keystore_credentials
```

with:

```text
CM_KEYSTORE_PATH
CM_KEYSTORE_PASSWORD
CM_KEY_ALIAS
CM_KEY_PASSWORD
```

4. For iOS release, configure Codemagic iOS code signing for bundle ID:

```text
com.dashverse.app
```

5. Trigger `android-debug` first. That is the fastest path to a Pixel 7 APK.

## Watch apps later

Do not start Apple Watch / Pixel Watch first. The practical order is:

1. Stabilize Android phone build.
2. Stabilize iOS phone build.
3. Extract a tiny shared game telemetry / companion layer.
4. Build watch companion apps around glanceable status, quick actions, and maybe mini-challenges.

The current full canvas game is not appropriate for watch screens without a separate UX.
