# Remediation Plan

| Priority | ID | Owner | Effort (hrs) | Dependencies | Summary |
| --- | --- | --- | --- | --- | --- |
| P0 | R-001 | BE | 3 | None | Patch WhatsApp OTP function with `maskPhone`, add regression tests, redeploy edge function. |
| P0 | R-002 | FE | 12 | R-003 | Implement Workbox SW + offline fallbacks for Staff/Admin PWAs; gate install prompts behind stability checks. |
| P0 | R-003 | FE/Sec | 8 | A-001 | Apply CSP/HSTS headers, restrict Next image hosts, enforce Supabase service-role scoping. |
| P1 | R-004 | Sec/ML | 10 | R-003 | Define AI governance policies, tool allowlists, budget enforcement, and red-team test suite. |
| P1 | R-005 | DevOps | 6 | SBOM | Patch `next` CVEs, add Renovate/Dependabot, enforce dependency scan gate. |
| P1 | R-006 | SRE | 8 | Observability | Wire OTEL tracing/logging, add correlation IDs, centralize Supabase function logging. |
| P1 | R-007 | FE | 6 | Build tooling | Add bundle analyzer CI step, set route budgets, implement code-splitting plan. |
| P2 | R-008 | BE | 10 | R-003 | Audit Supabase service-role calls for tenant scoping, add row-level filters and tests. |
| P2 | R-009 | QA | 5 | Tooling | Publish coverage reports, enforce accessibility & Lighthouse CI on pipelines. |

## Milestones
1. **Hotfix (24h)** – Fix OTP function, add CSP headers, publish emergency redeploy.
2. **PWA Reliability (Week 1)** – Implement service workers, offline caches, fallback routes; add Playwright offline tests.
3. **Security & Governance (Week 2)** – Harden Supabase usage, document AI guardrails, add Renovate + dependency gates.
4. **SRE & Observability (Week 3)** – OTEL instrumentation, health checks, alerting, error budgets.
5. **Performance & Domain Readiness (Week 4)** – Bundle budgets, domain compliance checks, finalize go-live checklist.

## Owners
- **Frontend**: Offline readiness, CSP headers, bundle budgets.
- **Backend**: Supabase policy hardening, OTP fixes, tenancy enforcement.
- **Security/ML**: AI governance, prompt safety suite, content policy alignment.
- **DevOps/SRE**: CI/CD hardening, observability rollout, dependency automation.
- **Product/Compliance**: Domain-specific readiness sign-off (pharmacy, tourism, automotive, etc.).
