# Supabase Deployment Scripts

These helpers streamline setting secrets and deploying the Edge Functions used by ICUPA.

## Prerequisites

- Supabase CLI installed and authenticated (`supabase login`)
- A running Supabase project (local via `supabase start` or hosted)

## Validate migrations before pushing

Run the guardrail script before applying schema changes remotely. It ensures timestamps are ordered, no two migrations share the same timestamp prefix, and every migration ships with a non-empty matching `.down.sql`. The `db-push.sh` wrapper calls it automatically, but you can run it standalone as well:

```bash
node scripts/supabase/validate-migrations.mjs
```

## Configure secrets

1) Copy `.env.supabase.example` to `.env.supabase` and fill values.
2) Load them into your project:

```bash
# Local project
export SUPABASE_ENV_FILE=.env.supabase
set -a; source "$SUPABASE_ENV_FILE"; set +a

# Bulk set (examples)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
supabase secrets set OPENAI_API_KEY="$OPENAI_API_KEY"
supabase secrets set OCR_CONVERTER_URL="$OCR_CONVERTER_URL" OCR_CONVERTER_TOKEN="$OCR_CONVERTER_TOKEN"
supabase secrets set STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET"
supabase secrets set MOMO_WEBHOOK_HMAC_SECRET="$MOMO_WEBHOOK_HMAC_SECRET" AIRTEL_WEBHOOK_HMAC_SECRET="$AIRTEL_WEBHOOK_HMAC_SECRET"
supabase secrets set CLERK_JWKS_URL="$CLERK_JWKS_URL" CLERK_ISSUER="$CLERK_ISSUER"
```

Repeat for any additional variables you maintain (see `.env.supabase.example`).

## Deploy functions

Deploy all functions to the current project:

```bash
./scripts/supabase/deploy-functions.sh
```

Aggregator functions

- The CLI does not accept nested names (e.g. `payments/stripe/checkout`).
- Use aggregators instead: `payments`, `receipts`, `auth`, `merchant`, `menu`, `notifications`, `reconciliation`, `admin`, `voice`.
- Nested routes (like `payments/stripe/checkout`) are routed by the aggregator at runtime.

Deploy to a specific project and enforce JWT verification:

```bash
./scripts/supabase/deploy-functions.sh --project <your-ref> --verify-jwt
```
