# ecoTrips Two-App Architecture Verification

## Build Checks
- `apps/client`: `npm run build --workspace @ecotrips/client`
- `apps/admin`: `npm run build --workspace @ecotrips/admin`

## Health & Functions
- Supabase Edge Functions: inventory-search, inventory-quote, bff-checkout, groups-create-escrow, ops-bookings, synthetics-probe
- Health endpoints: `/functions/v1/*/health` return `200` with `{ ok: true }`

## Performance
- `deno run -A ops/perf/perf_runner.ts --scenario smoke` (budget: `p95 ≤ 800ms`, `errors ≤ 1`)

## Screenshots
- Client PWA (mobile): _add screenshot URL_
- Admin console (desktop): _add screenshot URL_

## CI Pipelines
- `.github/workflows/web_build_client.yml`
- `.github/workflows/web_build_admin.yml`
- `.github/workflows/db_dry_run.yml`
- `.github/workflows/perf_smoke.yml`

## Rollout Validation
- `npm run test:map-route` (confirms safety-warning coverage fixtures stay in sync)
- `deno fmt --check supabase/functions` (guard for accidental drift while promoting to production)
- Verify Vercel deploy dashboards for both `@ecotrips/client` and `@ecotrips/admin` show green preview & production builds before cutover
- Hit `/functions/v1/map-route/health` and confirm payload includes `ok: true` plus log stream contains `map.route.safety_warning.coverage`

## Rollback Triggers
- Vercel preview or production deployment fails for either app or shows stale commit hashes
- `npm run test:map-route` or synthetics probe fails to cover all expected safety warnings
- Observability stream stops emitting `map.route.safety_warning.coverage` events for new requests

## Notes
- Client PWA offline caches itinerary JSON, tickets, and help contacts via `/sw.js`
- Admin access gated by `sec.user_roles` (`ops` & `admin` roles)
- Feature flags: `PAYMENT_MOCK`, `INVENTORY_OFFLINE`, `WA_OFFLINE`
