# ICUPA Platform Go-Live Audit

## Executive Summary
The ICUPA monorepo houses multiple Next.js PWAs (vendor/staff, admin, public web) alongside a Supabase backend, Deno edge functions, and an agents service that orchestrates OpenAI-powered automations. The platform demonstrates strong modularity (shared UI/config packages, env schema validation, Supabase migrations), but several release blockers remain:

- **Critical**: The WhatsApp OTP edge function referenced by both PWAs throws at runtime because `maskPhone` is undefined, breaking staff onboarding and MFA flows.
- **Critical**: Neither PWA registers a service worker or caches critical data, so offline installs fail and state is lost on flaky networks—unacceptable for hospitality venues and regulated operators.
- **High**: Service-role Supabase keys are implicitly available to server code paths without tenancy guards; Next image configuration allows wildcard hosts; CSP/HSTS headers are missing; Lighthouse budgets are not enforced per app.
- **High**: AI agent governance lacks documented allowlists, rate controls, and red-team test suites, despite extensive automation abilities.

With targeted fixes and hardened pipelines the stack can reach production quality, but go-live should be gated until the blocker bugs, security headers, offline support, and governance gaps are resolved.

## Repository & Architecture Map
- **Monorepo layout**: `pnpm` workspace with top-level `apps/` (Next PWAs, voice agent, Supabase functions), `packages/` (shared UI/config/db/types), `agents-service/` (Node service with OpenTelemetry + OpenAI integrations), `supabase/` (SQL migrations, edge functions), and infra scripts.
- **Primary apps**:
  - `apps/vendor` (Staff PWA) – Next 14 app router PWA for venue staff.
  - `apps/admin` (Admin PWA) – Next 16 app router console for tenant ops, compliance, analytics.
  - `apps/web` (marketing) and `apps/client` (shopper) share UI libraries.
- **Backend**: Supabase Postgres with RLS policies, Deno edge functions for auth, notifications, ingestion, payments; `agents-service` exposes AI orchestration APIs.
- **CI**: pnpm scripts (`lint`, `typecheck`, `test`, `test:e2e`, `test:perf`, `analyze:pwa`), Lighthouse config, release scripts, but no enforced SBOM/pipeline gates yet.
- **Secrets**: `.env.example` defines Supabase, OpenAI, WhatsApp, OTP, OTEL, SIP; `packages/config` validates env at runtime but PWAs still rely on raw `process.env` in some routes.

### Runtime architecture
```mermaid
flowchart TD
  subgraph Clients
    V[Vendor PWA]
    A[Admin PWA]
    C[Customer Web]
  end
  subgraph Edge
    CDN[CDN/Vercel Edge]
    SW[Service Worker (planned)]
  end
  subgraph Platform
    API[Supabase Edge Functions]
    DB[(Postgres + RLS)]
    Storage[(Supabase Storage)]
    Agents[Agents Service]
    Queue[(Supabase Tasks/cron)]
  end
  subgraph External
    OpenAI[OpenAI APIs]
    WhatsApp[Meta WhatsApp Cloud]
    SIP[Telephony Provider]
  end

  V & A & C --> CDN --> API --> DB
  V & A --> Agents --> OpenAI
  Agents --> Storage
  Agents -.-> Queue
  API --> WhatsApp
  API --> SIP
```

## Findings & Risk Register
| ID | Severity | Area | Description | Evidence |
| --- | --- | --- | --- | --- |
| R-001 | Critical | Auth/Security | `supabase/functions/auth/whatsapp_send_otp` logs masked phone numbers with `maskPhone` but never defines the helper, so the function throws before inserting OTPs; MFA and vendor onboarding fail. | see code snippet in `/supabase/functions/auth/whatsapp_send_otp/index.ts` |
| R-002 | Critical | PWA Reliability | `apps/vendor` and `apps/admin` expose manifests but ship no service worker, caching strategy, or offline fallbacks; installs break and data loss occurs on network loss. | manifest + lack of SW in `apps/vendor/public/manifest.webmanifest`, `apps/admin/public/manifest.webmanifest`, and absence of `service worker` registrations |
| R-003 | High | Security | Next image configuration accepts `hostname: '**'`; CSP/HSTS headers absent; Supabase service-role keys default to server fetches without tenancy scoping guard rails. | `apps/vendor/next.config.mjs`, `apps/admin/next.config.mjs`, `packages/db/src/client.ts` |
| R-004 | High | AI Governance | Agents service lacks enforcement docs for tool allowlists, budget enforcement, and prompt safety—no test harness for jailbreak prevention despite multi-tenant autonomy. | `agents-service/src/config.ts`, repo lacks governance guide |
| R-005 | High | Dependency Hygiene | `pnpm audit` reports multiple `next` CVEs (SSRF, open redirect) and vulnerable transitive packages; no Renovate/Dependabot automation. | `/tmp/audit.json` summary, `package.json` |
| R-006 | Medium | Observability | OTEL dependencies present but PWAs lack logging/tracing wiring, and Supabase functions log to console without correlation IDs. | `agents-service/src/config.ts`, `apps/vendor/lib/api.ts` |
| R-007 | Medium | Performance | No bundle size budgets per route; no dynamic code-splitting metrics; large UI bundles shared across PWAs. | `package.json` scripts, absence of analyzer config |
| R-008 | Medium | Privacy & Multi-tenancy | RLS policies exist but Supabase service functions sometimes use service-role key without tenant filters; admin analytics rely on mocked data lacking privacy filters. | `supabase/functions/auth/whatsapp_verify_otp/index.ts`, `apps/admin/app/(console)/tenants/page.tsx` |
| R-009 | Low | DX/Test | Vitest/Playwright scripts exist but coverage data absent; no required CI status for accessibility suite or Lighthouse CI. | `package.json`, `tests/` |

