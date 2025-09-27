# ICUPA Implementation Plan

This implementation plan translates the ICUPA programme brief, regulatory requirements, and current codebase state into a production-ready delivery roadmap. It is organised into sequential phases with explicit goals, deliverables, dependencies, and acceptance criteria. Cross-cutting tracks (security, compliance, observability, and AI governance) run in parallel with the feature work. The plan assumes the additive-only constraint and preserves all existing environment contracts.

## Guiding principles

- **Multi-surface parity** – deliver consistent experiences across diner (client), merchant, and admin PWAs using shared design tokens and component primitives.
- **Supabase-first backend** – rely on managed Postgres 15 with RLS, pgvector, PGMQ, pg_cron, and Storage. All server mutations funnel through Edge Functions or the agents service using the service role.
- **AI safety and transparency** – implement agents with tool allow-lists, guardrails, and telemetry; expose AI labels, opt-outs, and kill-switches per region and tenant.
- **Regulatory readiness** – satisfy Rwanda EBM 2.1, Malta fiscal receipts, GDPR/Rwanda DPL data handling, EU AI Act transparency, and DSA KYBC obligations prior to GA.
- **Performance and reliability** – meet Core Web Vitals (LCP ≤ 2.5 s, TTI ≤ 2.0 s), API p95 ≤ 250 ms, checkout success ≥ 99.5%, and fiscal receipt latency p95 ≤ 5 s.

## Phase 0 – Bootstrap foundations (Weeks 1–2)

**Objectives**
- Ensure the scaffolded monorepo, Supabase project, and agents service boot end-to-end on developer machines.
- Document environment variables, secrets handling, and run baseline lint/type scripts.

**Deliverables**
- Supabase Docker stack running locally with migrations + seed applied (`tenants`, `locations`, `items`, `orders`, `agent_events`) via [`supabase/migrations/00000000000000_bootstrap.sql`](../supabase/migrations/00000000000000_bootstrap.sql) and [`supabase/seed/seed.sql`](../supabase/seed/seed.sql).
- `.env.local` and agents service `.env` templates populated with placeholders (no secrets committed). Templates now live at [`.env.example`](../.env.example) and [`agents-service/.env.example`](../agents-service/.env.example).
- GitHub Actions workflows for lint, typecheck, migration diff verification, and Edge Function builds (`.github/workflows/ci.yml`).
- README quick-start validated with Supabase commands documented.

**Acceptance criteria**
- `supabase start` + `supabase db reset` + `supabase db execute --file supabase/seed/seed.sql` succeed.
- `npm run dev` serves the diner shell with liquid-glass layout.
- Agents service `/health` returns `ok` in dev.
- CI green on scaffold branch.

## Phase 1 – Database and RLS hardening (Weeks 2–3)

**Objectives**
- Finalise core schema, indexes, and RLS policies to enforce diner (`x-icupa-session`) and staff (tenant-scoped roles) access.
- Prepare embeddings infrastructure for semantic search.

**Deliverables**
- Migration review ensuring no duplicates and additive-only changes.
- ivfflat index on `items.embedding` with tuned `lists` value per Supabase guidance.
- `supabase/functions/menu/embed_items` Edge Function capable of refreshing embeddings on demand and on pg_cron schedule.
- Vector search RPC (`public.search_menu_items`) with a Supabase Edge Function proxy so diners can request top-k matches without exposing OpenAI credentials.
- SQL regression test verifying cosine similarity queries return relevant items.

**Acceptance criteria**
- Automated RLS tests confirm diners cannot read other table orders; staff roles mapped through `user_roles` succeed.
- Embedding refresh job populates vectors for seeded items (OpenAI `text-embedding-3-large`).
- Search API returns top-k items with similarity score > configured threshold.

**Outsourcing support**
- Schema reviewers, RLS auditors, and embedding operators follow the [Phase 1 outsourcing playbook](outsourcing/phase1-outsourcing.md) with artefacts stored in `artifacts/phase1/` and detailed notes inside `docs/outsourcing/notes/`.

## Phase 2 – Table QR session flow (Weeks 3–4)

**Objectives**
- Bind diner sessions to physical tables using signed QR payloads and enforce the `x-icupa-session` header end-to-end.

