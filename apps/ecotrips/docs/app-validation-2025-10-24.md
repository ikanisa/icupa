# App validation summary (2025-10-24)

## Commands executed

- `npm run lint --workspace app`
  - Result: ✅ Completed. `next lint` reported no warnings or errors.
  - Notes: npm emitted deprecation notices about the `next lint` wrapper and anonymous telemetry prompt.
- `npm run build --workspace app`
  - Result: ❌ Fails in two stages.
    - The prebuild env validation stops the run when `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are absent.
    - Supplying placeholder values allows the env check to pass, but the Turbopack build panics with `TurbopackInternalError: Failed to write page endpoint /_error` while processing `app/globals.css`.
  - No build output is produced.
- `npm run test --workspace app`
  - Result: ⚠️ Blocked.
    - `pretest` triggers `npx playwright install --with-deps chromium firefox`, which attempts to install ~200MB of system packages and browser binaries.
    - The package install succeeds after retrying a 403 on `https://mise.jdx.dev`, but browser downloads hit CDN blocks (403) and the run stalls before tests execute.
  - Tests themselves never start; no browser binaries are cached for reuse.

## Intake form verification

- The marketing intake form (`app/app/components/LeadCaptureForm.tsx`) posts to `/api/leads`, which requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- The repo does not provide service credentials, and the API route rejects requests when they are missing (`503` with "Supabase credentials missing").
- Without valid Supabase service access, we cannot insert records into `marketing_leads` or confirm downstream population of `clients` / `client_intents` tables.

## Outstanding gaps / follow-up

1. Investigate the Turbopack panic when building under Next.js 15.5.3 with Tailwind 4 preview.
2. Coordinate on obtaining sanctioned Supabase service credentials (or spin up a sanctioned staging project) so the intake form can be tested end-to-end.
3. Provision Playwright browsers in CI/CD (or cache them in the workspace) so `npm run test --workspace app` can complete in constrained environments.

