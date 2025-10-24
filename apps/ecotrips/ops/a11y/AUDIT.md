# ecoTrips Accessibility Audit Playbook

This playbook captures the repeatable steps the ops and product teams follow to validate new surfaces before shipping. The focus is automated linting plus manual sweeps with axe.

## Prerequisites

- Node.js 18+ with pnpm or npm available
- Chrome or Chromium with the [axe DevTools](https://www.deque.com/axe/devtools/) extension installed
- Local `.env` values populated for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Running axe in the browser

1. Start the ecoTrips client locally:
   ```bash
   npm run dev --workspace=@ecotrips/client
   ```
2. Open `http://localhost:3000` in Chrome and authenticate if required.
3. Launch the axe DevTools panel and run **Analyze** on the following key flows:
   - `/search` with the Autonomy Dial visible
   - `/results` with ExplainPrice enabled via the feature flag endpoint
   - `/app/(ops)/dashboard` in the admin console to inspect onboarding widgets
4. Resolve any **Serious** or **Critical** violations before merge. Record the scan in `SESSION_STATUS.md`.

## CLI smoke with axe-core

For CI or headless checks we use `@axe-core/cli`:

```bash
npx @axe-core/cli http://localhost:3000/search --save ./audit/axe-search.json
npx @axe-core/cli http://localhost:3000/results --save ./audit/axe-results.json
```

Review the generated reports and attach them to the deployment record in `DEPLOYMENT_READINESS_REPORT.md`.

## Regression guardrails

- Run the audit playbook whenever we ship new edge functions that affect rendering or dynamic content.
- Document false positives in this directory with the date and reason so future engineers can re-validate.
- Include the analytics-capture request ID in bug reports to cross-reference with Supabase logs.
