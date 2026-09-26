#!/bin/bash
# Post-prebuild patches for Android crash fix
# Applied after `npx expo prebuild` regenerates the android directory

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$DIR/../android"

if [ ! -d "$ANDROID_DIR" ]; then
  echo "Error: android directory not found at $ANDROID_DIR"
  exit 1
fi

# Fix 1: Disable edge-to-edge (causes crashes on some Android versions with RN 0.83)
PROPS="$ANDROID_DIR/gradle.properties"
if [ -f "$PROPS" ]; then
  sed -i.bak 's/edgeToEdgeEnabled=true/edgeToEdgeEnabled=false/' "$PROPS" && rm -f "$PROPS.bak"
  echo "Patched gradle.properties: edgeToEdgeEnabled=false"
fi

# Fix 2: Strengthen ProGuard rules to prevent R8 stripping native modules
PG="$ANDROID_DIR/app/proguard-rules.pro"
if [ -f "$PG" ]; then
  cat >> "$PG" << 'PROGUARD'

# ── Dashverse crash fix: keep all native module classes ──
-keep class com.facebook.react.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.fabric.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.reactnativecommunity.webview.** { *; }
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-keep class com.reactnativecommunity.slider.** { *; }
-keep class expo.modules.** { *; }
-keep class com.facebook.hermes.** { *; }
-keepclassmembers class * { @com.facebook.react.bridge.ReactProp <methods>; }
-keepclassmembers class * { @com.facebook.react.bridge.ReactMethod <methods>; }
-dontwarn javax.annotation.**
-dontwarn org.jetbrains.annotations.**
PROGUARD
  echo "Patched proguard-rules.pro with comprehensive keep rules"
fi

# Fix 3: Put the game engine HTML where the Android WebView can load it.
# Metro html assets don't resolve in release builds: the flattened asset is
# handed to the WebView as a stub 'http://assets_game/' URL, which trips
# ERR_CLEARTEXT_NOT_PERMITTED and the game engine never starts. Copying it
# into app/src/main/assets lets index.tsx load it as
# file:///android_asset/game.html (iOS keeps the require() source).
SRC_HTML="$DIR/../assets/game.html"
ASSETS_DIR="$ANDROID_DIR/app/src/main/assets"
if [ -f "$SRC_HTML" ]; then
  mkdir -p "$ASSETS_DIR"
  cp "$SRC_HTML" "$ASSETS_DIR/game.html"
  echo "Copied game.html into android app assets for WebView file:// loading"
else
  echo "Warning: $SRC_HTML not found — run bundle-game-html.js first" >&2
  exit 1
fi

echo "Post-prebuild patches applied successfully."
