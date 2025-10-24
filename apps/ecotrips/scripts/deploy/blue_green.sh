#!/usr/bin/env bash
set -euo pipefail

# Blue/Green deployment helper for Supabase Edge Functions + Ops Console static assets.
# Usage: scripts/deploy/blue_green.sh <supabase-project-ref> <edge-branch> <console-build-dir>

PROJECT_REF=${1:-}
EDGE_BRANCH=${2:-"main"}
CONSOLE_BUILD_DIR=${3:-"ops/console/.next"}

if [[ -z "$PROJECT_REF" ]]; then
  echo "Usage: $0 <supabase-project-ref> [edge-branch] [console-build-dir]" >&2
  exit 1
fi

if [[ ! -d "$CONSOLE_BUILD_DIR" ]]; then
  echo "Console build directory '$CONSOLE_BUILD_DIR' not found. Run npm run build --workspace ops/console first." >&2
  exit 1
fi

SUPABASE_BIN=${SUPABASE_BIN:-$(command -v supabase)}
if [[ -z "$SUPABASE_BIN" ]]; then
  echo "Supabase CLI not found. Install it before running this script." >&2
  exit 1
fi

set -x

# 1. Deploy Edge Functions to the staging slot
"$SUPABASE_BIN" functions deploy --project-ref "$PROJECT_REF" --branch "$EDGE_BRANCH" --dry-run
"$SUPABASE_BIN" functions deploy --project-ref "$PROJECT_REF" --branch "$EDGE_BRANCH"

# 2. Upload Ops Console build assets
aws s3 sync "$CONSOLE_BUILD_DIR" "s3://ecotrips-console-$PROJECT_REF-blue" --delete

# 3. Swap traffic (implementation depends on hosting provider)
# Placeholder: update DNS / CDN alias to point to the new bucket
# echo "Update CDN to point to ecotrips-console-$PROJECT_REF-blue"

set +x

base_url="https://${PROJECT_REF}.supabase.co/functions/v1"
echo "Growth endpoints staged:"
echo "  referral-link: ${base_url}/referral-link"
echo "  reward-grant: ${base_url}/reward-grant"
echo "  price-lock-offer: ${base_url}/price-lock-offer"
echo "  hold-extend-offer: ${base_url}/hold-extend-offer"
echo "  providers-air-status: ${base_url}/providers-air-status"
echo "  rebook-suggest: ${base_url}/rebook-suggest"

echo "Blue/green deploy queued. Complete the traffic switch via CDN configuration."
