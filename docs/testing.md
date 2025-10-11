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
