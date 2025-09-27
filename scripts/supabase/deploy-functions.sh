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

# Payments
deploy payments/stripe/checkout
deploy payments/stripe/webhook
deploy payments/momo/request_to_pay
deploy payments/momo/webhook
deploy payments/airtel/request_to_pay
deploy payments/airtel/webhook

# Receipts pipeline
deploy receipts/issue_ebm_rwanda
deploy receipts/issue_fiscal_malta
deploy receipts/process_queue

# OCR ingestion lifecycle
deploy ingest_menu_start
deploy ingest_menu_process
deploy ingest_menu_publish

# Auth flows
deploy auth/whatsapp_send_otp
deploy auth/whatsapp_verify_otp
deploy auth/whatsapp_webhook
deploy auth/admin_email_magiclink

# Merchant onboarding helpers
deploy merchant/onboarding_update

# Merchant inventory
deploy merchant/inventory/auto_86

# Reconciliation
deploy reconciliation/reconcile_daily

# Menu embeddings refresh
deploy menu/embed_items

# Notifications
deploy notifications/subscribe_push
deploy notifications/send_push

# QR session + admin tools
deploy create_table_session
deploy admin/reissue_table_qr

# Compliance / Auth bridges
deploy compliance/verify_clerk

# Voice waiter
deploy voice/session

echo "✅ Deployment complete"