**Deliverables**
- `supabase/functions/create_table_session` implementing QR signature validation, IP fingerprint capture, 4-hour TTL, and structured response. ✅ Implemented in [`supabase/functions/create_table_session/index.ts`](../supabase/functions/create_table_session/index.ts).
- Backend RLS helper returns `NULL` for expired sessions so stale headers cannot authorise reads or writes. ✅ Enforced via [`supabase/migrations/20240331000000_phase2_session_expiry_guard.sql`](../supabase/migrations/20240331000000_phase2_session_expiry_guard.sql) and covered by the updated RLS regression suite.【F:supabase/tests/rls_orders.sql†L17-L90】【F:supabase/tests/rls_table_sessions.sql†L1-L70】
- Client-side storage + injection of `table_session_id` into Supabase client headers via [`src/hooks/useTableSession.ts`](../src/hooks/useTableSession.ts) and the Supabase client fetch wrapper.【F:src/hooks/useTableSession.ts†L1-L103】【F:src/integrations/supabase/client.ts†L1-L34】
- ✅ RLS regression suite verifying access isolation across orders and table sessions via [`supabase/tests/rls_orders.sql`](../supabase/tests/rls_orders.sql) and [`supabase/tests/rls_table_sessions.sql`](../supabase/tests/rls_table_sessions.sql).
- Admin tooling to re-issue QR codes per table (stub UI acceptable if backed by API) exposed at `/admin/tools/qr` and backed by [`supabase/functions/admin/reissue_table_qr`](../supabase/functions/admin/reissue_table_qr/index.ts).【F:src/pages/AdminQrTools.tsx†L1-L119】

**Acceptance criteria**
- Scan → create session → menu load flow works on mobile device simulator.
- Attempts to access another session’s order return RLS error (logged without PII).

**Outsourcing support**
- QR security, session QA, and mobile journey partners follow the [Phase 2 outsourcing playbook](outsourcing/phase2-outsourcing.md), storing artefacts in `artifacts/phase2/` and logging meeting notes under `docs/outsourcing/notes/`.

## Phase 3 – Client PWA MVP (Weeks 4–6)

**Objectives**
- Deliver the diner journey (browse → cart → pay placeholder) with mobile-first gradient/liquid-glass UI and accessibility compliance.

**Deliverables**
- ✅ Menu grid with category filters, allergen toggles, dietary chips, and semantic search fallbacks rendered through the diner shell, the `MenuGrid` component, and the dedicated filter sheet.【F:src/components/client/ClientShell.tsx†L214-L408】【F:src/components/client/MenuGrid.tsx†L1-L168】【F:src/components/client/MenuFiltersSheet.tsx†L1-L122】
- ✅ Item detail drawer exposes allergen chips, pairing suggestions, prep time, alcohol guidance, and price transparency backed by the shared currency formatter.【F:src/components/client/MenuItemDrawer.tsx†L1-L109】【F:src/lib/currency.ts†L1-L12】
- ✅ Persisted cart store with split/tip scaffolding and a sticky action dock keeps the menu, cart, pay placeholder, and AI chat reachable on mobile.【F:src/stores/cart-store.ts†L80-L140】【F:src/components/client/Cart.tsx†L200-L438】【F:src/components/client/ActionDock.tsx†L1-L74】
- ✅ Payment placeholder surfaces totals, offline messaging, and next-step guidance while wiring future payment hooks behind the shared shell.【F:src/components/client/PaymentScreen.tsx†L1-L360】【F:src/components/client/ClientShell.tsx†L409-L548】
- ✅ AI chat tab delivers a reduced-motion aware conversational placeholder with quick intents until the Agents SDK endpoint is connected.【F:src/components/client/AIChatScreen.tsx†L1-L174】【F:src/components/client/ActionDock.tsx†L8-L41】
- ✅ Install prompt hook, iOS Add-to-Home-Screen guidance, and the Workbox-based service worker satisfy the Phase 3 PWA requirement while keeping runtime caching additive.【F:src/hooks/useInstallPrompt.ts†L1-L56】【F:src/components/client/ClientShell.tsx†L456-L530】【F:src/sw.ts†L1-L154】

