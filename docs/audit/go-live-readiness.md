# ICUPA Go-Live Readiness Audit

This report captures the current production readiness of the ICUPA monorepo, highlights blocking gaps, and proposes a phased plan to close the remaining work before launching in Rwanda and Malta.

## Executive summary

| Area | Status | Notes |
| --- | --- | --- |
| Platform foundations | ✅ Established | Supabase migrations, seeds, and key Edge Functions for Stripe checkout, receipt queuing, and QR sessions are in place and enforce RLS headers end to end.【F:supabase/functions/payments/stripe/checkout/index.ts†L1-L155】【F:supabase/functions/create_table_session/index.ts†L1-L110】【F:supabase/functions/_shared/payments.ts†L1-L210】 |
| Payments & fiscalisation | ⚠️ At risk | Mobile-money flows and fiscal receipt issuance remain simulated stubs; Stripe also returns a pending stub until real secrets are configured.【F:supabase/functions/payments/momo/request_to_pay/index.ts†L64-L110】【F:supabase/functions/receipts/issue_ebm_rwanda/index.ts†L54-L80】【F:supabase/functions/payments/stripe/checkout/index.ts†L82-L95】 |
| Notifications & offline | ⚠️ At risk | Push delivery is a logging stub; Workbox service worker exists but requires production validation and background sync drills.【F:supabase/functions/notifications/send_push/index.ts†L109-L135】【F:src/sw.ts†L1-L160】 |
| QA & automation | ❌ Blocked | ESLint fails, Playwright suites are fully skipped, and load tests are scaffolds without executed baselines.【d38346†L1-L62】【F:tests/playwright/specs/diner.journey.spec.ts†L1-L5】【F:tests/k6/README.md†L1-L44】 |
| Observability & compliance | ⚠️ At risk | Implementation plan still requires OpenTelemetry wiring, AI evaluation harness, DPIA/RoPA, and rollout governance before go-live.【F:docs/implementation-plan.md†L219-L246】 |

## Strengths already in place

- **Transactional scaffolding** – Stripe/Adyen checkout and webhook handlers use shared validation and persist orders/payments while triggering the fiscalisation queue, giving a solid backbone once live credentials are supplied.【F:supabase/functions/payments/stripe/checkout/index.ts†L47-L160】【F:supabase/functions/payments/stripe/webhook/index.ts†L40-L80】  
- **Receipts pipeline skeleton** – The receipt worker dequeues jobs, generates region-specific payloads, and logs job transitions so real integrations can plug in with minimal refactoring.【F:supabase/functions/receipts/process_queue/index.ts†L1-L140】  
- **Session-bound RLS** – Table sessions are validated, persisted, and injected into every Supabase call, ensuring diners cannot read or mutate other tables once policies are deployed.【F:supabase/functions/create_table_session/index.ts†L1-L110】【F:src/hooks/useTableSession.ts†L1-L103】  
- **Multi-surface shells** – Client, merchant, and admin shells consume Supabase data and expose the required control panels for future wiring (menu manager, receipts console, AI settings).【F:src/components/client/ClientShell.tsx†L1-L160】【F:src/components/merchant/MerchantShell.tsx†L1-L120】【F:src/components/admin/AdminShell.tsx†L1-L120】  

## Outstanding gaps before production

### Payments, receipts, and fiscal compliance
- **Mobile money integrations are placeholder stubs.** The MTN MoMo endpoint fabricates `momo_stub_*` provider references and warns that real credentials must be configured, so no live collection can occur today.【F:supabase/functions/payments/momo/request_to_pay/index.ts†L64-L110】
- **Fiscal receipts remain simulated.** `issue_ebm_rwanda` and the queue worker emit simulated payloads; neither posts to the RRA EBM 2.1 service nor Malta’s fiscal printers yet.【F:supabase/functions/receipts/issue_ebm_rwanda/index.ts†L54-L80】【F:supabase/functions/receipts/process_queue/index.ts†L1-L140】
- **Stripe checkout falls back to 202 responses without secrets.** Until `STRIPE_SECRET_KEY` is present, diners receive a pending message instead of a usable checkout URL.【F:supabase/functions/payments/stripe/checkout/index.ts†L82-L95】

### Notifications, offline, and reliability
- **Push delivery is not wired.** `notifications/send_push` only logs and returns a stub response, so diners and merchants will not receive actual web push alerts yet.【F:supabase/functions/notifications/send_push/index.ts†L109-L135】
- **Offline sync scenarios need production drills.** The Workbox-based service worker covers caching and background sync but still requires end-to-end validation under throttled networks and Supabase outages before launch.【F:src/sw.ts†L1-L160】

