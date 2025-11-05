# Go‑Live Runbook

This runbook captures the required steps to promote ICUPA into staging/production with zero downtime, phased rollouts, and monitoring aligned to SLO targets.

## 0) Final Verification Gate

- [ ] CI green (`pnpm turbo run lint typecheck test build`)
- [ ] Coverage ≥ 80% uploaded to `artifacts/coverage/`
- [ ] Lighthouse thresholds met (Perf ≥90, PWA ≥95, A11y ≥95, SEO ≥95) and archived in `artifacts/lighthouse/`
- [ ] Supabase migrations dry-run via `supabase db reset --env preview`
- [ ] Deployment checklist completed in release issue template

## 1) Supabase Project Link & Secrets

1. Login and link:
   ```bash
   supabase login  # requires SUPABASE_ACCESS_TOKEN
   supabase link --project-ref <project-ref>
   ```
2. Set secrets using checked-in template:
   ```bash
   ./scripts/supabase/set-secrets.sh --project <project-ref> --env-file .env.supabase
   ```
3. Verify Vault entries for service role keys rotated within last 90 days.

## 2) Deploy Edge Functions

```bash
./scripts/supabase/deploy-functions.sh --project <project-ref>
```

- Validate function logs for warmup success.
- Update observability annotations with deployment ID.

## 3) Schema + Backfill (Zero Downtime)

1. Apply additive migrations:
   ```bash
   supabase db push --project-ref <project-ref>
   supabase db test
   ```
2. Execute backfill:
   ```bash
   supabase db remote commit --project-ref <project-ref> \
     --file supabase/seed/backfill_tenant_profiles.sql
   ```
3. Monitor `tenant_migration_audit` table. Abort if error rate >0.5%.
4. Leave destructive cleanup behind feature flag until post-GA.

Refer to [`zero-downtime-migration.md`](./zero-downtime-migration.md) for full details.

## 4) Deploy Runtime Surfaces

### Agents Service

```bash
cd agents-service
pnpm build
docker build -t icupa-agents:<sha> .
docker push <registry>/icupa-agents:<sha>
# Deploy via K8s
kubectl apply -f deployments/<env>/agents-service.yaml
```

- Verify health endpoint `/healthz` responds 200.
- Confirm feature flags for agent budgets set correctly (`agent_runtime_configs`).

### Web PWA (Vercel)

```bash
pnpm --filter web build
vercel deploy --prebuilt --env=production
```

- Validate environment variables via `vercel env pull`.
- Smoke test tenant login & AI flows before promotion.

## 5) Observability & SLO Guardrails

- Dashboards: `ICUPA/rollout`, `ICUPA/ai-guardrails`, `ICUPA/payments`.
- Metrics to monitor during rollout window:
  - Error rate <1%
  - API P95 latency <350ms
  - Agent hallucination alerts = 0
  - Payments success rate ≥ 99%
- Trigger synthetic Lighthouse run:
  ```bash
  pnpm perf:lighthouse --site https://<env>.icupa.app --output artifacts/lighthouse/<timestamp>
  ```
- Archive metrics snapshot in `artifacts/observability/`.

## 6) Phased Release Plan

1. **Feature Flag Prep**
   - Ensure flags defined in `packages/config/src/flags.ts`.
   - Document enable/disable commands in release issue.
2. **Canary Deployment**
   - Enable new feature for `demo_icupa` tenant.
   - Observe metrics for 12h; if stable, extend to `pilot_*` tenants via CLI:
     ```bash
     pnpm flags:enable tenant.enableNewProfile --tenant=pilot_kigali
     ```
3. **Gradual Rollout**
   - Expand to low-volume tenants, then full fleet after 72h of healthy metrics.
   - Update `docs/runbooks/rollback-log.md` with timestamps and outcomes.
4. **Communication**
   - Notify support + account managers before each phase.
   - Provide status updates in `#release` channel every 6h during rollout.

## 7) E2E Checks on Staging

```bash
PLAYWRIGHT_BASE_URL=https://staging.icupa.dev pnpm test:e2e \
  -- --config tests/playwright/playwright.config.ts --reporter=html
```

- Attach HTML report to release ticket.
- Run smoke scripts: `./scripts/smoke/functions-smoke.sh` & `./scripts/ops/db-health.sh`.

## 8) Production Promotion

- Obtain approvals (Product, Engineering, Ops) recorded in release issue.
- Promote Vercel deployment to production.
- Tag release: `git tag vX.Y.Z && git push origin vX.Y.Z`.
- Update status page and incident log.

## 9) Rollback Readiness

- Feature flag disable command prepared (see `zero-downtime-migration.md`).
- Supabase point-in-time restore checkpoints noted.
- Container image for previous release retained (`<registry>/icupa-agents:<prev-sha>`).
- Execute `pnpm --filter web test:e2e -- --grep "smoke"` post-rollback.

## 10) Post-Release

- Monitor dashboards for 24h; extend canary if metrics degrade.
- Export Grafana PDF to `artifacts/observability/`.
- Update `CHANGELOG.md` and `docs/rfc-001-repo-refactor.md` with release notes.
- Conduct retro if any SLO breach occurs.

---

For questions, see `docs/observability.md` and `docs/runbooks/zero-downtime-migration.md`.