**Acceptance criteria**
- Lighthouse PWA audit ≥ 90 on mobile (tracked in accessibility/performance artefacts under `artifacts/phase3/`).
- Axe accessibility scan passes (validated by `npm run test:accessibility`).【F:tests/accessibility/phase3.test.tsx†L1-L59】

**Outsourcing support**
- UX, accessibility, and performance vendors follow the [Phase 3 outsourcing playbook](outsourcing/phase3-outsourcing.md), storing artefacts in `artifacts/phase3/` and logging audit notes inside `docs/outsourcing/notes/`.

## Phase 4 – Payments and webhooks (Weeks 6–8)

**Objectives**
- Integrate payment providers for both regions with secure Edge Functions handling server-side truth and webhook reconciliation.

**Deliverables**
- ✅ Stripe/Adyen checkout Edge Functions (`payments/stripe/checkout`, `payments/adyen/checkout`) validating cart totals, creating Checkout Sessions or payment links, and persisting provisional order/payment records.【F:supabase/functions/payments/stripe/checkout/index.ts†L1-L200】【F:supabase/functions/payments/adyen/checkout/index.ts†L1-L187】
- ✅ Stripe/Adyen webhook functions marking payments as `captured`, enqueuing fiscalisation jobs (PGMQ), and updating orders.【F:supabase/functions/payments/stripe/webhook/index.ts†L1-L87】【F:supabase/functions/payments/adyen/webhook/index.ts†L1-L163】
- ✅ MTN MoMo and Airtel Money request-to-pay stubs with webhook receivers (status updates, refund hooks, signature validation).【F:supabase/functions/payments/momo/request_to_pay/index.ts†L1-L94】【F:supabase/functions/payments/momo/webhook/index.ts†L1-L63】【F:supabase/functions/payments/airtel/request_to_pay/index.ts†L1-L94】【F:supabase/functions/payments/airtel/webhook/index.ts†L1-L60】
- ✅ Front-end pay screen invoking the Edge Functions, showing pending/captured states, and surfacing error messaging.【F:src/components/client/PaymentScreen.tsx†L99-L352】
- ✅ Documentation of required env vars, queue helpers, and PSP onboarding steps in the README.【F:README.md†L96-L138】【F:README.md†L176-L207】
- ✅ Supabase SQL regressions covering payment RLS and fiscalisation job payloads so capture handlers remain deterministic.【F:supabase/tests/payments_rls.sql†L1-L99】【F:supabase/tests/payments_queue.sql†L1-L63】

**Acceptance criteria**
- Stripe test mode flow completes, updates `payments` row to `captured`, and pushes fiscalisation job.
- MoMo/Airtel stubs deploy successfully and log structured TODOs for production credentials.

## Phase 5 – Receipts and fiscalisation (Weeks 8–9)

**Objectives**
- Produce compliant receipts for Rwanda (EBM 2.1) and Malta (fiscal printer/software) with stubs ready for live integration.

**Deliverables**
- `receipts/issue_ebm_rwanda` Edge Function returning simulated payload (invoice number, QR, totals) and integration instructions (retry logic, audit logging).
- `receipts/issue_fiscal_malta` stub returning compliant receipt structure with placeholders for fiscal signatures.
- Receipts pipeline: payment webhook → queue → receipt writer → notifications.
- Merchant UI surface to view/reprint receipts and handle error remediation.
- Manual retry flow: `public.retry_fiscalization_job` RPC and merchant dashboard action for staff to requeue failed jobs without service-role keys.

**Acceptance criteria**
- On payment capture, receipts table populated with simulated data and user notified via UI.
- Runbook drafted for EBM downtime and Malta fiscal printer failures.

## Phase 6 – Agents service v1 (Weeks 9–11)

**Objectives**
- Replace placeholder waiter endpoint with OpenAI Agents SDK implementation delivering grounded, safe responses and upsell suggestions.

**Deliverables**
- Agents service definitions for Waiter, Allergen Guardian, and Upsell agents using tools (`get_menu`, `check_allergens`, `recommend_items`, `create_order`, `get_kitchen_load`).
- Guardrails covering age gate, allergen hard blocks, schema validation, and price transparency.
- Retrieval integration (file_search collections: `menu`, `allergens`, `policies`) with 5-minute freshness TTL and citation chips.
- Telemetry pipeline writing to `agent_sessions`, `agent_events`, and `recommendation_impressions` (PII redacted).
- Admin kill-switch toggles + cost budgets per agent.

