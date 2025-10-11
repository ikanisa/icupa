#!/usr/bin/env bash
set -euo pipefail

# Updates scheduler_config key via ops endpoint.
# Usage:
#   BASE=https://<ref>.functions.supabase.co TOKEN=<SRK-or-AOS> ./scripts/ops/update-scheduler.sh [--key menu_embed_items_url] --url https://...

KEY="menu_embed_items_url"
URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --key) KEY="$2"; shift 2 ;;
    --url) URL="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "${BASE:-}" ]]; then
  echo "Missing BASE (e.g. https://<ref>.functions.supabase.co)" >&2
  exit 1
fi

if [[ -z "${TOKEN:-}" ]]; then
  echo "Missing TOKEN (service-role key or onboarding secret)" >&2
  exit 1
fi

if [[ -z "$URL" ]]; then
  echo "Missing --url" >&2
  exit 1
fi

curl -s -X POST "$BASE/ops/update_scheduler" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"key":"'"$KEY"'","value":"'"$URL"'"}' | jq -C .

