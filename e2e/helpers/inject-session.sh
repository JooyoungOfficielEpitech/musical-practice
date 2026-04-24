#!/bin/bash
# Injects a Supabase session into the iOS simulator's AsyncStorage
# so the app launches as a logged-in user — bypassing Apple Sign-In.
#
# How it works:
#   @react-native-async-storage/async-storage on iOS stores:
#     - manifest.json: { key → null } for large values (> 1024 bytes)
#     - A file named MD5(key): raw value string
#   We write both files before maestro launches the app.
#
# Usage: bash e2e/helpers/inject-session.sh [UDID] [BUNDLE_ID]
# Defaults: booted simulator, com.musicalpractice

set -euo pipefail

UDID="${1:-}"
BUNDLE_ID="${2:-com.musicalpractice}"

# Load env vars
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.test"
if [ -f "$ENV_FILE" ]; then
  set -a && source "$ENV_FILE" && set +a
fi

# Discover booted simulator UDID if not provided
if [ -z "$UDID" ]; then
  UDID=$(xcrun simctl list devices | grep Booted | grep -oE '[A-F0-9-]{36}' | head -1)
  if [ -z "$UDID" ]; then
    echo "❌ No booted iOS simulator found" >&2
    exit 1
  fi
fi

# Find app data container (identified by bundle ID in the path)
APP_SUPPORT=$(find ~/Library/Developer/CoreSimulator/Devices/$UDID/data/Containers/Data/Application \
  -maxdepth 4 -type d -name "$BUNDLE_ID" 2>/dev/null | head -1)

if [ -z "$APP_SUPPORT" ]; then
  echo "❌ App data container not found for $BUNDLE_ID on $UDID" >&2
  echo "   Have you run the app at least once? Try: maestro test e2e/flows/onboarding/user.yaml" >&2
  exit 1
fi

STORAGE_DIR=$(cd "$APP_SUPPORT" && pwd)/RCTAsyncLocalStorage_V1
mkdir -p "$STORAGE_DIR"

echo "📂 AsyncStorage: $STORAGE_DIR"

# Get Supabase session via tsx (pass env vars explicitly)
SESSION_JSON=$(SUPABASE_URL="$SUPABASE_URL" SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" npx tsx e2e/helpers/get-session.ts)
if [ -z "$SESSION_JSON" ]; then
  echo "❌ Failed to get session" >&2
  exit 1
fi

# Supabase storage key and its MD5 hash (used as filename)
STORAGE_KEY="sb-iwmbhzpntgeeikjhzdfa-auth-token"
KEY_MD5=$(echo -n "$STORAGE_KEY" | md5 2>/dev/null || echo -n "$STORAGE_KEY" | md5sum | cut -d' ' -f1)

# Write manifest.json:
#   - session key → null (value is in a separate file, > 1024 bytes)
#   - onboarding_complete → "true" (small value, stored inline)
ONBOARDING_KEY="@musicalpractice\/onboarding_complete"
echo "{\"$STORAGE_KEY\":null,\"$ONBOARDING_KEY\":\"true\"}" > "$STORAGE_DIR/manifest.json"

# Write the session JSON as the data file (named after MD5 of the key)
echo -n "$SESSION_JSON" > "$STORAGE_DIR/$KEY_MD5"

echo "✅ Session injected (key: $STORAGE_KEY, file: $KEY_MD5)"
echo "✅ Onboarding flag set"
