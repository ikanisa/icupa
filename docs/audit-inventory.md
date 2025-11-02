# Audit Inventory — ICUPA Platform

**Last Updated:** 2025-11-01

This inventory centralizes ownership and control evidence for the refactored repository. Use it to satisfy SOC2/ISO audits, vendor assessments, and internal control reviews.

## 1. Systems & Owners

| Subsystem | Code Location | Owner | Backup Owner | Notes |
| --------- | ------------- | ----- | ------------ | ----- |
| Diner PWA | `apps/web`, `src/modules/diner` | Web Platform Lead | Frontend Chapter | Multi-tenant React app served via Vercel. |
| Merchant Portal | `apps/web`, `src/modules/merchant` | Merchant PM | Merchant Engineering | Shares runtime with Diner; feature flags gate portal routes. |
| Admin Console | `apps/web`, `src/modules/admin` | Operations Lead | Support Engineering | Controls tenant lifecycle and feature flags. |
| Agents Service | `agents-service/` | AI Platform Lead | Data Science Lead | Fastify service orchestrating OpenAI tools. |
| Supabase Backend | `supabase/` | DBA (Platform Squad) | SRE | Includes schema, policies, edge functions, and tests. |
| Infrastructure-as-Code | `infra/` | SRE Lead | Platform Engineering | Terraform + GitHub Actions for cluster and secrets management. |
| Shared Packages | `packages/*`, `libs/*` | Architecture Guild | Frontend Chapter | Shared UI, config, types, analytics clients. |
| Observability | `infra/observability`, `artifacts/` | SRE Lead | Data Engineering | Dashboards, alert rules, Lighthouse & coverage artifacts. |

## 2. Controls & Evidence

| Control | Evidence | Frequency | Location |
| ------- | -------- | --------- | -------- |
| Code Ownership | CODEOWNERS enforced in CI | Continuous | `.github/CODEOWNERS` |
| Secure SDLC | Required checklists in PR template | Each PR | `.github/PULL_REQUEST_TEMPLATE.md` |
| CI Quality Gates | Lint, typecheck, test, build, coverage ≥80%, Lighthouse thresholds | Each push to PR/main | `.github/workflows/ci.yml`, `artifacts/coverage`, `artifacts/lighthouse` |
| Dependency Hygiene | Daily audit workflow | Daily | `.github/workflows/dependency-audit.yml` |
| SBOM Retention | CycloneDX/SPDX artifacts stored 90 days | Each release | `.github/workflows/sbom.yml`, `artifacts/sbom` |
| Security Scanning | CodeQL, secret scanning, container scan | On PR + scheduled | `.github/workflows/codeql.yml`, `.github/workflows/container-scan.yml` |
| Access Reviews | Tenancy policy review & Supabase role audit | Quarterly | `docs/tenancy.md`, `supabase/policies/` |
| Backup & DR | Supabase PITR configured; backup documented | Daily | `docs/runbooks/rollback-log.md`, Supabase dashboard |

## 3. Data Classification

| Classification | Description | Storage | Controls |
| -------------- | ----------- | ------- | -------- |
| Public | Marketing content, docs | Git repo, website | Review before publication |
| Internal | Runbooks, analytics without PII | Git repo, shared drives | Access limited to employees |
| Confidential | Tenant & diner data | Supabase Postgres | RLS, encrypted at rest, TLS |
| Restricted | Payment tokens, OAuth secrets | Supabase Vault, cloud secret stores | Access logging, rotation every 90 days |

## 4. Change Management

- All production-impacting changes require approval from code owners and passing CI.
- Feature flags in `packages/config` capture rollout state and are logged to `tenant_feature_audit`.
- Canary deployments monitored via Grafana dashboard `ICUPA/rollout` with latency, error rate, and AI guardrail breach metrics.
- Release retro notes appended to `docs/runbooks/rollback-log.md`.

## 5. Compliance Calendar

| Task | Owner | Cadence | Artifact |
| ---- | ----- | ------- | -------- |
| Access review (Supabase roles) | Operations | Quarterly | `docs/tenancy.md` appendix |
| Dependency audit triage | Platform Eng | Weekly | GitHub Issues tagged `security` |
| Incident response drill | SRE | Quarterly | `docs/runbooks/chaos-drill.md` updates |
| BCP tabletop | Leadership | Semi-annual | Confluence memo, linked from `docs/security/` |
| Policy review (Security & Privacy) | Security Team | Annual | `SECURITY.md`, `docs/compliance/privacy.md` |

## 6. Open Items

- Automate export of Grafana dashboards to `artifacts/observability/` (target Q1 2026).
- Complete vendor risk assessment checklist for OpenAI integration.
- Link SOC2 evidence folder into this inventory once audit binder is finalized.

