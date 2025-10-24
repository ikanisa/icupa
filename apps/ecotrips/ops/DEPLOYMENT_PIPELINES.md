# ecoTrips Deployment Pipelines

## Environments
  1. ✅ CI workflow passing (lint, unit, integration suites).
  2. ✅ Synthetic monitoring smoke passing (Playwright + API probes recorded in Datadog).
  3. ✅ Manual sign-off recorded in `ops/DEPLOYMENT_LOG.md`.
- **Production:** Promoted from staging once supersets of CI and synthetics succeed again after the staging cut.

## Promotion Flow
3. Release captain runs `scripts/pipelines/promote.mjs --from preview --to staging` (records in `ops/DEPLOYMENT_LOG.md`).
4. When staging stabilizes, rerun CI and synthetics against the staging URL. Promotion to production uses `scripts/pipelines/promote.mjs --from staging --to production`.
5. Production promotion triggers:
   - Automatic smoke tests (`scripts/synthetics/run-smoke.mjs`).
   - Post-deploy webhook to Supabase for feature-flag sync.

## Controls
- Staging promotion requires `SYNTHETICS_STATUS=pass` annotation on the GitHub deployment.
- Production releases require the release checklist in `ops/PRODUCTION_READINESS.md` to be completed and attached to the GitHub release notes.
