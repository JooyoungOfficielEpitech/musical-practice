#!/bin/bash
# E2E orchestrator — runs the full hybrid E2E test suite.
# Sequence: seed → per-flow (API setup → Maestro → API assert) → cleanup → report
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."  # run from project root

E2E_DIR="e2e"
FLOWS_DIR="$E2E_DIR/flows"
ACCOUNTS_FILE="$E2E_DIR/accounts.json"
RESULTS_DIR="e2e/results"
FAILED=0
PASSED=0
TOTAL=0

# ── Check dependencies ────────────────────────────────────────────────────────
if ! command -v maestro &>/dev/null; then
  echo "❌ Maestro not installed. Run: curl -Ls https://get.maestro.mobile.dev | bash"
  exit 1
fi
if ! command -v jq &>/dev/null; then
  echo "❌ jq not installed. Run: brew install jq"
  exit 1
fi

# ── Load .env.test if present ─────────────────────────────────────────────────
if [ -f "$E2E_DIR/.env.test" ]; then
  set -a && source "$E2E_DIR/.env.test" && set +a
  echo "📋 Loaded e2e/.env.test"
fi

# ── Seed ──────────────────────────────────────────────────────────────────────
echo ""
echo "🌱 Seeding test data..."
npx tsx "$E2E_DIR/helpers/seed.ts"
mkdir -p "$RESULTS_DIR"

# ── Inject session into simulator AsyncStorage ────────────────────────────────
echo ""
echo "🔑 Injecting auth session into simulator..."
bash "$E2E_DIR/helpers/inject-session.sh" || {
  echo "⚠️  Session injection failed — flows will run unauthenticated"
}

# ── run_flow: runs Maestro flow with -e flags (v2.2.0 compatible) ─────────────
run_flow() {
  local flow_file="$1" feature="$2" role="$3" email="$4" password="$5"
  maestro test "$flow_file" \
    -e "EMAIL=$email" \
    -e "PASSWORD=$password" \
    --format junit \
    --output "$RESULTS_DIR/${feature}-${role}.xml" \
    2>&1 | tail -5
}
# ── Run flows ─────────────────────────────────────────────────────────────────
echo ""
echo "🎭 Running E2E flows..."

for flow_dir in "$FLOWS_DIR"/*/; do
  [ -d "$flow_dir" ] || continue
  feature=$(basename "$flow_dir")
  echo ""
  echo "  📱 Feature: $feature"

  for flow_file in "$flow_dir"*.yaml; do
    [ -f "$flow_file" ] || continue
    role=$(basename "$flow_file" .yaml)

    email=$(jq -r ".roles[\"$role\"].email // empty" "$ACCOUNTS_FILE" 2>/dev/null)
    password=$(jq -r ".roles[\"$role\"].password // empty" "$ACCOUNTS_FILE" 2>/dev/null)

    if [ -z "$email" ] || [ -z "$password" ]; then
      echo "    ⚠️  No account config for role '$role', skipping"
      continue
    fi

    TOTAL=$((TOTAL + 1))

    # API setup (simulate other users before Maestro runs)
    setup_script="${flow_dir}${role}-setup.ts"
    if [ -f "$setup_script" ]; then
      echo "    🔧 API setup for $role..."
      if ! npx tsx "$setup_script"; then
        echo "    ❌ API setup failed"
        FAILED=$((FAILED + 1))
        continue
      fi
    fi

    # Re-inject session before each flow (launchApp can reset state)
    bash "$E2E_DIR/helpers/inject-session.sh" 2>/dev/null || true

    # Maestro UI flow (credentials handled in isolated subshell)
    echo "    ▶️  Maestro: $role"
    if run_flow "$flow_file" "$feature" "$role" "$email" "$password"; then
      echo "    ✅ $role PASSED"
      PASSED=$((PASSED + 1))
    else
      echo "    ❌ $role FAILED"
      FAILED=$((FAILED + 1))
    fi

    # API assertions (verify cross-user effects)
    assert_script="${flow_dir}${role}-assert.ts"
    if [ -f "$assert_script" ]; then
      echo "    🔍 API assertions for $role..."
      npx tsx "$assert_script" || { echo "    ❌ API assertions failed"; FAILED=$((FAILED + 1)); }
    fi
  done
done

# ── Cleanup ───────────────────────────────────────────────────────────────────
echo ""
echo "🧹 Cleaning up test data..."
npx tsx "$E2E_DIR/helpers/cleanup.ts"

# ── Report ────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════"
echo "  E2E Results: $PASSED/$TOTAL passed"
[ $FAILED -gt 0 ] && echo "  ❌ $FAILED failed" || echo "  ✅ All passed"
echo "══════════════════════════════════"

[ $FAILED -gt 0 ] && exit 1 || exit 0
