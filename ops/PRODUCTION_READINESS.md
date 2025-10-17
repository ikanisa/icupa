# Production Readiness Checklist

Use this checklist before promoting ecoTrips to a production environment. The values below assume Supabase is the system of record and all mocks are disabled. Sample configuration files are provided in `supabase/.env.production.example` and `ops/console/.env.production.example`.

## Environment Variables & Secrets
| Scope | Variable | Production Value |
| ----- | -------- | ---------------- |
| Supabase Edge | `SUPABASE_URL` | Supabase project REST URL (https://<project>.supabase.co) |
| Supabase Edge | `SUPABASE_SERVICE_ROLE` / `SUPABASE_SERVICE_ROLE_KEY` | Service-role key with RLS bypass. Required for every function. |
| Supabase Edge | `REFUND_AUTH_TOKEN` | Random secret shared between `ops-refund` and `payments-refund`. Mandatory. |
| Supabase Edge | `USE_FIXTURES` | `0` (do not ship fixtures) |
| Supabase Edge | `OPS_REFUND_MODE` | `live` |
| Supabase Edge | `INVENTORY_OFFLINE` | `0` |
| Supabase Edge | `HBX_API_KEY` / `HBX_API_SECRET` | Hotelbeds credentials with production quota. |
| Supabase Edge | `HBX_BASE` | Production HBX base URL (defaults to https://api.test.hotelbeds.com; override for prod). |
| Supabase Edge | `STRIPE_SECRET_KEY` | Stripe live secret key. |
| Supabase Edge | `STRIPE_WEBHOOK_SECRET` | Secret from Stripe webhook endpoint. |
| Supabase Edge | `STRIPE_MOCK_MODE` | `0` (set `1` only in sandboxes). |
| Supabase Edge | `MOCK_SIGNATURE_OK` | `0` (set `1` only when testing webhooks without Stripe). |
| Supabase Edge | `STRIPE_TIMEOUT_MS` | Optional. Tune per Stripe SLA (default 15000). |
| Supabase Edge | `WA_ACCESS_TOKEN` | Meta WhatsApp access token. |
| Supabase Edge | `WA_PHONE_ID` | WhatsApp phone number ID. |
| Supabase Edge | `WA_OFFLINE` | `0` (set `1` only when mocking sends). |
| Supabase Edge | `OPS_REFUND_MODE` | `live`; use `mock` only when `REFUND_AUTH_TOKEN` absent. |
| Supabase Edge | `OPS_OFFLINE_MODE` | Leave unset for production. |
| Supabase Edge | `CI_OFFLINE` | Unset. If present, CI will skip network actions.
| Ops Console | `SUPABASE_URL` | Same as Supabase Edge. |
| Ops Console | `SUPABASE_ANON_KEY` | Supabase anon key for browser clients. |
| Ops Console | `CI_OFFLINE` | Unset. |
| Ops Console | `OPSCONSOLE_OFFLINE_MODE` / `OPS_CONSOLE_BYPASS_AUTH` / `OPSCONSOLE_BYPASS_AUTH` | Unset so that RBAC enforcement is active. |
| Ops Console | `NEXT_PUBLIC_VERCEL_ENV` (if deployed) | Set per hosting provider requirements. |

## Runtime Expectations
- `bff-checkout`, `payments-refund`, and `stripe-webhook` abort on startup if Stripe credentials are missing unless explicit mock flags are set.
- `wa-send` refuses to start when WhatsApp tokens are unavailable (unless `WA_OFFLINE=1`).
- Inventory functions throw during cold start when Hotelbeds credentials are absent and `INVENTORY_OFFLINE` is not enabled.
- `ops-bookings` and `ops-exceptions` default to live Supabase views. Set `USE_FIXTURES=1` only when running the offline sandbox.
- `ops-refund` now forwards to `payments-refund` and will reject requests if no succeeded payment is found for the itinerary.

## Verification Pass
1. **Configuration audit** – confirm the environment matches the table above. Secrets should be delivered via the Supabase dashboard or infrastructure secret manager (not committed).
2. **Build & lint** – `npm run build --workspace ops/console` and `npm run lint --workspace ops/console`.
3. **CI smoke** – `npm run test:ci` with `SUPABASE_TEST_URL`, `SUPABASE_TEST_SERVICE_ROLE_KEY`, and `SUPABASE_TEST_ANON_KEY` pointing to staging credentials.
4. **Edge smoke** – run the existing commands in `ops/RUNBOOK.md` against a staging project with mock flags disabled. Verify audit logs emit `source:"view"`.
5. **Payments drill** – create a checkout intent, process a live webhook, and exercise `ops-refund` to ensure it forwards to Stripe and updates ledgers.
6. **Inventory drill** – execute search/quote/hold flows against Hotelbeds with rate limits observed.
7. **Privacy drill** – exercise the full privacy request lifecycle (`privacy-request`, `privacy-review`, `privacy-export`, `privacy-erasure-*`).
8. **WhatsApp drill** – send a real template and confirm storage records via `_shared/wa.ts` helpers.
9. **Observability** – confirm `synthetics-probe` returns `200` and alerts are wired to incident channels per `ops/observability/SLOS.md`.

## Launch Gate
- All toggles listed above are in their production position.
- Stripe, Hotelbeds, Supabase, and WhatsApp credentials are managed via secret storage with rotation path documented.
- Operators have verified RLS access by following `ops/ACCESS.md` and RBAC is enforced in the console (no bypass flags set).
- A rollback plan is written (re-deploy previous Supabase edge version and Next.js build) and on-call responders know escalation paths.
- CI is running with network access re-enabled so dependency and migration regressions are caught before deploy.

Keep this checklist alongside the runbooks and update it whenever new external integrations are added.

- Run `npm run guard:live` before promoting builds to verify Supabase credentials and confirm offline toggles are disabled.
