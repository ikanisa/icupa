# Blue/Green Deployment Workflow

## Goals
- Zero-downtime Next.js promotions for `apps/client` and `apps/admin`.
- Safe Supabase migration rollout with automated validation and rollback path.

## Prerequisites
- Two Vercel environments: **blue** (current production) and **green** (candidate).
- Supabase migration scripts stored under `supabase/migrations` with `--dry-run` compatible checks.
- GitHub Actions workflow `deploy-blue-green.yml` configured with secrets:
  - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_CLIENT`, `VERCEL_PROJECT_ID_ADMIN`.
  - `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_URL`.

## Procedure
1. **Cut Release Branch**
   - Branch from `staging` → `release/<yyyymmdd>`.
   - Run `npm run ci` and `node scripts/vercel-preflight.mjs` locally.
2. **Provision Green Slot**
   - `vercel env pull --environment=production --token $VERCEL_TOKEN` for both apps.
   - `vercel deploy --prebuilt --env PRODUCTION_SLOT=green` to seed candidate build.
3. **Apply Supabase Migrations**
   - `supabase migration up --env-file supabase/.env.green`.
   - Run `supabase db diff --linked` to ensure schema parity with main.
   - Execute `npm run test:ci -- --grep="supabase"` to validate data access.
4. **Synthetic & Functional Tests**
   - Trigger `scripts/synthetics/run-smoke.mjs --base-url https://green.ecotrips.app`.
   - QA executes manual regression using green URLs stored in `ops/DEPLOYMENT_LOG.md`.
5. **Switch Traffic**
   - Update Vercel aliases: `vercel alias set ecotrips-client-green ecotrips-client` and same for admin.
   - Monitor Supabase logs + Vercel metrics for 15 minutes.
6. **Decommission Blue**
   - Archive previous alias (`vercel alias rm ecotrips-client-blue`).
   - `supabase migration list` to confirm no pending migrations.
   - Tag release: `git tag -a v<semver> -m "Blue/green promotion"` and push.

## Rollback Plan
- Re-point alias back to blue: `vercel alias set ecotrips-client-blue ecotrips-client`.
- Revert Supabase migrations using `supabase migration down` with the last successful migration timestamp.
- Create incident entry in `ops/INCIDENT_LOG.md` capturing impact and remediation.
