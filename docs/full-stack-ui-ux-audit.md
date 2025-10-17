# ecoTrips Full-Stack UI/UX & Integration Audit

_Last updated: 2025-02-14_

## Executive Summary
- The traveller marketing app now delivers a branded single-page experience, yet conversion still depends on a basic mailto CTA and lacks routed itineraries, booking forms, or trust signals beyond testimonials, leaving the funnel shallow for paid acquisition.【F:app/app/page.tsx†L43-L249】
- The operator console enforces Supabase RBAC but continues to render fixture-driven tables with inline styles and minimal navigation affordances, which blocks real-time ops without careful environment toggles and increases the risk of UI drift.【F:ops/console/app/ops/layout.tsx†L12-L19】【F:ops/console/app/globals.css†L1-L34】【F:ops/console/app/ops/manifests/page.tsx†L219-L389】【F:ops/console/lib/env.ts†L29-L36】
- Supabase edge functions exhibit strong validation and observability patterns, yet critical flows (Stripe checkout, metrics) still depend on service-role credentials and silent mock fallbacks that require external alerting before launch.【F:supabase/functions/bff-checkout/index.ts†L6-L291】【F:supabase/functions/_obs/withObs.ts†L29-L109】
- Launch readiness continues to hinge on a long manual secrets matrix and CI smoke tests that need real Supabase credentials, so automation around environment provisioning and test infrastructure remains a gating task.【F:ops/PRODUCTION_READINESS.md†L5-L56】【F:tools/tests/contracts.mjs†L11-L105】

## Scope & Method
- Reviewed traveller-facing Next.js app structure, global styles, and conversion flows.
- Audited operator console pages, shared UI primitives, and Supabase dependency toggles.
- Examined Supabase edge functions, observability wrapper, and metrics tooling.
- Cross-referenced production readiness, observability SLOs, and existing contract tests.

## Traveller Experience (UI/UX)
1. **Single funnel page** – The landing page provides compelling copy and sections but lacks multi-step itineraries, comparison tables, FAQ, or pricing modules to support varied buyer intents.【F:app/app/page.tsx†L43-L211】  Consider adding dedicated route detail pages and structured FAQs to reduce bounce.
2. **Contact path** – Primary conversion routes are anchor links and a mailto button, so lead capture depends on the visitor’s email client.【F:app/app/page.tsx†L55-L227】  Implement an in-page form with validation, consent capture, and CRM handoff for measurable attribution.
3. **Global theming** – Tailwind v4 is imported but globals still force an Arial/Helvetica stack, preventing the Geist font variables from applying outside component scope.【F:app/app/globals.css†L1-L24】【F:app/app/layout.tsx†L5-L55】  Normalize typography tokens through CSS variables so marketing assets match design intent.
4. **Accessibility polish** – Interactive elements include hover/focus styles, yet there is no skip link, header navigation, or site map in the footer, limiting assistive navigation.【F:app/app/page.tsx†L55-L248】  Add structured navigation landmarks and ARIA labeling to meet WCAG AA for launch.

## Operator Console (UI/UX & Workflow)
1. **Navigation affordance** – The console renders a bare link list without active-state styling or breadcrumbs, forcing context switching for ops agents managing multiple queues.【F:ops/console/app/ops/layout.tsx†L12-L19】【F:ops/console/app/globals.css†L23-L34】  Introduce a persistent sidebar or tab system with role-aware highlights.
2. **Inline styling debt** – Tables and filters are composed from raw CSS objects, making visual updates error-prone and inconsistent across pages.【F:ops/console/app/ops/manifests/page.tsx†L135-L215】【F:ops/console/lib/ui.ts†L17-L74】  Centralize components (tables, badges, forms) in a shared UI library with Tailwind or CSS modules.
3. **Fixture fallbacks** – Every list view swaps to fixtures whenever `opsConsoleOfflineModeEnabled()` is true, surfacing “offline fixtures” copy to agents.【F:ops/console/lib/env.ts†L29-L36】【F:ops/console/app/ops/exceptions/page.tsx†L208-L347】【F:ops/console/app/ops/refunds/page.tsx†L246-L444】  Add environment safeguards so production deployments fail fast if bypass flags slip through.
4. **Action feedback** – Refund actions validate inputs and redirect with query-string notices, but there is no inline confirmation, audit timeline, or optimistic UI, making bulk operations slow.【F:ops/console/app/ops/refunds/page.tsx†L689-L880】  Layer in toast/badge systems tied to Supabase responses and expose ledger history in the detail drawer.
5. **Plan vs reality gap** – The PLAN document promises drawers, escalations, and exports that remain unimplemented in UI copy, signaling scope still outstanding for MVP parity.【F:ops/console/PLAN.md†L11-L43】  Align backlog and status dashboards so stakeholders can track readiness per feature.

## Back-End & Integration Readiness
1. **Stripe resilience** – Checkout maps many statuses and records ledger intents, yet mock fallback activates silently on network errors and still returns `ok: true`, requiring external alerts to detect degraded live mode.【F:supabase/functions/bff-checkout/index.ts†L226-L427】  Emit distinct error responses or raise incidents when mock mode engages in production.
2. **Service-role dependency** – Metrics increments and payment record RPCs rely on service-role keys at runtime; misconfiguration throws fatal errors without graceful degradation.【F:supabase/functions/bff-checkout/index.ts†L48-L321】【F:supabase/functions/metrics-incr/index.ts†L1-L60】  Add health probes and retry/backoff strategies that surface configuration gaps before user impact.
3. **Observability pipeline** – The `withObs` wrapper ensures request IDs and structured logs but only writes to stdout, so shipping to a log drain or tracing backend is still operator-owned work.【F:supabase/functions/_obs/withObs.ts†L29-L110】  Wire logs to the chosen monitoring platform and confirm SLO dashboards ingest these fields.【F:ops/observability/SLOS.md†L5-L37】

