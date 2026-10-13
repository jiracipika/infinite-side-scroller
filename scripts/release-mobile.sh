#!/usr/bin/env bash
# Dashverse mobile release — one command from repo root or anywhere:
#   bash scripts/release-mobile.sh [versionCode]
# Bumps the version (default: current + 1), bundles the game engine, patches
# the native project, builds the farm-signed release AAB, and drops it in the
# build-farm uploads dir with a versioned name. Never prints keystore secrets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/apps/mobile"
UPLOADS="/Volumes/ADATA/mobile-setup/build-farm/dashverse-store-uploads"

# Android toolchain on ADATA (JDK 21 + SDK) — never the system JDK 25.
source /Volumes/ADATA/Android/env.sh

current="$(python3 - "$MOBILE/app.json" <<'EOF'
import json, sys
print(json.load(open(sys.argv[1]))["expo"]["android"]["versionCode"])
EOF
)"
target="${1:-$((current + 1))}"
if [ "$target" -le "$current" ]; then
  echo "error: target versionCode $target must be greater than current $current (Play rejects reused codes)"
  exit 1
fi
echo "versionCode: $current -> $target"

python3 - "$MOBILE/app.json" "$target" <<'EOF'
import json, sys, re
path, code = sys.argv[1], sys.argv[2]
data = json.load(open(path))
data["expo"]["android"]["versionCode"] = int(code)
data["expo"]["ios"]["buildNumber"] = str(code)
open(path, "w").write(json.dumps(data, indent=2) + "\n")
gradle = path.replace("app.json", "android/app/build.gradle")
s = open(gradle).read()
s = re.sub(r"versionCode \d+", f"versionCode {code}", s, count=1)
open(gradle, "w").write(s)
print("app.json + android/app/build.gradle bumped")
EOF

echo "== bundling game engine =="
node "$ROOT/apps/mobile/scripts/bundle-game-html.js"

echo "== patching native project (copies game.html + crash fixes) =="
bash "$MOBILE/scripts/patch-android.sh"

# The WebView asset MUST match what was just bundled — gradle bundles the
# android copy, not apps/mobile/assets.
if ! cmp -s "$MOBILE/assets/game.html" "$MOBILE/android/app/src/main/assets/game.html"; then
  echo "error: game.html out of sync between assets/ and android assets — patch-android.sh failed"
  exit 1
fi
echo "game.html synced OK"

echo "== building signed AAB (several minutes) =="
(cd "$MOBILE/android" && ./gradlew bundleRelease)

aab="$MOBILE/android/app/build/outputs/bundle/release/app-release.aab"
[ -f "$aab" ] || { echo "error: AAB missing at $aab"; exit 1; }
mkdir -p "$UPLOADS"
out="$UPLOADS/dashverse-${target}-$(date +%Y-%m-%d).aab"
cp "$aab" "$out"
echo ""
echo "AAB ready: $out"
echo ""
echo "Next — one-time per version:"
echo "  Play Console → Testing → Internal/Closed testing → upload the AAB above"
echo "  (or trigger the Codemagic 'release-both' workflow once env groups are attached)"
