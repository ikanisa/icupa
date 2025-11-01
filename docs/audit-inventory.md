# Repository Audit & Inventory

_Last updated: 2025-02-14_

## Monorepo Overview
- **Package manager:** pnpm (workspaces defined in `package.json` and `pnpm-workspace.yaml`).
- **Node requirement:** `>=18.18.0` (no `.nvmrc` currently enforced).
- **Type system:** TypeScript across PWAs and shared packages, but multiple `tsconfig` variants and non-strict settings observed.
- **CI tooling:** Ad hoc scripts in `scripts/` with Supabase utilities; limited GitHub Actions coverage (needs consolidation).
- **Runtime services:** Supabase (auth/postgres/storage) via CLI; external integrations with OpenAI, WhatsApp, and various ingestion agents.

## Workspace Inventory

### Applications (`apps/`)
| Name | Type | Tech Stack | Purpose | Notes |
| ---- | ---- | ---------- | ------- | ----- |
| `admin` | Next.js PWA | React 19, Tailwind v4 beta | Internal admin console | Uses shared `@icupa/ui`, `@icupa/db`. Missing PWA manifest/service worker. |
| `client` | Next.js PWA | React 19, Tailwind v4 beta | Customer-facing marketplace | Similar gaps as `admin`; relies on Supabase for auth/data. |
| `web` | Next.js PWA | React 19, Tailwind v4 beta | Marketing/public web | Shares UI kit; lacks production PWA hardening. |
| `vendor` | Next.js PWA | React 19, Tailwind v4 beta | Supplier portal | Similar structure; lacks type strictness. |
| `voice-agent` | Next.js hybrid | React 19 + custom agent tooling | Voice-enabled assistant | Integrates with `packages/agents`; observability limited. |
| `ecotrips` | Expo/React Native (to verify) | Mixed tooling | Travel vertical app | Guarded by `apps/ecotrips/AGENTS.md`; Supabase references. |
| `ocr-converter` | Node utility | Express-esque server | OCR conversion utility | Plain JS server (`server.mjs`), minimal typing/tests. |
| `supabase` | SQL/migrations | Supabase CLI | Database schema & seeds | Contains SQL migrations but lacks automation scripts. |
| `api` | Edge/handler modules | TypeScript | Lightweight API adapters | No cohesive framework; modules per integration (OpenAI, WhatsApp). |

### Services / Standalone Packages
- `agents-service/`: Node service orchestrating AI agents; Supabase-backed; lacks unified lint/test/tooling.

### Shared Packages (`packages/`)
| Package | Description | Observations |
| ------- | ----------- | ------------ |
| `@icupa/ui` | Component library + Tailwind styles | No Storybook; limited testing; lacks accessibility linting. |
| `@icupa/config` | Environment & shared config utilities | Contains Zod schemas but env loading scattered. |
| `@icupa/db` | Supabase client abstractions | Tight coupling to Supabase; no provider interface. |
| `@icupa/types` | Shared domain/types | Mostly Zod schemas; needs stricter domain modeling and documentation. |
| `@icupa/ingestion-utils` | ETL helpers | Pure TS modules; lacks validation coverage and typed exports alignment. |

### Legacy Libraries (`libs/`, `lib/`, `src/`)
- `libs/` and `lib/` host legacy helpers; require consolidation into formal `packages/` modules.
- Root `src/` contains Vite-based SPA shell retained for backward compatibility; duplicates functionality from Next.js apps.

## Tooling & Scripts
- `scripts/ci/*`: Supabase env validation/reset, smoke tests, release checklists.
- `scripts/dev/dev-all.sh`: Boots multiple dev servers; assumes Supabase local stack.
- `scripts/security/lint-mcp-tools.mjs`: Custom linting for MCP tool definitions.
- `tests/`: Vitest + Playwright; coverage not enforced; `tests/accessibility` leverages `vitest-axe`.
- `lighthouserc.json`: Lighthouse CI config present but not wired into automated pipeline.

## Configuration Assets
- Multiple `tsconfig*.json` files: `tsconfig.base.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`; inconsistent `strict` flags.
- ESLint configured via root `eslint.config.js` (flat config) with per-app overrides (`apps/*/eslint.config.mjs`).
- Tailwind configs per app despite presence of shared preset (`packages/config/tailwind-preset.ts`).

## Environment & Secrets
- Environment sampling handled ad hoc (`apps/*/env.server.ts`, `supabase/.env`); no centralized `.env.example` enumerating required variables.
- Supabase project reference `woyknezboamabahknmjr` documented only in agent guide; missing from setup docs.

## Observed Gaps & Risks
1. **Architecture Drift:** Multiple app frameworks without shared routing/auth/security patterns.
2. **Quality Gates:** Lint enforced manually; TypeScript strict mode disabled; coverage thresholds absent; CI pipeline incomplete.
3. **PWA Compliance:** No manifests/service workers/offline strategies across PWAs.
4. **Security Baseline:** Lacks rate limiting, secure headers, and audit logging across API services.
5. **Infrastructure:** Docker assets outdated; no unified Docker Compose; Kubernetes manifests inconsistent.
6. **Documentation:** Fragmented docs; onboarding, SLOs, deprecations, and migration guides missing.
7. **Dependency Hygiene:** React 19 beta & Tailwind v4 prerelease increase risk; no automated dependency updates.
8. **Testing & Observability:** Limited telemetry instrumentation; coverage not tracked; absence of OpenTelemetry and structured logging.

## Recommended Next Steps (High-Level)
- Establish hardened repo layout (`apps/`, `packages/`, `infrastructure/`) with shared configs centralized in `packages/config`.
- Publish root `.env.example` and dedicated environment docs.
- Enable strict TypeScript, standardized ESLint/Prettier configs, and Turborepo task orchestration.
- Scaffold PWA assets (manifest, service worker, offline fallbacks) for each React PWA.
- Formalize `apps/api` as modular Fastify/NestJS service with generated OpenAPI spec and versioned endpoints.
- Introduce CI workflows for lint/type/test/audit, Lighthouse, and bundle-size budgets.
- Expand documentation suite: onboarding, SLOs, security, deprecations, migration strategy, backup/DR.
