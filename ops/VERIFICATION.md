# ecoTrips Two-App Architecture Verification

## Deployments
- Production web deploys run on Vercel projects `ecoTrips-web` (`apps/client`) and `ecoTrips-admin` (`apps/admin`); keep environment variables in sync with the Vercel checklist before promoting to production.
- Supabase Edge Functions deploy to project ref `woyknezboamabahknmjr` using `supabase functions deploy`, grouped by surface (inventory, BFF, agents, groups, messaging).
- Database migrations ship through Supabase CLI flows and are dry-run by `.github/workflows/db_dry_run.yml` prior to release.

### Preview evidence & CI handoff
| Surface | Preview URL | CI workflow | Result link |
| --- | --- | --- | --- |
| Client PWA |  | `web_build_client.yml` |  |
| Admin console |  | `web_build_admin.yml` |  |
| Edge functions |  | `perf_smoke.yml` / manual `supabase functions deploy` |  |
| Database |  | `db_dry_run.yml` |  |

- Attach Supabase deploy output (from `supabase functions deploy --project-ref woyknezboamabahknmjr`) to the PR description or link here.
- Note any manual verifications (e.g., `supabase migration list`, Vercel environment diff) so reviewers can follow the same trail.

### Rollout verification log
| Surface | Target | Verification step | Status | Owner |
| --- | --- | --- | --- | --- |
| Client PWA | Vercel `ecoTrips-web` | Preview deploy renders `/` and `/results` without console errors; magic-link redirect tested. | _pending_ |  |
| Admin console | Vercel `ecoTrips-admin` | Verify `/login` gating + ops dashboards render; confirm `sec.user_roles` mapping. | _pending_ |  |
| Edge Functions | Supabase deploy | `supabase functions deploy <fn>` output captured; health endpoints checked post-deploy. | _pending_ |  |
| Database | Supabase migration | `supabase migration up` + dry-run workflow logs attached. | _pending_ |  |

## Build Checks
- `apps/client`: `npm run build --workspace @ecotrips/client`
- `apps/admin`: `npm run build --workspace @ecotrips/admin`

## Health & Functions
- Supabase Edge Functions: inventory-search, inventory-quote, bff-checkout, groups-create-escrow, ops-bookings, synthetics-probe
- Health endpoints: `/functions/v1/*/health` return `200` with `{ ok: true }`

### Health verification matrix
| Function | Endpoint | Expected | Last checked |
| --- | --- | --- | --- |
| inventory-search | `/functions/v1/inventory-search/health` | `200` + `{ ok: true, fn: "inventory-search" }` | _pending_ |
| inventory-quote | `/functions/v1/inventory-quote/health` | `200` + `{ ok: true, fn: "inventory-quote" }` | _pending_ |
| bff-checkout | `/functions/v1/bff-checkout/health` | `200` + `{ ok: true, fn: "bff-checkout" }` | _pending_ |
| groups-create-escrow | `/functions/v1/groups-create-escrow/health` | `200` + `{ ok: true, fn: "groups-create-escrow" }` | _pending_ |
| ops-bookings | `/functions/v1/ops-bookings/health` | `200` + `{ ok: true, fn: "ops-bookings" }` | _pending_ |
| synthetics-probe | `/functions/v1/synthetics-probe/health` | `200` + `{ ok: true, fn: "synthetics-probe" }` | _pending_ |

- Capture command output (status, latency) for each function in release notes. Attach Supabase request IDs when failures occur.

## Performance
- `deno run -A ops/perf/perf_runner.ts --scenario smoke` (budget: `p95 ≤ 800ms`, `errors ≤ 1`)

### Perf results log
| Scenario | Base URL | Date | p95 (ms) | Errors | Notes |
| --- | --- | --- | --- | --- | --- |
| smoke |  | _pending_ |  |  | Capture output from `perf_runner` CLI and link to raw log. |

- When budgets fail, create an incident stub referencing supplier/API latency and attach trace IDs from OTEL.

## Evaluations & Synthetic Monitoring
- `agents-eval-runner` replays prompts from `agents/evals/*.jsonl`; record run IDs and attach summaries for each release candidate.
- `synthetics-probe` pings critical Edge Functions and emits availability metrics via OTEL.

| Check | Command or URL | Run ID / Timestamp | Result | Notes |
| --- | --- | --- | --- | --- |
| Agents smoke eval | `supabase functions invoke agents-eval-runner --no-verify-jwt --data '{"label":"smoke"}'` | _pending_ |  | Capture `ok` rate vs expectations. |
| Agents report | `supabase functions invoke agents-eval-report --no-verify-jwt --data '{"run_id":"<uuid>"}'` | _pending_ |  | Link JSON diff for failures. |
| Synthetics health sweep | `curl -s https://<supabase-url>/functions/v1/synthetics-probe` | _pending_ |  | Track availability, failures, and critical outage counts. |

## Screenshots
- Client PWA (mobile): _add screenshot URL_
  - Capture 390x844 viewport showing itinerary results + offline banner; store in repo under `ops/observability/screenshots/client-mobile.png` and link here.
- Admin console (desktop): _add screenshot URL_
  - Capture 1440px wide ops dashboard with fixture indicator + role badge; save as `ops/observability/screenshots/admin-desktop.png` and link here.

| Surface | Viewport | File/Link | QA notes |
| --- | --- | --- | --- |
| Client PWA | 390x844 |  | Confirm offline fixture copy visible and nav responsive. |
| Admin console | 1440x900 |  | Validate role gating banner and table hydration. |

## Rollback readiness
- Link to the revert commit or branch that removes the rollout if blocking issues surface after deployment.
- Confirm `supabase migration revert` has been tested locally when a breaking database change is part of the release.
- Document the traffic ramp plan (e.g., start with internal allow-list) and the trigger for rolling back to the prior Vercel deployment.

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
