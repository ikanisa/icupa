# Testing Overview

The monorepo uses a combination of unit, integration, and end-to-end tests:

- **`npm run verify`** – Runs lint, typecheck, and Vitest unit suites. Use this before every commit.
- **`npm run test`** – Direct Vitest invocation (unit + accessibility specs).
- **`npm run test:e2e`** – Playwright journeys (requires local browsers; may not run in sandboxed CI).
- **`supabase db test`** – Executes SQL/RLS regression tests against the local Supabase stack (requires Supabase Docker services running).

CI pipelines should invoke `npm run verify` by default and add Playwright/Supabase jobs where browser/DB support is available.

During local development:

```bash
supabase start
supabase db reset          # apply migrations + seed
npm run dev                # run PWA
npm run dev:agents         # start agents service
```

Run Vitest while coding (`npm run test -- --watch`) and schedule Playwright smoke runs before merging large changes to menu ingestion, AI waiter, or auth flows.

## Testing matrix and ownership

| Script | Coverage | Cadence | Primary owner | Notes |
| --- | --- | --- | --- | --- |
| `npm run verify` | Linting, type safety, unit tests | Per commit / PR | Platform Engineering | Runs `lint`, `typecheck`, and `vitest` via `pretest` hook that resets and seeds Supabase fixtures. |
| `npm run test` | Vitest unit suites, deterministic component specs | Daily & on release branches | Platform Engineering | Includes co-located UI tests (e.g. `MerchantShell`, `AdminQrTools`) with stable mocks for multi-tenant behaviour. |
| `npm run test:accessibility` | Axe accessibility audits for diner flows | Weekly | Design Systems Guild | Validates Action Dock, AI chat, and menu drawer semantics remain WCAG AA compliant. |
| `npm run test:e2e` | Playwright diner/merchant/admin journeys | Nightly & pre-release | Fullstack Enablement | Exercises multi-tenant checkout, merchant dashboards, and admin QR rotations with intercepted Supabase responses. |
| `npm run test:perf` | Lighthouse performance regression | Weekly / when landing perf-sensitive PRs | Perf Working Group | Requires local build + production bundle; publishes HTML reports under `artifacts/phase10`. |
| `supabase db test` | SQL migrations & RLS assertions | Nightly & schema PRs | Data Platform | Executes files in `supabase/tests/`, including multi-tenant invariants for orders, payments, and promos. |
| `npm run supabase:test` | Alias for `supabase db test` | Nightly & schema PRs | Data Platform | Uses `presupabase:test` hook to reset and seed the ephemeral database before assertions. |
