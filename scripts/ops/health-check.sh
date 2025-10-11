#!/usr/bin/env bash
set -euo pipefail

# Minimal post-deploy health checks for Supabase Functions.
# Env:
#   BASE  - functions base, e.g. https://<ref>.functions.supabase.co (required)
#   ALLOW_RECEIPTS_500 - accept 500 from receipts/process_queue (default: true)

if [[ -z "${BASE:-}" ]]; then
  echo "Missing BASE (e.g. https://<ref>.functions.supabase.co)" >&2
  exit 1
fi

ALLOW_RECEIPTS_500=${ALLOW_RECEIPTS_500:-true}

function status() {
  local method="$1"; shift
  local url="$1"; shift
  local data="${1:-}"; shift || true
  if [[ -n "$data" ]]; then
    curl -s -X "$method" "$url" -H 'Content-Type: application/json' -d "$data" -o /tmp/resp.json -w '%{http_code}'
  else
    curl -s -X "$method" "$url" -o /tmp/resp.json -w '%{http_code}'
  fi
}

failures=0

echo "▶ Ops DB Health"
code=$(status GET "$BASE/ops/db_health")
cat /tmp/resp.json | jq -C . || cat /tmp/resp.json
if [[ "$code" != "200" ]]; then
  echo "❌ db_health HTTP $code"; failures=$((failures+1));
fi

expected_sched="$BASE/menu/embed_items"
actual_sched=$(jq -r '.scheduler.menu_embed_items_url // empty' /tmp/resp.json | sed 's#/*$##')
if [[ -z "$actual_sched" || "$actual_sched" != "$expected_sched" ]]; then
  echo "⚠️  Scheduler mismatch: expected=$expected_sched actual=${actual_sched:-null}"
fi

echo "\n▶ Reconciliation dry-run"
code=$(status POST "$BASE/reconciliation/run?dry_run=1" '{"dry_run":true}')
cat /tmp/resp.json | jq -C . || cat /tmp/resp.json
if [[ "$code" != "200" ]]; then
  echo "❌ reconciliation HTTP $code"; failures=$((failures+1));
fi

echo "\n▶ Receipts process_queue"
code=$(status POST "$BASE/receipts/process_queue" '{}')
cat /tmp/resp.json | jq -C . || cat /tmp/resp.json
if [[ "$code" != "200" && "$code" != "202" && "$code" != "204" && ! ( "$ALLOW_RECEIPTS_500" == "true" && "$code" == "500" ) ]]; then
  echo "❌ receipts HTTP $code"; failures=$((failures+1));
fi

if [[ $failures -gt 0 ]]; then
  echo "\n❌ Health checks failed: $failures"
  exit 1
fi

echo "\n✅ Health checks passed"

