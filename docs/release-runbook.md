# Release Runbook - ICUPA Platform

**Version:** 1.1
**Last Updated:** 2025-11-01
**Owner:** Operations/SRE Team

---

## Overview

This runbook documents the standard operating procedures for deploying ICUPA to staging and production environments. It covers build validation, phased rollouts, zero-downtime migrations, monitoring, rollback procedures, and on-call handoff.

---

## Release Checklist

### Pre-Release (1 Week Before)
- [ ] Review and triage all S0/S1 issues
- [ ] Verify all critical tests pass (unit, integration, Playwright)
- [ ] Update `CHANGELOG.md` with release notes
- [ ] Tag release in Git: `vX.Y.Z`
- [ ] Generate SBOM artifacts
- [ ] Run security scans (CodeQL, dependency audit)
- [ ] Review Lighthouse & performance metrics on staging
- [ ] Notify stakeholders of release window and rollout plan

### Release Day
- [ ] Confirm CI pipelines green (`pnpm turbo run lint typecheck test build`)
- [ ] Confirm coverage ≥ 80% and artifacts archived
- [ ] Confirm Lighthouse thresholds met and archived
- [ ] Deploy to staging (schema, functions, agents, web)
- [ ] Run smoke tests + Playwright on staging
- [ ] Execute zero-downtime migration playbook
- [ ] Enable feature flags for canary tenants
- [ ] Monitor metrics for 12h, then expand rollout per plan
- [ ] Get approval from Product/Engineering leads before prod promotion

### Post-Release
- [ ] Monitor alerts for 24 hours (SLO dashboards)
- [ ] Archive Grafana/Lighthouse/coverage artifacts
- [ ] Update documentation & RFCs with outcomes
- [ ] Record rollout & any incidents in `docs/runbooks/rollback-log.md`
- [ ] Schedule retro if issues occurred

---

## Build & Test Pipeline

### 1. Local Validation (Developer)

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter web build
pnpm --filter agents-service test
```

Optional: `pnpm test:e2e` for full Playwright run.

### 2. CI Validation (Automated)

CI runs on all PRs and commits to `main`:
- **Lint:** ESLint with max-warnings=0
- **Type Check:** TypeScript compilation
- **Build:** Production bundle with staging env vars
- **Tests:** Vitest unit tests + agents-service suite
- **Coverage:** Minimum 80%, artifacts stored under `artifacts/coverage/`
- **Secret Scan:** Gitleaks & GitHub secret scanning
- **SBOM:** CycloneDX/SPDX artifacts attached to workflow run
- **Lighthouse:** `performance.yml` workflow asserts thresholds

### 3. Security Validation

```bash
pnpm audit
pnpm audit --audit-level=high
pnpm security:lint-mcp
```

Ensure all Dependabot alerts triaged before release.

---

## Deployment Procedures

### Architecture Components

1. **Web PWA** - Static bundle deployed to Vercel
2. **Agents Service** - Containerized Fastify service (Kubernetes/Cloud Run)
3. **Supabase Edge Functions** - Deno runtime
4. **Database Migrations** - Supabase Postgres
5. **Infra Automation** - Terraform modules for secrets, observability

### Staging Deployment

#### A. Deploy Database Migrations

```bash
supabase link --project-ref <staging-ref>
supabase db push
supabase db test
supabase db remote commit --file supabase/seed/backfill_tenant_profiles.sql
```

Document outputs in release ticket and confirm `tenant_migration_audit` counts.

#### B. Deploy Edge Functions

```bash
./scripts/supabase/deploy-functions.sh --project <staging-ref>
```

Verify logs and smoke endpoints using `./scripts/smoke/functions-smoke.sh`.

#### C. Deploy Agents Service

```bash
cd agents-service
pnpm build
docker build -t icupa-agents:<sha> .
docker push <registry>/icupa-agents:<sha>
kubectl apply -f deployments/staging/agents-service.yaml
```

Run `pnpm --filter agents-service test:smoke` and check Grafana dashboard.

#### D. Deploy Web PWA

```bash
pnpm --filter web build
vercel deploy --prebuilt --env=staging
```

Validate environment variables and run Playwright smoke suite.

### Production Deployment

**Prerequisites:** staging sign-off, canary metrics stable ≥12h, approvals logged in release issue.

1. **Database Migrations & Backfill**
   ```bash
   supabase link --project-ref <prod-ref>
   supabase db push
   supabase db remote commit --file supabase/seed/backfill_tenant_profiles.sql
   ```
2. **Edge Functions**
   ```bash
   ./scripts/supabase/deploy-functions.sh --project <prod-ref> --verify-jwt
   ```
3. **Agents Service**
   ```bash
   docker push <registry>/icupa-agents:<sha>
   kubectl apply -f deployments/prod/agents-service.yaml
   ```
4. **Web PWA**
   ```bash
   vercel promote <deployment-url>
   ```
5. **Final Checks**
   - Run `pnpm test:e2e -- --grep "smoke"`
   - Run Lighthouse synthetic test
   - Verify dashboards and alert channels healthy

### Phased Rollout & Feature Flags

- Manage feature flags via admin console or CLI commands (`pnpm flags:enable ...`).
- Rollout order: internal tenants → pilot tenants → low-volume GA → full GA.
- Record each flag change in release ticket and rollback log with timestamp/owner.

### Canary Monitoring

- Dashboard: `ICUPA/rollout`
- Metrics: error rate, latency, AI guardrail breaches, payments success
- Alert thresholds: error rate >1%, latency >350ms P95, guardrail breaches >0.1% interactions
- Maintain `artifacts/observability/` snapshot after each rollout phase

---

## Rollback Procedures

1. Disable feature flags (CLI/admin console).
2. Redeploy previous container/image (use last successful digest).
3. Apply Supabase rollback migration if schema change caused issue (paired `_rollback.sql`).
4. Run smoke tests + Lighthouse; ensure metrics recover.
5. Update `docs/runbooks/rollback-log.md` and incident ticket.

---

## On-Call & Communication

- On-call engineer owns release window and monitors dashboards.
- Use `#release` for updates, `#status` for customer-facing notices.
- Handoff notes stored in `docs/runbooks/rollback-log.md` and release ticket.

---

## Appendices

- Detailed migration steps: `docs/runbooks/zero-downtime-migration.md`
- Tenancy policy reference: `docs/tenancy.md`
- Audit inventory: `docs/audit-inventory.md`
- Prior RFC context: `docs/rfc-001-repo-refactor.md`

