#!/usr/bin/env bash
set -euo pipefail

# Deploys all Supabase Edge Functions used by ICUPA.
# Usage:
#   ./scripts/supabase/deploy-functions.sh [--project <ref>] [--verify-jwt]
#
# By default we pass --no-verify-jwt so local/dev calls work without JWT checks.

PROJECT_REF=""
VERIFY_JWT="--no-verify-jwt"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_REF="$2"; shift 2 ;;
    --verify-jwt)
      VERIFY_JWT=""; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

function deploy() {
  local fn="$1"
  echo "▶ Deploying $fn"
  if [[ -n "$PROJECT_REF" ]]; then
    supabase functions deploy "$fn" $VERIFY_JWT --project-ref "$PROJECT_REF"
  else
    supabase functions deploy "$fn" $VERIFY_JWT
  fi
}

# Payments (aggregated under `payments`)
deploy payments

# Receipts pipeline (aggregated under `receipts`)
deploy receipts

# OCR ingestion lifecycle
deploy ingest_menu_start
deploy ingest_menu_process
deploy ingest_menu_publish

# Auth flows (aggregated under `auth`)
deploy auth

# Merchant (aggregated under `merchant`)
deploy merchant

# Reconciliation (aggregated under `reconciliation`)
deploy reconciliation

# Menu embeddings (aggregated under `menu`)
deploy menu

# Notifications (aggregated under `notifications`)
deploy notifications

# QR session + admin tools
deploy create_table_session
deploy admin

# Compliance / Auth bridges (aggregated under `compliance`)
deploy compliance

# Voice waiter (aggregated under `voice`)
deploy voice

# Ops tools
deploy ops

echo "✅ Deployment complete"