**Acceptance criteria**
- Demo chat session returns 2–3 grounded upsell options citing menu sources, blocking allergen conflicts.
- Schema validations prevent malformed tool calls; guardrail breaches logged.
- Cost tracking dashboards show spend per agent per tenant.

## Phase 7 – Merchant portal core (Weeks 11–14)

**Objectives**
- Provide staff-facing portal with real-time KDS, floor state management, menu/inventory controls, and promo builder foundations.

**Deliverables**
- KDS page subscribing to Supabase Realtime for order events (course states, prep timers).
- Floor management CRUD for table states (`vacant`, `ordering`, `served`, `bill`, `cleaning`) with drag-and-drop layout editor.
- Menu Manager interface allowing AI-assisted copy rewrites (human approval required) and availability toggles.
- Inventory module capturing stock counts, thresholds, and optional auto-86 toggles (autonomy ≤ L2).
- Promo builder capturing epsilon-bandit parameters (epsilon, budget caps, frequency caps, fairness constraints) with review workflow.
- Payments desk for manual captures, outstanding settlement visibility, and provider failure triage backed by audit logging.

**Acceptance criteria**
- Orders propagate from diner app to KDS in <1 s using Supabase Realtime.
- AI menu suggestions require explicit approval with diff view and audit trail.
- Promo builder persists settings and enforces caps at runtime.

## Phase 8 – Admin console (Weeks 14–16)

**Objectives**
- Equip operations with onboarding, AI configuration, analytics, and compliance dashboards.

**Deliverables**
- Onboarding wizard backed by `supabase/functions/admin/onboard_tenant` creating tenants, default locations, and roles after KYB checks.
- AI settings UI exposing instructions, tool allow-lists, autonomy levels, budgets, retrieval TTL, and experiment flags per agent class, including a platform-defaults scope so central ops can adjust baseline policies before onboarding new tenants.
- Analytics dashboard with KPIs: GMV, AOV, attach rates, prep SLA, AI acceptance, safety blocks.
- Compliance panels: fiscalisation SLA tracker, AI disclosure copy editor, DSA KYBC checklist, GDPR/Rwanda DPL notices.
- DSR tooling (export/delete) entry point linking to Supabase functions or manual runbooks.

**Acceptance criteria**
- New tenant onboarding flow completes with seeded menu + staff invites.
- AI settings changes propagate to agents service within minutes and log audit trail.
- Compliance dashboard surfaces outstanding receipts or disclosure tasks with severity levels.
- DSR intake surface records export/delete requests with status transitions and runbook links for fulfilment.

## Phase 9 – Offline, background sync, and push (Weeks 16–18)

**Objectives**
- Harden the PWA for unreliable connectivity and enable web push across supported platforms.

**Deliverables**
- Workbox runtime caching strategies: CacheFirst with expiry for images, StaleWhileRevalidate for menu JSON, NetworkFirst + Background Sync queue for API mutations (orders, payments).
- Service worker hooks for `sync`, `push`, and `notificationclick` events.
- Edge Functions: `notifications/subscribe_push` storing VAPID subscriptions; `notifications/send_push` stub delivering structured payloads.
- iOS install banner with instructions for enabling push (A2HS requirement).
- Offline cart persistence tests (write, reload, sync once online).
- Offline sync telemetry recorded in `offline_sync_events` so background queue latency and failures are auditable from the admin console.
- Admin compliance workspace surfaces the offline sync summary card so tenant operators can review per-location batches, failures, and latency without exporting data.
- Outsourcing governance captured in [`docs/outsourcing/phase9-outsourcing.md`](outsourcing/phase9-outsourcing.md) so the PWA, push, and QA vendors deliver artefacts into `artifacts/phase9/` and `tests/offline/` without blocking core development.

**Acceptance criteria**
- Simulated offline order creation queues and syncs successfully after reconnection.
- Push subscription stored and sample notification rendered on supported browsers.

## Phase 10 – Testing, load, and security hardening (Weeks 18–20)

