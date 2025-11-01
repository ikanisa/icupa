# Database Migration Review

## Inventory
- Supabase migrations in `supabase/migrations/` with timestamped SQL.
- Includes RLS policy creation, enum additions, AI agent audit tables.
- Down migrations present but require manual verification of data loss risk.

## Findings
1. **Policy Coverage** – Phase8 admin console migration introduces policies for `tenant_kpi_snapshots`, `compliance_tasks`, `agent_config_audit_events`. Need automated tests verifying row-level access per tenant.
2. **Service Role Usage** – Many edge functions rely on `SUPABASE_SERVICE_ROLE_KEY`; ensure migrations keep service role privileged actions minimal and audit them.
3. **Idempotency** – Some migrations (e.g., `voice_agent_calls`) drop/create policies without `IF EXISTS`; ensure reruns safe in CI resets.
4. **Rollbacks** – Down migrations delete policies and tables; confirm data backups before rolling back to avoid loss of audit history.
5. **Seed Data** – `supabase/seed.sql` contains demo tenants; ensure staging/prod use environment-specific seeds.
6. **Backups** – Document Supabase PITR strategy, nightly backups, and restore drills (RPO ≤ 15 minutes, RTO ≤ 1 hour).

## Recommendations
- Add migration tests using `scripts/ci/reset-supabase-test-db.mjs` to run `supabase db reset` in CI, verifying migrations apply cleanly.
- Implement `supabase/tests` harness to check RLS enforcement with sample JWTs per role.
- Introduce migration review checklist: schema diff, RLS coverage, rollback plan.
- Automate backups via Supabase scheduled backups + external archive (S3) for compliance verticals.
- Tag migrations with issue IDs and expected downtime; enforce `lock_timeout` to avoid long-running locks.
