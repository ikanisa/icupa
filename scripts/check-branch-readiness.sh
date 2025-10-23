#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$ROOT_DIR"

log() {
  printf '\n[check-branch-readiness] %s\n' "$1"
}

log "Running lint across all workspaces (if defined)"
npm run lint --workspaces --if-present

log "Running contract and observability tests"
export NEXT_TELEMETRY_DISABLED="1"
missing_env=()
for var in SUPABASE_TEST_URL SUPABASE_TEST_SERVICE_ROLE_KEY SUPABASE_TEST_ANON_KEY; do
  if [ -z "${!var:-}" ]; then
    missing_env+=("$var")
  fi
done

if [ "${#missing_env[@]}" -ne 0 ]; then
  log "Missing required environment variables for tests: ${missing_env[*]}"
  log "Populate the testing credentials (see ops/PRODUCTION_READINESS.md) before re-running."
  exit 1
fi

npm run test:ci

log "Building client-facing applications"
npm run build:client
npm run build:admin

log "All readiness checks passed."
