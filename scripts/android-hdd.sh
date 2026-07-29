#!/usr/bin/env bash
# Android development helper. SDKs, AVDs, Gradle, npm, Expo, and temp caches
# stay on /Volumes/HARD; this script never writes mobile build data to the SSD.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="/Volumes/HARD/dev-cache/env.sh"
APK="$ROOT/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing HDD mobile environment: $ENV_FILE" >&2
  exit 1
fi
source "$ENV_FILE"

usage() {
  cat <<'EOF'
Usage:
  scripts/android-hdd.sh status
  scripts/android-hdd.sh pair <PHONE_IP:PAIRING_PORT>
  scripts/android-hdd.sh connect <PHONE_IP:DEBUG_PORT>
  scripts/android-hdd.sh reverse [DEVICE_SERIAL]
  scripts/android-hdd.sh build
  scripts/android-hdd.sh install [DEVICE_SERIAL]
  scripts/android-hdd.sh metro

Wireless setup on the phone:
  1. Enable Developer options and Wireless debugging.
  2. Tap "Pair device with pairing code".
  3. Run `pair` with the shown IP:port. adb will safely prompt you for the
     pairing code; do not paste that code into chat.
  4. Run `connect` with the separate "IP address & Port" shown by Wireless
     debugging. The pairing port and debug port are usually different.
  5. Run `reverse` so the USB-free debug APK can reach Metro at localhost:8081.
EOF
}

require_arg() {
  if [[ $# -ne 1 || -z "$1" ]]; then
    usage >&2
    exit 2
  fi
}

case "${1:-}" in
  status)
    printf 'Android SDK: %s\n' "$ANDROID_SDK_ROOT"
    printf 'Android AVD home: %s\n' "$ANDROID_AVD_HOME"
    printf 'Gradle home: %s\n' "$GRADLE_USER_HOME"
    adb devices -l
    ;;
  pair)
    require_arg "${2:-}"
    adb pair "$2"
    ;;
  connect)
    require_arg "${2:-}"
    adb connect "$2"
    adb devices -l
    ;;
  reverse)
    serial="${2:-}"
    if [[ -n "$serial" ]]; then
      adb -s "$serial" reverse tcp:8081 tcp:8081
    else
      adb reverse tcp:8081 tcp:8081
    fi
    ;;
  build)
    (cd "$ROOT/apps/mobile" && npm run bundle-game)
    (cd "$ROOT/apps/mobile" && npx expo prebuild --platform android --no-install)
    (cd "$ROOT/apps/mobile/android" && ./gradlew assembleDebug --no-daemon)
    printf 'APK ready: %s\n' "$APK"
    ;;
  install)
    serial="${2:-}"
    if [[ ! -f "$APK" ]]; then
      echo "APK missing. Run: scripts/android-hdd.sh build" >&2
      exit 1
    fi
    if [[ -n "$serial" ]]; then
      adb -s "$serial" install -r "$APK"
    else
      adb install -r "$APK"
    fi
    ;;
  metro)
    cd "$ROOT/apps/mobile"
    exec npx expo start --dev-client --lan
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
