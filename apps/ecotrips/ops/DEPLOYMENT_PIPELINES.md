# ecoTrips Deployment Pipelines

## Environments
- **Preview / Branch Deploys:** Generated for every feature branch. Builds run from the linked Vercel projects (`apps/client`, `apps/admin`). Deploys require a green GitHub Actions workflow and successful `scripts/vercel-preflight.mjs` execution before Vercel promotion is unlocked.
- **Staging:** Shares the same Vercel projects but pulls from the `staging` branch. Promotion from preview to staging requires:
  1. ✅ CI workflow passing (lint, unit, integration suites).
  2. ✅ Synthetic monitoring smoke passing (Playwright + API probes recorded in Datadog).
  3. ✅ Manual sign-off recorded in `ops/DEPLOYMENT_LOG.md`.
- **Production:** Promoted from staging once supersets of CI and synthetics succeed again after the staging cut.

## Promotion Flow
1. Developer opens PR → GitHub Actions executes `npm run ci` (workspace-aware) and `node scripts/vercel-preflight.mjs`.
2. On success the PR merges into `staging`; Vercel builds preview using `.vercel/project.json` metadata. Synthetic checks run against the preview URL and report back to GitHub via commit status (`synthetics/staging`).
3. Release captain runs `scripts/pipelines/promote.mjs --from preview --to staging` (records in `ops/DEPLOYMENT_LOG.md`).
4. When staging stabilizes, rerun CI and synthetics against the staging URL. Promotion to production uses `scripts/pipelines/promote.mjs --from staging --to production`.
5. Production promotion triggers:
   - Automatic smoke tests (`scripts/synthetics/run-smoke.mjs`).
   - Post-deploy webhook to Supabase for feature-flag sync.

## Controls
- Preview deploys **cannot** be promoted if either the GitHub check `ci/vercel-preflight` or `synthetics/preview` is red.
- Staging promotion requires `SYNTHETICS_STATUS=pass` annotation on the GitHub deployment.
- Production releases require the release checklist in `ops/PRODUCTION_READINESS.md` to be completed and attached to the GitHub release notes.