### Quality gates and automation
- **Linting fails across the monorepo.** ESLint reports 25 errors, including `no-explicit-any`, parse errors inside shared payment utilities, and UI typing issues, blocking CI quality gates.【d38346†L1-L62】
- **End-to-end coverage is absent.** All Playwright suites are skipped pending vendor work, leaving critical diner, merchant, and admin flows untested.【F:tests/playwright/specs/diner.journey.spec.ts†L1-L5】【F:tests/playwright/specs/merchant.operations.spec.ts†L1-L5】
- **Load testing scripts are scaffolds.** The k6 directory documents how vendors should contribute but no baseline tests or results have been executed or stored yet.【F:tests/k6/README.md†L1-L44】

### Observability, AI governance, and compliance
- **Telemetry and AI evaluation still need implementation.** The implementation plan expects OpenTelemetry spans, AI eval harnesses, and structured analytics dashboards prior to Phase 11 sign-off; these hooks are not yet present in code.【F:docs/implementation-plan.md†L225-L246】
- **Operational readiness artefacts remain to be produced.** DPIA/RoPA records, rollout canary tooling, and final sign-off checklist items (live payment tests, push validation, agent kill switches) are tracked in the plan but not yet satisfied.【F:docs/implementation-plan.md†L219-L246】

## Phased close-out plan

### Phase A – Integrations & platform hardening (2–3 weeks)
1. Wire MTN MoMo and Airtel Money to live APIs with credential storage, signature validation, and webhook reconciliation; replace stub provider references with real transaction IDs.【F:supabase/functions/payments/momo/request_to_pay/index.ts†L64-L110】
2. Implement production fiscalisation: connect `issue_ebm_rwanda` to RRA EBM 2.1 endpoints and integrate Malta-certified fiscal receipt APIs, retaining the existing queue logging for observability.【F:supabase/functions/receipts/issue_ebm_rwanda/index.ts†L54-L80】【F:supabase/functions/receipts/process_queue/index.ts†L1-L140】
3. Finalise Stripe/Adyen configuration per environment and extend checkout fallbacks to surface actionable errors instead of 202 placeholders.【F:supabase/functions/payments/stripe/checkout/index.ts†L82-L95】
4. Replace the push stub with a delivery worker (e.g., web-push library or vendor gateway) and run device matrix tests, including iOS A2HS paths.【F:supabase/functions/notifications/send_push/index.ts†L109-L135】

### Phase B – Quality, observability, and governance (3 weeks)
1. Resolve ESLint violations, align TypeScript generics in shared modules, and enforce lint/typecheck in CI to establish a green baseline.【d38346†L1-L62】
2. Unskip and implement Playwright flows for diner checkout, merchant KDS management, and admin AI configuration; capture golden screenshots and accessibility assertions.【F:tests/playwright/specs/diner.journey.spec.ts†L1-L5】
3. Execute k6 scenarios against staging, capturing artefacts in `tests/k6/results/` and wiring alerts to the observability stack expected in the implementation plan.【F:tests/k6/README.md†L19-L44】【F:docs/implementation-plan.md†L225-L246】
4. Add OpenTelemetry instrumentation to Edge Functions, the agents service, and critical React interactions; surface dashboards for API latency, receipt p95, AI spend, and safety incidents as mandated in the roadmap.【F:docs/implementation-plan.md†L219-L233】
5. Stand up the AI evaluation harness (golden Q&A, allergen audits, tool success metrics) so agent changes cannot ship without passing automated checks.【F:docs/implementation-plan.md†L225-L233】

### Phase C – Compliance closure & rollout (2 weeks)
1. Complete DPIA and RoPA packages, document GDPR/Rwanda DPL lawful bases, and link outputs inside the Admin compliance panels for operator visibility.【F:docs/implementation-plan.md†L219-L246】
2. Implement feature flags and canary controls required for the release gate (10% → 50% → 100%), ensuring AI autonomy, promo bandits, and push notifications can be toggled safely.【F:docs/implementation-plan.md†L201-L215】
3. Run final production readiness tests: live payment dry runs in both regions, fiscal receipt issuance with vendor witnesses, PWA install/push validation on Android and iOS, and agent kill-switch rehearsals before signing off the GA checklist.【F:docs/implementation-plan.md†L213-L246】

## Recommended next steps

1. **Assign owners per domain** (payments, fiscalisation, notifications, QA, observability, compliance) and spin up workstreams aligned to Phases A–C above.  
2. **Stand up a readiness dashboard** in the Admin console summarising each blocker’s status so stakeholders can track progress against the final sign-off checklist.【F:docs/implementation-plan.md†L213-L246】  
3. **Schedule vendor/partner coordination** for fiscal device certification, mobile money onboarding, and performance testing to avoid last-minute compliance delays.  

Delivering the actions above will move ICUPA from a feature-complete beta into a production-hardened platform ready for the Rwanda and Malta launches.
