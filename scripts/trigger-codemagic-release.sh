#!/bin/bash
# Trigger a Codemagic workflow for Dashverse and poll until it finishes.
#
# Usage:
#   CM_API_TOKEN=xxxx scripts/trigger-codemagic-release.sh
#   scripts/trigger-codemagic-release.sh <token>
#
# WORKFLOW defaults to android-testing (signed AAB → Play internal track).
# Override with: WORKFLOW=android-debug BRANCH=main CM_API_TOKEN=... $0
#
# Everything the build needs (keystore "dashverse", Play service account in
# the google_play group) is stored in Codemagic — this only needs a personal
# API token (Codemagic → Settings → Integrations → Personal API tokens).
# The same token used for repfinder's trigger works: tokens are account-wide.

set -euo pipefail

TOKEN="${1:-${CM_API_TOKEN:-}}"
if [ -z "$TOKEN" ]; then
  echo "ERROR: pass a Codemagic API token: CM_API_TOKEN=... $0" >&2
  exit 1
fi

API="https://api.codemagic.io"
BRANCH="${BRANCH:-main}"
WORKFLOW="${WORKFLOW:-android-testing}"

echo "== Listing Codemagic apps =="
APPS=$(curl -sf -H "x-auth-token: $TOKEN" "$API/api/apps")
echo "$APPS" | python3 -c "
import json, sys
apps = json.load(sys.stdin).get('apps', [])
for a in apps:
    print(a.get('_id'), a.get('appName'), a.get('repository'), sep=' | ')
"
APP_ID=$(echo "$APPS" | python3 -c "
import json, sys
apps = json.load(sys.stdin).get('apps', [])
match = [a for a in apps if 'infinite-side-scroller' in (a.get('repository') or '')]
if not match:
    sys.exit('no app matching infinite-side-scroller — add the repo in the Codemagic UI first, then retry')
print(match[0]['_id'])
")

echo "== Starting build: app=$APP_ID workflow=$WORKFLOW branch=$BRANCH =="
BUILD=$(curl -sf -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d "{\"appId\": \"$APP_ID\", \"workflowId\": \"$WORKFLOW\", \"branch\": \"$BRANCH\"}" \
  "$API/api/builds")
BUILD_ID=$(echo "$BUILD" | python3 -c "import json,sys; print(json.load(sys.stdin).get('_id',''))")
if [ -z "$BUILD_ID" ]; then
  echo "ERROR: unexpected response:" >&2
  echo "$BUILD" >&2
  exit 1
fi
echo "Build started: $BUILD_ID"
echo "Dashboard: https://codemagic.io/builds/$BUILD_ID"

echo "== Polling (every 60s; upload lands on the Play internal track) =="
while true; do
  sleep 60
  STATE=$(curl -sf -H "x-auth-token: $TOKEN" "$API/api/builds/$BUILD_ID" | python3 -c "
import json, sys
d = json.load(sys.stdin)
b = d.get('build') or d.get('builds') or [d]
if isinstance(b, dict):
    b = [b]
print(b[0].get('status', 'unknown'))
" 2>/dev/null || echo unknown)
  echo "$(date +%H:%M:%S) status: $STATE"
  case "$STATE" in
    finished|success)
      echo "== BUILD SUCCEEDED — AAB is on the Play internal testing track =="
      exit 0
      ;;
    failed|error|canceled)
      echo "== BUILD FAILED — check the dashboard link above =="
      exit 1
      ;;
  esac
done
