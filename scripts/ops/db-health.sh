#!/usr/bin/env bash
set -euo pipefail

# Prints DB health from the ops endpoint.
# Usage:
#   BASE=https://<ref>.functions.supabase.co ./scripts/ops/db-health.sh

if [[ -z "${BASE:-}" ]]; then
  echo "Missing BASE (e.g. https://<ref>.functions.supabase.co)" >&2
  exit 1
fi

curl -s "$BASE/ops/db_health" | jq -C .