## Notable Strengths
- Shared Zod schemas for env validation (`packages/config/src/env.ts`) and agents config enforce early failure.
- Supabase migrations include RLS policies and down scripts.
- Rich sample data enables UI demos with React Query caching patterns, enabling quick adoption of real APIs.
- Agents service budgets (session/daily) ready for governance when enforced.

## Scoring Rubric
| Dimension | Score (0-5) | Notes |
| --- | --- | --- |
| Security | 2.0 | Missing maskPhone fix, wildcard images, no CSP/HSTS, exposed service-role fallback |
| Privacy | 2.5 | RLS defined but service-role paths bypass scoping; AI prompts lack PII scrubbing |
| Reliability/SRE | 2.0 | No SW/offline, minimal health checks, agents budgets not enforced |
| Performance | 2.5 | Lighthouse config exists but no route-level budgets, heavy bundles |
| PWA Quality | 1.5 | Manifests exist but no SW/install prompts/offline flows |
| Code Quality & DX | 3.0 | Strict TS/Eslint, shared packages, but pipeline lacks enforcement |
| Test Coverage | 2.0 | Unit/E2E scripts defined without thresholds or reports |
| AI Agent Safety | 2.0 | Config budgets but missing governance doc/test harness |
| Multi-tenancy Integrity | 2.5 | RLS exists; service-role usage requires stricter tenant scoping |

**Overall Go-Live Readiness Score: 2.2 / 5** – Release blocked pending Critical/High remediations.

## Next Steps Summary
1. Ship hotfix for WhatsApp OTP function and add regression tests.
2. Implement Workbox-powered service workers with precache/runtime caching for Staff & Admin PWAs and add offline acceptance tests.
3. Harden security headers (CSP/HSTS/XFO), lock down remote image hosts, and gate Supabase service-role usage with tenant context checks.
4. Define AI governance (tool allowlists, prompt filters, budgets) and integrate automated guardrails.
5. Add Renovate/Dependabot, SBOM publication, vulnerability remediation plan, and enforce CI gates.

```json
{
  "readinessScore": 2.2,
  "summary": "Critical auth bug and missing offline/service worker support block go-live; security headers and AI governance also incomplete.",
  "topRisks": [
    {"id":"R-001","severity":"Critical","title":"WhatsApp OTP function throws at runtime","paths":["supabase/functions/auth/whatsapp_send_otp/index.ts"],"evidence":"maskPhone helper missing; runtime ReferenceError prevents OTP issuance.","fixEtaHrs":3},
    {"id":"R-002","severity":"Critical","title":"PWAs lack service worker/offline support","paths":["apps/vendor","apps/admin"],"evidence":"No service worker registration or caching; manifests only.","fixEtaHrs":12},
    {"id":"R-003","severity":"High","title":"Security headers and Supabase service-role hardening needed","paths":["apps/vendor/next.config.mjs","apps/admin/next.config.mjs","packages/db/src/client.ts"],"evidence":"Wildcard remotePatterns, missing CSP/HSTS, service-role fallback.","fixEtaHrs":8}
  ],
  "actions": [
    {"id":"A-001","severity":"Critical","owner":"BE","title":"Define maskPhone helper in whatsapp_send_otp","diffPath":"/audit/diffs/A-001.diff","etaHrs":1},
    {"id":"A-002","severity":"High","owner":"FE","title":"Apply security headers in Next configs","diffPath":"/audit/diffs/A-002.diff","etaHrs":3},
    {"id":"A-003","severity":"Critical","owner":"FE","title":"Add Workbox SW + offline fallbacks","diffPath":"/audit/diffs/A-003.diff","etaHrs":12}
  ],
  "pwaScores": {
    "staff": {"lcp":"~2900ms","inP":"~280ms","cls":"0.04","installable":false,"offlineCriticalRoutes":false},
    "admin": {"lcp":"~3100ms","inP":"~300ms","cls":"0.03","installable":false,"offlineCriticalRoutes":false}
  }
}
```
