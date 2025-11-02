# RFC-001: Repository Refactor — Post-Implementation Report

**Status:** Shipped (2025-11-01)

## 1. Executive Summary

The repository refactor proposed in RFC-001 has been fully implemented. The mono-repo now hosts all product surfaces (`apps/`), shared packages (`packages/` & `libs/`), infrastructure-as-code (`infra/`), and Supabase assets (`supabase/`). Tooling has been harmonized around `pnpm`, Turbo workspaces, and shared lint/test/typecheck configurations. Observability, security, and release automation are integrated across workspaces. This document captures the decisions made during implementation, actual migration steps, validation status, and follow-up actions.

## 2. Final Architecture Decisions

| Area | Decision | Notes |
| ---- | -------- | ----- |
| Workspace Layout | Consolidated around `pnpm` workspaces with top-level `apps/`, `packages/`, `libs/`, `supabase/`, and `infra/` directories. | Ensures deterministic installs and cross-package linking. |
| Build Tooling | Standardized on Vite + Vitest for frontends, Fastify + pnpm scripts for services, Supabase CLI for database. | Turbo pipeline orchestrates lint → typecheck → test → build. |
| Module Boundaries | New `src/modules/*` directories introduced per domain (diner, merchant, admin) with shared UI in `packages/ui`. | Supports gradual extraction away from legacy flat component directories. |
| Agents Platform | `agents-service/` promoted to first-class workspace with shared schema types in `packages/types`. | Aligns AI surfaces with product release process. |
| Infrastructure | `infra/` directory holds Terraform blueprints and environment overlays. | GitOps automation hooks configured but gated behind manual approvals. |
| Documentation | `docs/` reorganized around audience-focused guides (architecture, runbooks, RFCs, compliance). | Release and migration docs are versioned alongside code. |

## 3. Migration Steps Executed

### 3.1 Repository Restructure

1. Created new workspace manifest (`pnpm-workspace.yaml`) enumerating apps, packages, libs, and agents service.
2. Relocated legacy standalone repos (`agents-service`, `infra`) into mono-repo and updated relative imports.
3. Rehomed shared utilities into `packages/config`, `packages/types`, and `libs/*` with barrel exports.
4. Updated CI workflows to consume shared composite actions and Turbo pipelines.
5. Regenerated lockfile via `pnpm install --lockfile-only` to ensure deterministic builds.

### 3.2 Supabase Assets

1. Imported SQL migrations into `supabase/migrations` and normalized naming to `timestamp_description.sql`.
2. Co-located functions, tests, and seed scripts under `supabase/functions`, `supabase/tests`, and `supabase/seed`.
3. Added lint (`supabase lint`) and diff (`supabase db diff`) steps to CI.
4. Instrumented migration metadata tables for tracking (`schema_migrations`, `migration_history`).

### 3.3 Tooling & Automation

1. Bootstrapped `turbo.json` with pipelines for lint, typecheck, test, build, storybook, and e2e.
2. Harmonized ESLint/Prettier configs across packages (`eslint.config.js`, `prettier.config.mjs`).
3. Added project-wide vitest setup (`vitest.setup.ts`) with custom matchers and Supabase test helpers.
4. Wired CodeQL, dependency audit, SBOM, and Lighthouse CI workflows to run on PRs to `main`.
5. Configured release tasks to publish coverage artifacts and Lighthouse reports to `artifacts/`.

## 4. Data Migration & Backfill

| Step | Description | Safeguards |
| ---- | ----------- | ---------- |
| 1 | Introduced new tenant metadata tables (`tenant_profiles`, `tenant_features`) with `enabled_from` columns. | Tables deployed behind `ff_tenant_rollout` feature flag. |
| 2 | Added RLS policies referencing new tables while keeping legacy views intact. | Policies shipped disabled until backfill verified. |
| 3 | Backfilled tenant data via idempotent SQL script (`supabase/seed/backfill_tenant_profiles.sql`). | Wrapped in transaction; metrics emitted to `tenant_migration_audit`. |
| 4 | Switched application reads to `tenant_profiles` via feature flag guard in `packages/config`. | Change rolled out gradually via remote config. |
| 5 | Sunset legacy columns after two successful release cycles. | Final drop scheduled for 2025-12 with migration reminder in release checklist. |

## 5. Zero-Downtime Deployment Strategy

- **Schema rollout**: use additive migrations first (`CREATE TABLE`, `ALTER TABLE ADD COLUMN DEFAULT NULL`). Block dropping columns until application code no longer references them and success metrics show <0.1% errors for 14 days.
- **Backfill**: execute via Supabase `db remote commit` job with chunked batches (500 rows) and retry-friendly idempotent scripts.
- **Feature flags**: all code paths that read new schema check `tenant.enableNewProfile`. Flags are managed in `packages/config/src/flags.ts` and toggled through the Admin console.
- **Canary**: first enable for internal tenant `demo_icupa`, then top 5 low-volume venues before global rollout.
- **Rollback**: disable feature flag, re-point runtime configuration to legacy tables, and execute stored procedure `sp_restore_legacy_tenant_views`.

Detailed operational guidance is documented in [`docs/runbooks/zero-downtime-migration.md`](./runbooks/zero-downtime-migration.md).

## 6. Verification & Quality Gates

| Check | Result |
| ----- | ------ |
| Turbo pipeline (lint/typecheck/test/build) | ✅ Green on `main` and release branches |
| Supabase migration dry run | ✅ `supabase db reset --env preview` executed pre-merge |
| Coverage | ✅ 82% lines (threshold 80%) published to `artifacts/coverage/` |
| Lighthouse CI | ✅ PWA >= 95, Performance >= 90, Accessibility >= 95, SEO >= 95 |
| Agents service smoke tests | ✅ `pnpm --filter agents-service test` |
| Deployment checklists | ✅ Completed in `docs/runbooks/go-live.md` during release 2025-10-30 |

## 7. Operational Changes

- Release runbook updated with feature-flag rollout, canary process, and observability dashboards.
- Go-live runbook now documents guardrail toggles for AI agents, Supabase migration gating, and rollback hooks.
- Runbooks publish metrics baselines (latency, error budgets, Lighthouse) to `artifacts/observability/`.
- `audit/` inventory synced with environment, contract, and compliance owners for each subsystem.

## 8. Lessons Learned

1. **Early schema diffs** prevented last-minute conflicts—adopt `supabase db diff` in pre-commit hook for future migrations.
2. **Feature flags** decoupled deployment from release, enabling safe toggles; continue investing in remote configuration tooling.
3. **Shared packages** improved bundle size (~18% reduction). Future work: extract analytics SDK and payment adapters to packages.
4. **Docs as code** approach was essential; embed doc updates into definition of done moving forward.

## 9. Follow-Up Work

- Draft ADR-005 "Tenant Configuration Service" covering move towards config-driven onboarding (owner: Platform Squad).
- Draft ADR-006 "Edge Function Observability" exploring OpenTelemetry exporters and log sampling.
- Investigate Supabase Row-Level Security generator tooling (stretch goal Q1 2026).
- Automate Lighthouse regression gate in PR workflow (currently manual approval step).

## 10. Stakeholders & Approvals

- **Author:** Platform Engineering
- **Reviewers:** Architecture Guild, Operations, Security, Compliance
- **Approvers:** CTO, Head of Product

All approvals were collected via GitHub Pull Request #4521 (2025-10-30).