**Objectives**
- Validate end-to-end flows, load characteristics, and security posture before launch.

**Deliverables**
- Playwright suites covering diner flow (QR → session → menu → cart → pay → receipt), merchant KDS operations, and admin AI settings changes, with outsourcing governance captured in [`docs/outsourcing/phase10-outsourcing.md`](outsourcing/phase10-outsourcing.md).
- k6 load tests for critical Edge Functions (`create_table_session`, payment webhooks) meeting latency/error budgets.
- Security review: CSP/HSTS/SameSite cookie validation, dependency audit, secrets scan, RLS black-box penetration tests, OWASP ASVS checklist.
- Incident response runbooks for payments timeout, fiscalisation outage, AI kill switch (see [`docs/runbooks/payments-timeout.md`](runbooks/payments-timeout.md), [`docs/runbooks/fiscalization.md`](runbooks/fiscalization.md), [`docs/runbooks/ai-kill-switch.md`](runbooks/ai-kill-switch.md)).

**Acceptance criteria**
- E2E suites pass in CI and staging.
- Load tests demonstrate p95 latency within budgets under peak concurrency.
- Security review sign-off with tracked remediation items.

## Phase 11 – Release, rollout, and monitoring (Weeks 20–22)

**Objectives**
- Execute staged rollout across dev → staging → prod-eu/prod-rw with feature flags and canaries.

**Deliverables**
- Feature flag toggles for AI autonomy levels, promo bandits, payments providers, and push notifications.
- Canary plan: 10% → 50% → 100% tenants per region with rollback scripts.
- Observability dashboards (Grafana/DataDog) for key metrics: API latency, checkout success, receipt latency, AI spend, allergen/age blocks.
- On-call rotation, escalation matrix, and runbook links embedded in Admin console.
- Launch communications checklist (privacy notices, AI disclosures, support training).

**Acceptance criteria**
- Canary tenants complete real transactions with fiscal receipts; monitoring shows no regressions.
- Final sign-off checklist satisfied: migrations deployed to prod-eu/prod-rw, Edge Functions configured, PWA install verified on Android/iOS, payments tested live, agents guarded.

## Cross-cutting tracks

### Security & privacy
- Data Protection Impact Assessment (DPIA) covering Rwanda DPL and GDPR use cases.
- Records of Processing Activities (RoPA) maintained in Admin console or shared documentation.
- Encryption in transit (TLS 1.3) and at rest (Supabase managed keys) with KMS rotation for agent secrets.
- Regular secrets rotation, vulnerability scans, and dependency updates.

### Observability & analytics
- OpenTelemetry instrumentation on API handlers, Edge Functions, and agents service (trace IDs correlated with `agent_events`).
- Structured logs without PII; ingest into ClickHouse/ELK for ad-hoc analysis.
- Business KPI dashboards per tenant/region with alerts on SLA breaches (prep SLA p95, fiscal receipt latency, AI hallucination audits).

### AI governance
- Agent evaluation harness (golden Q&A sets, allergen safety prompts, tool invocation success metrics).
- Bandit experimentation guardrails (epsilon ≤ configured cap, fatigue counters, fairness constraints).
- Transparency surfaces: AI badge, “Why am I seeing this?” explanations, personalization opt-out toggles, and deletion of preference memory on request.

### Documentation & enablement
- Living README + architecture decision records (ADRs) for major design choices.
- Developer handbook covering branching strategy, coding standards, and testing requirements.
- Merchant and admin runbooks for fiscalisation, payments reconciliation, and AI settings.

## Milestone review gates

1. **M0 (Phase 3 complete)** – Diner MVP usable offline with table sessions and compliance UI cues.
2. **M1 (Phase 5 complete)** – Payments + receipts pipelines working end-to-end in staging.
3. **M2 (Phase 8 complete)** – Merchant/Admin portals functional with AI configuration and compliance dashboards.
4. **M3 (Phase 10 complete)** – All automated tests, load, and security checks green; runbooks signed off.
5. **GA (Phase 11 complete)** – Production rollout executed with monitoring, on-call, and regulatory artefacts delivered.

Adhering to this plan positions ICUPA for a confident, compliant launch across Rwanda and Malta while preserving room for iterative AI enhancements and future region expansions.