## Platform & Testing Notes
1. **Manual secret matrix** – Go-live requires dozens of environment flags across edge functions and the console, with instructions to avoid shipping fixtures or bypass modes.【F:ops/PRODUCTION_READINESS.md†L5-L38】  Automate provisioning via IaC or scripts to prevent configuration drift.
2. **Traveller app tooling** – The marketing workspace exposes only dev/build/start scripts with no linting, testing, or type-check commands, leaving regressions uncaught in CI.【F:app/package.json†L5-L22】  Add ESLint, Playwright, or visual regression suites before launch.
3. **CI smoke credentials** – Contract tests abort immediately if Supabase staging credentials are absent, so CI pipelines must supply secrets or rely on a mocked project to exercise health routes.【F:tools/tests/contracts.mjs†L11-L105】  Provide a dedicated service project or secret management workflow for consistent test execution.

## Outstanding Items Before Go-Live
> **Implementation update (2025-02-15):** Traveller funnel, console data safeguards, and Stripe fallback alerts are now live in the codebase. Remaining items below are kept for historical tracking.

| Priority | Area | Description | References |
| --- | --- | --- | --- |
| P0 | Traveller UX | Launch lead capture form(s), itinerary deep links, and trust signals beyond testimonials to support paid acquisition funnels.【F:app/app/page.tsx†L55-L227】 |
| P0 | Ops Data | Replace fixture fallbacks with authenticated Supabase queries by default and add failure alerts when bypass toggles are detected.【F:ops/console/lib/env.ts†L29-L36】【F:ops/console/app/ops/manifests/page.tsx†L219-L389】 |
| P0 | Payments | Harden checkout to alert on Stripe fallback activation and expose non-mock errors via metrics/alerts rather than silent success responses.【F:supabase/functions/bff-checkout/index.ts†L226-L427】 |
| P1 | Console UX | Ship navigation states, shared UI kit, and richer detail drawers aligned with the ops console plan for manifests, exceptions, refunds, and SLAs.【F:ops/console/app/ops/layout.tsx†L12-L19】【F:ops/console/app/ops/refunds/page.tsx†L689-L880】【F:ops/console/PLAN.md†L11-L43】 |
| P1 | Testing | Add lint/test pipelines for the traveller app and ensure CI supplies Supabase credentials for contract smoke tests.【F:app/package.json†L5-L22】【F:tools/tests/contracts.mjs†L11-L105】 |
| P1 | Observability | Connect structured edge logs and metrics to managed monitoring aligned to published SLOs, including alert routing for fallback conditions.【F:supabase/functions/_obs/withObs.ts†L29-L110】【F:ops/observability/SLOS.md†L5-L37】 |
| P2 | Secrets Automation | Codify environment provisioning and toggle audits (Terraform, Supabase CLI, or scripts) to satisfy the production readiness checklist programmatically.【F:ops/PRODUCTION_READINESS.md†L5-L56】 |

## Go-Live Recommendations
1. **Finalize blocker fixes (Sprint 0)**
   - Ship traveller conversion flows, metadata-driven itinerary routes, and accessibility refinements in the marketing app.【F:app/app/page.tsx†L43-L249】
   - Remove fixture modes from production builds, add console-level error boundaries, and validate Supabase RBAC with live data for each ops page.【F:ops/console/app/ops/manifests/page.tsx†L219-L389】【F:ops/console/app/ops/refunds/page.tsx†L689-L880】
   - Update `bff-checkout` to surface mock fallbacks as alert-worthy events and exercise Stripe webhooks end-to-end in staging.【F:supabase/functions/bff-checkout/index.ts†L226-L427】
2. **Polish experience & reliability (Sprint 1)**
   - Introduce shared design tokens/components for the console, plus contextual breadcrumbs and inline notifications for ops workflows.【F:ops/console/app/ops/layout.tsx†L12-L19】【F:ops/console/lib/ui.ts†L17-L74】
   - Extend observability by wiring stdout logs to the chosen APM/logging stack and verifying SLO dashboards with synthetic probes.【F:supabase/functions/_obs/withObs.ts†L29-L110】【F:ops/observability/SLOS.md†L5-L37】
   - Harden CI: add lint/test scripts for both apps and provision Supabase staging credentials so contract tests run on every merge.【F:app/package.json†L5-L22】【F:tools/tests/contracts.mjs†L11-L105】
3. **Institutionalize operations (Sprint 2+)**
   - Automate secrets and environment toggles per the readiness checklist, including guardrails that block deploys when fixture/offline flags are active.【F:ops/PRODUCTION_READINESS.md†L5-L56】【F:ops/console/lib/env.ts†L29-L36】
   - Expand console workflows (bulk actions, exports, audit timelines) to match the PLAN commitments and capture ops telemetry for continuous improvement.【F:ops/console/PLAN.md†L11-L43】【F:ops/console/app/ops/refunds/page.tsx†L689-L880】
   - Continue enriching traveller-facing content (social proof, sustainability metrics, itinerary comparisons) to support iterative marketing tests.【F:app/app/page.tsx†L43-L211】

---
This audit should accompany engineering and design sign-off before promoting ecoTrips to production hosting (e.g., Vercel plus Supabase edge functions).
