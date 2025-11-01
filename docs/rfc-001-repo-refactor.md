# RFC-001: Repository Refactor for Production Readiness

- **Status:** Draft
- **Author:** AI Assistant (Senior Principal Engineer)
- **Date:** 2025-02-14
- **Reviewers:** TBA (Staff platform lead, Backend lead, Frontend lead, DevOps lead)

## 1. Problem Statement
The marketplace monorepo has grown organically, resulting in duplicated frameworks, inconsistent tooling, and fragile infrastructure. Without a cohesive architecture and quality gates, we risk regressions, slow onboarding, security vulnerabilities, and unreliable deployments (including Vercel production releases).

## 2. Goals & Non-Goals
### Goals
1. Establish a clean, maintainable monorepo layout with clear app/package boundaries.
2. Enforce quality: TypeScript `strict`, ESLint/Prettier consistency, ≥80% unit coverage, Lighthouse ≥95 PWA score for staff/admin shells.
3. Harden backend services with modular domains, OpenAPI contracts, observability, and rate limiting.
4. Deliver production-grade PWA features (manifests, Workbox service workers, offline fallbacks).
5. Provide CI/CD pipelines that gate merges (lint/type/test/audit/lighthouse/bundle-size) and deploy to Vercel/Main automatically after review.
6. Document architecture decisions, onboarding, migration paths, deprecation strategy, and SLOs.

### Non-Goals
- Redesigning product UX or business workflows.
- Migrating off Supabase or replacing major third-party integrations.
- Completing data backfills beyond those required for schema alignment.

## 3. Current State Summary
Refer to [`docs/audit-inventory.md`](./audit-inventory.md) for full inventory.
Key pain points:
- Mixed frameworks (Vite SPA + multiple Next.js apps) without shared routing/auth patterns.
- `apps/api/` is a loose collection of handlers with no consistent domain modeling or transport contract.
- Missing `.env.example`, `.nvmrc`, and standardized scripts; pnpm workspaces not optimized via Turborepo.
- No manifests/service workers for PWAs; no offline support or caching strategy.
- CI limited to manual scripts; no GitHub Actions for lint/type/test/perf/audit.
- Security posture lacking (no rate limiting, CSP, audit logs).
- Observability limited to console logs; no OpenTelemetry or structured logging.

## 4. Proposed Architecture
### 4.1 Monorepo Layout
```
/
├─ apps/
│  ├─ staff-pwa/          (rename from `apps/admin`)
│  ├─ admin-pwa/          (rename from `apps/vendor` with role-specific routing)
│  ├─ marketplace-pwa/    (rename from `apps/client`)
│  ├─ marketing-site/     (rename from `apps/web`)
│  ├─ voice-assistant/    (refactor from `apps/voice-agent`)
│  ├─ api/                (new NestJS/Fastify service)
│  ├─ ocr-converter/      (typed Fastify worker)
│  └─ mobile-ecotrips/    (isolate Expo app, preserving agent guardrails)
├─ packages/
│  ├─ config/             (eslint/tsconfig/prettier shared presets)
│  ├─ ui/                 (design system + Storybook + visual regression tests)
│  ├─ domain/             (Zod schemas, domain events, DTOs)
│  ├─ data-access/        (API SDK, TanStack Query hooks)
│  ├─ workers/            (BullMQ queues, OCR pipelines)
│  ├─ agents/             (provider-agnostic agent runtime)
│  └─ testing/            (shared test utilities, Playwright fixtures)
├─ infrastructure/
│  ├─ docker/
│  │  ├─ api.Dockerfile
│  │  ├─ pwa.Dockerfile (multi-stage for Next/Vite builds)
│  │  └─ docker-compose.dev.yml
│  ├─ k8s/
│  │  ├─ base/ (Helm charts or Kustomize)
│  │  └─ overlays/{dev,staging,prod}/
│  └─ terraform/ (optional, AWS/GCP resources)
├─ scripts/
│  ├─ bootstrap.mjs
│  ├─ verify.mjs
│  ├─ migrate.mjs
│  └─ smoke.mjs
├─ docs/
│  ├─ operations/
│  │  ├─ slo.md
│  │  ├─ incident-response.md
│  │  └─ backup-dr.md
│  ├─ deprecations.md
│  ├─ onboarding.md
│  └─ rfc-001-repo-refactor.md
└─ .github/workflows/
   ├─ ci.yml
   ├─ release.yml
   ├─ security.yml
   └─ e2e.yml
```

### 4.2 Backend Architecture
- Adopt Fastify with modular plugins per domain (`auth`, `tenants`, `listings`, `inventory`, `orders`, `bookings`, `payments`, `search`, `messaging`, `notifications`, `files`, `ai-agents`).
- Implement hexagonal architecture: domain services depend on ports (interfaces). Infrastructure adapters (Supabase Postgres, Redis, providers) implement ports.
- Generate OpenAPI via `@fastify/swagger` and publish to `apps/api/openapi.json` (committed artifact via CI).
- Security: rate limiting (`@fastify/rate-limit`), helmet-like headers, CORS allowlist, Zod validation per route, audit logging via Pino + Supabase storage.
- Observability: OpenTelemetry Node SDK with OTLP exporter; integrate with Honeycomb/Datadog (configurable via env).

