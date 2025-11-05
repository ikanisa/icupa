# Zero-Downtime Migration Runbook

**Owner:** Platform Engineering
**Last Updated:** 2025-11-01

This runbook covers database schema rollout, data backfill, feature flag orchestration, and rollback steps required to deploy Supabase changes without downtime.

---

## 1. Pre-Migration Checklist

- [ ] RFC updated (`docs/rfc-001-repo-refactor.md`) with migration scope.
- [ ] Schema reviewed with DBA + security (RLS impact assessed).
- [ ] Migration PR includes:
  - SQL migration (`supabase/migrations/*`)
  - Backfill script (SQL or TypeScript task)
  - Feature flag toggle plan (`packages/config/src/flags.ts`)
  - Observability updates (dashboard, alert thresholds)
- [ ] Load tests executed on staging if touching high-volume tables.

## 2. Schema Deployment (Additive First)

1. Generate migration: `pnpm supabase:generate migration "<summary>"`.
2. Ensure migration is additive (no drops). If drops required, split into follow-up once adoption complete.
3. Run `supabase db reset --env preview` to validate clean bootstrap.
4. Merge PR only after CI green + reviewer approval from DBA + Platform lead.
5. Deploy using `supabase db push --project-ref <env>`.
6. Record migration in release issue template under "DB Changes".

## 3. Backfill Procedure

1. Launch staging Supabase job:
   ```bash
   supabase db remote commit --project-ref <staging-ref> \
     --file supabase/seed/backfill_tenant_profiles.sql
   ```
2. Monitor `tenant_migration_audit` for row counts and anomalies.
3. For production, schedule during low-traffic window. Use chunked script:
   ```sql
   select run_tenant_backfill(batch_size => 500, sleep_ms => 200);
   ```
4. Abort on error rate >0.5% or runtime >30 minutes; investigate before retrying.
5. Once complete, update Grafana dashboard "Tenancy → Migration" to reflect success.

## 4. Feature Flag Rollout

1. Confirm new code paths guard behind flag in `packages/config/src/flags.ts`.
2. Rollout cadence:
   - T+0h: Enable for `demo_icupa` (internal testing).
   - T+12h: Enable for `pilot_*` tenants.
   - T+36h: Enable for low-volume GA tenants (<500 orders/week).
   - T+72h: Enable for all tenants once KPIs stable.
3. Track metrics: error rate (`<1%`), P95 latency (`<350ms`), AI guardrail breaches (0).
4. Document toggle changes in `docs/runbooks/rollback-log.md`.

## 5. Monitoring & Alerting

- Dashboards: `ICUPA/rollout`, `ICUPA/tenant-health`, `ICUPA/ai-guardrails`.
- Alerts:
  - Error rate >1% for 5 min ⇒ page on-call.
  - Migration job failure ⇒ Slack `#release`.
  - Lighthouse score drop >5 points ⇒ create incident ticket.
- Use `scripts/observability/publish-lighthouse.sh` to archive metrics in `artifacts/lighthouse/`.

## 6. Rollback Procedure

1. Disable feature flag via admin console or CLI:
   ```bash
   pnpm flags:disable tenant.enableNewProfile --tenant=<slug>
   ```
2. Run stored procedure `select sp_restore_legacy_tenant_views();`.
3. Re-run smoke tests: `pnpm --filter web test:e2e -- --grep "tenancy"`.
4. If schema rollback required, apply `supabase/migrations/*_rollback.sql` (maintain pair migration for destructive changes).
5. Update `docs/runbooks/rollback-log.md` with incident summary and remediation tasks.

## 7. Post-Migration

- Confirm metrics stable for 7 days before scheduling destructive cleanup (dropping legacy columns).
- Update `docs/rfc-001-repo-refactor.md` and `CHANGELOG.md` with deployment notes.
- Archive coverage and Lighthouse reports from rollout in `artifacts/` for audit.

