# Blue/Green Deployment Workflow

## Goals
- Zero-downtime Next.js promotions for `apps/client` and `apps/admin`.
- Safe Supabase migration rollout with automated validation and rollback path.

## Prerequisites
- Supabase migration scripts stored under `supabase/migrations` with `--dry-run` compatible checks.
- GitHub Actions workflow `deploy-blue-green.yml` configured with secrets:
  - `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_URL`.

## Procedure
1. **Cut Release Branch**
   - Branch from `staging` → `release/<yyyymmdd>`.
2. **Provision Green Slot**
3. **Apply Supabase Migrations**
   - `supabase migration up --env-file supabase/.env.green`.
   - Run `supabase db diff --linked` to ensure schema parity with main.
   - Execute `npm run test:ci -- --grep="supabase"` to validate data access.
4. **Synthetic & Functional Tests**
   - Trigger `scripts/synthetics/run-smoke.mjs --base-url https://green.ecotrips.app`.
   - QA executes manual regression using green URLs stored in `ops/DEPLOYMENT_LOG.md`.
5. **Switch Traffic**
6. **Decommission Blue**
   - `supabase migration list` to confirm no pending migrations.
   - Tag release: `git tag -a v<semver> -m "Blue/green promotion"` and push.

## Rollback Plan
- Revert Supabase migrations using `supabase migration down` with the last successful migration timestamp.
- Create incident entry in `ops/INCIDENT_LOG.md` capturing impact and remediation.