### 4.3 Frontend Architecture
- Standardize Next.js 16 with `app/` router, React Server Components where possible, client components for interactive UI.
- Introduce shared layout primitives from `packages/ui`; enforce accessibility via ESLint rules and automated tests.
- TanStack Query with typed clients from `packages/data-access`; request/response schemas validated via `zod` and generated types from OpenAPI.
- PWA readiness: Workbox-based service worker, caching strategies (`StaleWhileRevalidate` for shell, `NetworkFirst` for authed routes, `CacheFirst` for assets). Provide offline fallback page and background sync for mutations.
- Performance budgets enforced via `next.config.mjs` + `lighthouse-ci` thresholds.

### 4.4 Agents & Workers
- `packages/agents`: Define `AgentRuntime`, `Task`, `ToolRegistry` interfaces. Provide adapters for OpenAI, Anthropic, etc. Ensure sandboxing and allowlists.
- `packages/workers`: Shared job orchestration (BullMQ + Redis). Outbox pattern for state transitions and webhook dispatch.
- `apps/api` integrates via port interfaces; `agents-service` either merges into `apps/api` workers or becomes `apps/workers/agents-runner`.

### 4.5 CI/CD & DevEx
- `turbo.json` orchestrates build/test/lint with caching.
- Root `package.json` scripts map to turbo pipelines (`pnpm turbo run lint --filter=...`).
- GitHub Actions: `ci.yml` (pnpm install, lint, typecheck, unit test, vitest coverage, Playwright smoke, Lighthouse, bundle-size). `release.yml` uses Changesets or semantic-release. `security.yml` runs `npm audit`, `trivy`, `codeql`. `e2e.yml` spins Docker Compose env and runs Playwright.
- Vercel deployment via GitHub integration triggered post-merge; environment variables validated by `scripts/verify-env.mjs`.

## 5. Migration Plan
1. **Stabilize Tooling (Sprint 1)**
   - Add `.nvmrc`, `.editorconfig`, `.env.example`.
   - Introduce `turbo.json`, shared `tsconfig`, `eslint`, `prettier` configs.
   - Configure pnpm workspace constraints.
2. **Backend Foundation (Sprint 2-3)**
   - Scaffold Fastify app under `apps/api` with modular folders.
   - Migrate existing handlers into domain modules; create Supabase adapters.
   - Add OpenAPI generation + CI artifact publishing.
   - Implement rate limiting, security headers, telemetry.
3. **Frontend PWA Hardening (Sprint 3-4)**
   - Rename/move apps to new structure; integrate shared config.
  - Add manifests, Workbox service workers, offline pages, background sync.
   - Refine data layer with typed clients; ensure TanStack Query usage.
   - Introduce Lighthouse CI gating.
4. **Agents & Workers Consolidation (Sprint 5)**
   - Move `agents-service` logic into `packages/agents` + `apps/api/modules/ai-agents`.
   - Implement tool allowlists, audit logging, vector store abstraction.
5. **Infrastructure & CI (Sprint 6)**
   - Update Dockerfiles (multi-stage) and `docker-compose.dev.yml` with Postgres, Redis, Meilisearch, Mailhog, Minio.
   - Add Kubernetes manifests/Helm charts, secret templates.
   - Finalize GitHub workflows, add Renovate config, update docs.
6. **Documentation & Quality Gates (Ongoing)**
   - Maintain `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`.
   - Author `docs/onboarding.md`, `docs/operations/slo.md`, `docs/deprecations.md`, `docs/tenancy.md`, `docs/backup-dr.md`.
   - Ensure CI enforces coverage and lint thresholds before merge.

### Data Migration & Zero Downtime Strategy
- Use Supabase migration scripts under `supabase/migrations` with sequential versions.
- Apply additive changes first (add nullable columns, backfill via scripts, swap to non-null with defaults).
- For disruptive changes, use feature flags + background workers for backfill.
- Provide rollback instructions in each migration (`down.sql` and runbook entries).

## 6. Risk Analysis
| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Framework upgrades (Next.js 16, React 19) unstable | High | Lock to stable release once GA; add canary environment; monitor release notes. |
| Supabase schema drift during migration | High | Introduce automated migration pipeline with preview DB; require reviews on SQL changes. |
| Increased CI runtime | Medium | Use Turbo cache and PNPM caching; parallelize workflows; run Lighthouse only on touched PWAs. |
| Team learning curve for new architecture | Medium | Provide workshops, docs, pairing sessions; incremental rollout per vertical. |
| Workbox service worker bugs affecting offline | Medium | Stage rollout behind feature flag; add E2E offline tests in Playwright. |

## 7. Open Questions
1. Do we consolidate all Next.js apps into a single multi-tenant app with role-based routing, or keep separate deployables?
2. Should `agents-service` remain separate for isolation or fold into API with background workers?
3. Preferred observability backend (Datadog vs. OpenTelemetry Collector + Grafana Tempo/Loki)?
4. Payment provider roadmap (Stripe vs. regional providers) to inform adapter prioritization.

## 8. Approvals & Next Steps
- Circulate RFC for feedback (product, engineering, ops).
- Once approved, create milestone board with epics per migration step.
- Begin implementation with Sprint 1 tasks (tooling stabilization), ensuring all PRs follow Conventional Commits and pass new CI gates.

