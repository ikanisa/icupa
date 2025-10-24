[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)
# ecoTrips — Monorepo
PWA + Supabase + Edge Functions baseline (starter).

- [Production readiness checklist](ops/PRODUCTION_READINESS.md)
- [Incident response playbook](ops/INCIDENT_RESPONSE.md)
- [Post-launch hardening cadence](ops/POST_LAUNCH_PLAN.md)

## Post-merge TODOs
- [ ] Add Playwright preview smoke tests covering PWA install + admin auth gate.
- [ ] Wire Sentry/error scrape dashboard for Supabase Edge Functions.
- [ ] Ship federated search engine (phase 2) across inventory + content.
- [ ] Explore voice concierge pilot (phase 2) with GPT-5 realtime.

## Branching Policy
See [docs/branching.md](docs/branching.md) for the authoritative branching workflow, including how the canonical `main` branch is
maintained from `work`, how feature branches are rebased, and how fast-forward merges keep history linear.

## All-in-One Travel AI Overview
### Agent fleet & coordination
- The agent registry defines PlannerCoPilot, ConciergeGuide, GroupBuilder, and other role-specific copilots with goals, guardrails, tool access, and KPI thresholds, providing the intelligence layer that spans planning, trip operations, finance, and support workflows.
- Each agent call is orchestrated through Supabase Edge Functions such as `agent-orchestrator`, which enforce tool schemas and audit logging so human reviewers can trace automated decisions end-to-end.

### Offline-first resiliency & fixtures
- Core inventory functions (`inventory-search`, `inventory-quote`, `inventory-hold`) ship with fixture fallbacks that can be toggled via `INVENTORY_OFFLINE`, ensuring travel search remains responsive during supplier outages or when credentials are unavailable.
- The operations console mirrors this pattern by detecting offline toggles and surfacing fixture-backed tables so on-call staff keep working even when live edges are paused.

### Autonomy dial & guardrails
- Environment toggles (`PAYMENT_MOCK`, `INVENTORY_OFFLINE`, `WA_OFFLINE`) and console bypass checks create an autonomy dial that lets operators step down automation before incident reviews or during rehearsals.
- Agent guardrails pair those runtime switches with HITL triggers (for example, manual approval on high-value bookings or payouts) so escalation paths remain explicit as autonomy increases.

### Group travel financing
- GroupBuilder coordinates shared escrows, contributions, and payouts by calling dedicated Edge Functions that validate membership, enforce thresholds, and emit audit logs for compliance reviews.

## Local Development
### Prerequisites
- Node.js 18.17+ with npm 10 (workspace root enforces the engine range).
- Supabase CLI for running the local database, authentication, and Edge Functions (`supabase start` uses the bundled `supabase/config.toml`).
- Recommended: Deno 1.41+ for running perf scripts under `ops/perf/`.

### Environment variables
| Scope | Variable | Notes |
| --- | --- | --- |
| Shared | `NEXT_PUBLIC_SUPABASE_URL` | Copy from Supabase project settings → `API`. Matches the Vercel `NEXT_PUBLIC_SUPABASE_URL` variable. |
| Shared | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anonymous key for the Supabase project; required for both client and admin Next.js apps. |
| Edge Functions | `SUPABASE_URL` | Base REST URL for Supabase. When running locally, Supabase CLI injects `http://localhost:54321`. |
| Edge Functions | `SUPABASE_SERVICE_ROLE` | Service role used by functions to perform privileged actions; store in `supabase/.env.local`. |
| Edge Functions | `INVENTORY_OFFLINE`, `PAYMENT_MOCK`, `WA_OFFLINE` | Feature flags controlling the autonomy dial for fixture fallbacks and payment sandboxing. |
| Admin console | `ADMIN_BYPASS_EMAILS` (optional) | Comma-separated allow-list for bypassing role checks during local rehearsals. |

### Install dependencies
```bash
npm install
```
Run once at the repo root to hydrate all workspaces so client/admin builds succeed during local testing or Vercel cache priming.

### Client PWA (`apps/client`)
```bash
npm run dev --workspace @ecotrips/client
```
- Expects `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to be present (add them to `.env.local` or source from the Vercel environment checklist).
- Visit `http://localhost:3000` for the traveler-facing shell with offline fixture messaging while services are mocked.

### Admin Console (`apps/admin`)
```bash
npm run dev --workspace @ecotrips/admin
```
- Requires the same Supabase anon credentials plus any console-specific bypass toggles when testing fixture mode locally.
- The console enforces role checks via `sec.user_roles`; seed local roles or use bypass toggles when rehearsing flows without Supabase auth configured yet.

### Supabase Edge Functions
```bash
supabase start
supabase functions serve agent-orchestrator --env-file supabase/.env.local
```
- `supabase start` launches Postgres, Auth, and Storage locally using the configured ports; keep the service running in a separate terminal.
- Use `supabase functions serve <name>` to iterate on individual functions. Provide a local env file with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`, and feature toggles like `INVENTORY_OFFLINE` when replaying fixture-backed scenarios.
- For nightly parity with production, deploy with `supabase functions deploy` targeting the `woyknezboamabahknmjr` project ref once changes pass CI.

### Seed local roles & fixtures
- Run `supabase db reset` to load the latest migration bundle, including seed data under `supabase/seed.sql`.
- Populate the `sec.user_roles` table with your email and the `ops` or `admin` role to unlock privileged dashboards in the admin console.
- When rehearsing fixture-only flows, toggle `INVENTORY_OFFLINE=1` and `PAYMENT_MOCK=1` in `supabase/.env.local` so GroupBuilder can simulate escrows without hitting live processors.

### Verify the stack before a PR
- Smoke test both front-ends with `npm run build --workspace @ecotrips/<app>` before pushing to ensure the Vercel builds align with local expectations.
- Capture Supabase function logs with `supabase logs functions --project-ref woyknezboamabahknmjr --follow` when validating new agent behaviors.
- Record findings in [`ops/VERIFICATION.md`](ops/VERIFICATION.md) so reviewers have a single source for Vercel preview URLs, health checks, performance runs, and screenshots.

