#!/usr/bin/env bash
set -euo pipefail

# Lightweight smoke checks for Supabase Edge Functions.
# Uses env vars when present; prints HTTP status and short JSON for each check.
#
# Env:
#   BASE  - functions base, e.g. https://<ref>.functions.supabase.co (required)
#   SRK   - service role key for admin calls (optional)
#   AOS   - ADMIN_ONBOARDING_SECRET (optional)
#   TABLE_SESSION_ID - a valid table session UUID for checkout (optional)
#   SUB_ENDPOINT     - subscription endpoint for send_push test (optional)

if [[ -z "${BASE:-}" ]]; then
  echo "Missing BASE env (e.g. https://<ref>.functions.supabase.co)" >&2
  exit 1
fi

function h() { echo -e "\n▶ $1"; }
function j() { jq -C . 2>/dev/null || cat; }

set +e

h "payments/stripe/checkout (GET should be 405)"
curl -s -i "$BASE/payments/stripe/checkout" | sed -n '1,1p'

if [[ -n "${TABLE_SESSION_ID:-}" ]]; then
  h "payments/stripe/checkout (POST pending if STRIPE unset)"
  curl -s -X POST "$BASE/payments/stripe/checkout" \
    -H 'Content-Type: application/json' \
    -H "x-icupa-session: $TABLE_SESSION_ID" \
    -d '{"items":[{"name":"Smoke Item","unit_price_cents":1000,"quantity":1}]}' | j
else
  echo "(skip checkout POST: TABLE_SESSION_ID not set)"
fi

if [[ -n "${AOS:-}" ]]; then
  h "admin/onboard_tenant"
  curl -s -X POST "$BASE/admin/onboard_tenant" \
    -H "Authorization: Bearer $AOS" \
    -H 'Content-Type: application/json' \
    -d '{"tenant_name":"Smoke Tenant","region":"EU"}' | j
else
  echo "(skip onboard_tenant: AOS not set)"
fi

if [[ -n "${SRK:-}" ]]; then
h "reconciliation/run (dry-run)"
curl -s -X POST "$BASE/reconciliation/run?dry_run=1" -H "Authorization: Bearer $SRK" -d '{"dry_run":true}' | j

h "receipts/process_queue"
curl -s -X POST "$BASE/receipts/process_queue" -H "Authorization: Bearer $SRK" | j
else
  echo "(skip reconciliation/receipts: SRK not set)"
fi

if [[ -n "${SUB_ENDPOINT:-}" ]]; then
  h "notifications/send_push (dry run by endpoint)"
  curl -s -X POST "$BASE/notifications/send_push" \
    -H 'Content-Type: application/json' \
    -d '{"endpoint":"'"$SUB_ENDPOINT"'","payload":{"title":"Smoke"},"dry_run":true}' | j
else
  echo "(skip notifications/send_push: SUB_ENDPOINT not set)"
fi

echo "\n✅ Smoke run complete"
