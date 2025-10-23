# ICUPA Implementation Plan

This implementation plan translates the ICUPA programme brief, regulatory requirements, and current codebase state into a production-ready delivery roadmap. It is organised into sequential phases with explicit goals, deliverables, dependencies, and acceptance criteria. Cross-cutting tracks (security, compliance, observability, and AI governance) run in parallel with the feature work. The plan assumes the additive-only constraint and preserves all existing environment contracts.

## Guiding principles

- **Multi-surface parity** – deliver consistent experiences across diner (client), merchant, and admin PWAs using shared design tokens and component primitives.
- **Supabase-first backend** – rely on managed Postgres 15 with RLS, pgvector, PGMQ, pg_cron, and Storage. All server mutations funnel through Edge Functions or the agents service using the service role.
- **AI safety and transparency** – implement agents with tool allow-lists, guardrails, and telemetry; expose AI labels, opt-outs, and kill-switches per region and tenant.
- **Regulatory readiness** – satisfy Rwanda EBM 2.1, Malta fiscal receipts, GDPR/Rwanda DPL data handling, EU AI Act transparency, and DSA KYBC obligations prior to GA.
- **Performance and reliability** – meet Core Web Vitals (LCP ≤ 2.5 s, TTI ≤ 2.0 s), API p95 ≤ 250 ms, checkout success ≥ 99.5%, and fiscal receipt latency p95 ≤ 5 s.

## CUPA launch readiness gates (P0–P3)

These gates compress the critical launch work into four reviewable windows that map to the deeper phase breakdowns that follow. Each gate must be satisfied in order; promotion to the next window assumes the previous gate has been signed off in staging or production shadow.

| Phase | Window | Focus | Critical Tasks | Exit / Gate |
| --- | --- | --- | --- | --- |
| P0 – Critical Blockers | 1–2 weeks | Payments, fiscal, RLS, AI guardrails, compliance basics | Implement real EBM/Malta connectors; productionize MoMo/Airtel with idempotency; enable RLS on inventory/agent_events; ship missing agents + timeouts; add CSP/HSTS, AI disclosure, DSR endpoints. | p95 capture→receipt ≤5 s in staging; RLS tests green; AI guardrails active; security headers verified. |
| P1 – Canary 10% | 1 week | Offline/perf + observability | Add navigation fallback + perf budgets; enable Lighthouse gating; wire OTel traces + Grafana dashboards; surface runbooks in admin. | Checkout ≥99.5%; fiscal failures <0.5% over 72h; dashboards/alerts live. |
| P2 – Scale 50→100% | 1–2 weeks | Promotions, inventory resilience, reconciliation | Deliver promo/inventory agents & controls; implement reconciliation jobs + daily reports; finalize refund/void flow. | SLOs stable 7 days; reconciliation clean; promo guardrails validated. |
| P3 – Post-GA Hardening | Ongoing | Voice, chaos, DPIA | Voice waiter readiness note & optional launch; chaos/load drills; quarterly DPIA review; cost optimization (model tiering, image pipeline). | Voice rollout go/no-go; chaos drills logged; DPIA calendar committed. |

### P0 – Critical Blockers (Weeks 0–2)

- Productionise the Rwanda EBM and Malta CFR fiscal connectors so the `/receipts` queue issues receipts within the staging ≤5 s p95 target; ensure retries and poison queue handling are in place.
- Harden mobile money integrations: add idempotency keys, duplicate submission guards, and queue-backed retries for MoMo and Airtel flows; expand regression coverage around `supabase/functions/payments/*` webhooks.
- Extend RLS coverage to `inventory`, `agent_events`, and any new tables introduced in recent migrations; gate with the RLS tests in `supabase/tests/rls_*` and ensure tenant/session claims propagate from Edge Functions.
- Close the gap on pending agents (timeouts, alerting, kill-switch hooks) and apply the AI guardrail config that blocks allergen/age violations.
- Ship baseline security and compliance tooling: CSP/HSTS headers in `src/sw.ts`/`public/_headers`, surfaced AI disclosures in the client shell, and DSR endpoints in `supabase/functions/compliance` with runbook links.

### P1 – Canary 10% (Week 3)

- Stand up offline fallback navigation with Workbox strategies and verify Perf Budgets via Lighthouse CI (`lighthouserc.json`).
- Enforce Lighthouse gating in CI to block regressions on LCP/CLS/TTI before widening rollout.
- Instrument OpenTelemetry spans across the agents service and Supabase functions, exporting into Grafana dashboards that surface payments, agents, and fiscal receipt latency trends.
- Publish runbooks (payments, fiscal, AI kill switch) directly inside the admin console so the canary rotation can self-serve.
- Gate promotion on checkout success ≥99.5% and fiscal failure rate <0.5% over a continuous 72-hour staging window.

### P2 – Scale 50→100% (Weeks 4–5)

- Finish promo and inventory control agents with guardrails (budget caps, fairness constraints) and expose configuration in the admin portal.
- Operationalise reconciliation by activating the daily pg_cron jobs in `supabase/functions/reconciliation` and piping reports to `artifacts/reconciliation/` for finance review.
- Complete refund/void flows across Supabase functions, agents service, and admin UI; ensure asynchronous updates reconcile with payment provider states.
- Observe SLO stability for seven consecutive days with live alerts; resolve any anomalies surfaced by Grafana dashboards.
- Validate promo guardrails and inventory resiliency via scripted chaos tests in `tests/chaos/`.

### P3 – Post-GA Hardening (Ongoing)

- Finalise the voice waiter readiness assessment and decide on opt-in launch scope; provide fallback scripts and staff training materials.
- Schedule and execute chaos/load drills each quarter, capturing learnings in `docs/runbooks/chaos-drill.md` and updating on-call procedures.
- Maintain an active DPIA cadence using `docs/compliance/dpia-schedule.md`; ensure data processors are logged and review uptake is tracked.
- Pursue cost optimisation initiatives: model tiering for agents, asset/image pipeline tuning, and scheduled pruning of inactive embeddings.
- Keep the post-GA backlog groomed with security patch tracking, dependency updates, and conservative feature expansion.

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
- `supabase start` + `supabase db reset --local --yes` + `supabase seed --local --yes` succeed.
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
- Client-side storage + injection of `table_session_id` into Supabase client headers via [`src/hooks/useTableSession.ts`](../src/hooks/useTableSession.ts) and the Supabase client fetch wrapper.【F:src/hooks/useTableSession.ts†L1-L103】【F:src/integrations/supabase/client.ts†L1-L34】
- RLS regression suite verifying access isolation.
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
- Menu grid with filters (category, allergens, dietary tags, semantic search) powered by Supabase or fallback dataset.
- Item detail drawer with allergen chips, pairing suggestions, and price transparency.
- Cart state (Zustand) with split/tip scaffolding and sticky action dock (`Menu`, `Cart`, `Pay`, `Ask ICUPA`).
- Pay screen placeholder integrating future payment hooks.
- AI chat placeholder (dock + intents) respecting prefers-reduced-motion.
- PWA manifest + Workbox pre-cache skeleton + install prompts (A2HS guidance for iOS).

**Acceptance criteria**
- Lighthouse PWA audit ≥ 90 on mobile.
- Axe accessibility scan passes (no critical issues).
- Phase 3 diner readiness checklist signed off with artefacts linked in [`docs/runbooks/phase3-diner-readiness.md`](runbooks/phase3-diner-readiness.md).

## Phase 4 – Payments and webhooks (Weeks 6–8)

**Objectives**
- Integrate payment providers for both regions with secure Edge Functions handling server-side truth and webhook reconciliation.

**Deliverables**
- ✅ Stripe/Adyen checkout Edge Function (`payments/stripe/checkout`) validating cart totals, creating Checkout Sessions, and persisting provisional order/payment records.【F:supabase/functions/payments/stripe/checkout/index.ts†L1-L168】
- ✅ Stripe/Adyen webhook function marking payments as `captured`, enqueuing fiscalisation jobs (PGMQ), and updating orders.【F:supabase/functions/payments/stripe/webhook/index.ts†L1-L87】
- ✅ MTN MoMo and Airtel Money request-to-pay stubs with webhook receivers (status updates, refund hooks, signature validation).【F:supabase/functions/payments/momo/request_to_pay/index.ts†L1-L94】【F:supabase/functions/payments/momo/webhook/index.ts†L1-L63】【F:supabase/functions/payments/airtel/request_to_pay/index.ts†L1-L94】【F:supabase/functions/payments/airtel/webhook/index.ts†L1-L60】
- ✅ Front-end pay screen invoking the Edge Functions, showing pending/captured states, and surfacing error messaging.【F:src/components/client/PaymentScreen.tsx†L99-L341】
- ✅ Documentation of required env vars, queue helpers, and PSP onboarding steps in the README.【F:README.md†L96-L138】【F:README.md†L176-L207】

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

**Acceptance criteria**
- Orders propagate from diner app to KDS in <1 s using Supabase Realtime.
- AI menu suggestions require explicit approval with diff view and audit trail.
- Promo builder persists settings and enforces caps at runtime.

## Phase 8 – Admin console (Weeks 14–16)

**Objectives**
- Equip operations with onboarding, AI configuration, analytics, and compliance dashboards.

**Deliverables**
- Onboarding wizard backed by `supabase/functions/admin/onboard_tenant` creating tenants, default locations, and roles after KYB checks.
- AI settings UI exposing instructions, tool allow-lists, autonomy levels, budgets, retrieval TTL, and experiment flags per agent class.
- Analytics dashboard with KPIs: GMV, AOV, attach rates, prep SLA, AI acceptance, safety blocks.
- Compliance panels: fiscalisation SLA tracker, AI disclosure copy editor, DSA KYBC checklist, GDPR/Rwanda DPL notices.
- DSR tooling (export/delete) entry point linking to Supabase functions or manual runbooks.

**Acceptance criteria**
- New tenant onboarding flow completes with seeded menu + staff invites.
- AI settings changes propagate to agents service within minutes and log audit trail.
- Compliance dashboard surfaces outstanding receipts or disclosure tasks with severity levels.

## Phase 9 – Offline, background sync, and push (Weeks 16–18)

**Objectives**
- Harden the PWA for unreliable connectivity and enable web push across supported platforms.

**Deliverables**
- Workbox runtime caching strategies: CacheFirst with expiry for images, StaleWhileRevalidate for menu JSON, NetworkFirst + Background Sync queue for API mutations (orders, payments).
- Service worker hooks for `sync`, `push`, and `notificationclick` events.
- Edge Functions: `notifications/subscribe_push` storing VAPID subscriptions; `notifications/send_push` stub delivering structured payloads.
- iOS install banner with instructions for enabling push (A2HS requirement).
- Offline cart persistence tests (write, reload, sync once online).
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

## OCR menu ingestion & structuring track

This taskpack operationalises automated menu OCR using OpenAI vision models while preserving additive-only guarantees across the stack. Workstreams follow the global rules: RLS-first schema, strict JSON Schema validation, confidence scoring, idempotent external calls, and redacted logging.

**Key deliverables**
- Database migration introducing `menu_ingestions` and `menu_items_staging` tables with RLS enabled and indexed (`supabase/migrations/XXXX_menu_ingestion.sql`).
- Supabase storage buckets `raw_menus` (private) and `menu_images` (public or signed).
- Edge Functions handling ingestion lifecycle: `ingest_menu_start`, `ingest_menu_process`, `ingest_menu_publish` under `supabase/functions/`.
- Merchant app workflow covering Upload → Draft Review → Publish within `apps/web/src/app/(merchant)/merchant/menu/`.
- Structured Outputs integration with OpenAI Responses API (vision) and batch-processing design notes.
- Tests and observability counters charting ingestion throughput, failures, and item confidence distribution.

**Environment variables**
- Required: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Optional tuning: `OCR_MAX_PAGES` (default 25), `OCR_IMAGE_MAX_EDGE` (default 1200), `OCR_MIN_CONFIDENCE` (default 0.55).

### PH1 – DB schema + RLS + indexes

**Objectives**
- Create additive-only schema for ingestion tracking and staging while enforcing tenant/location isolation.

**Deliverables**
- Migration file `supabase/migrations/XXXX_menu_ingestion.sql` defining:
  - `menu_ingestions` columns: `id`, `tenant_id`, `location_id`, `uploaded_by`, `original_filename`, `storage_path`, `file_mime`, `status`, `currency`, `raw_text`, `structured_json`, `errors`, timestamps.
  - `menu_items_staging` columns: `id`, `ingestion_id`, `category_name`, `name`, `description`, `price_cents`, `currency`, `allergens[]`, `tags[]`, `is_alcohol`, `confidence`, `media_url`.
- Enable RLS on both tables with policies granting staff write/read via `user_roles` and restricting tenants/locations appropriately.
- Indexes: `idx_ingestions_tenant_location` and `idx_staging_ingestion` to accelerate lookups.

**Acceptance criteria**
- Migrations apply cleanly across dev/staging/prod; reruns are idempotent.
- RLS tests confirm isolation for diners and staff (extend `supabase/tests/rls_inventory.sql` pattern for new tables).

### PH2 – Supabase storage buckets

**Objectives**
- Provision storage for raw uploads and processed menu imagery aligned with security posture.

**Deliverables**
- Configure `raw_menus` (private) and `menu_images` (public signed URLs) via Supabase CLI or dashboard; document policies in README.
- Ensure upload flows write only to `raw_menus` unless explicitly publishing derivative assets.

**Acceptance criteria**
- Buckets exist with correct visibility and access policies.
- Signed URL issuance audited in logs without exposing PII.

### PH3 – Edge functions: start, process, publish

#### T3 `ingest_menu_start`
- POST `/functions/v1/ingest_menu_start` accepting `{ location_id, original_filename, file_mime }`.
- Create an ingestion row bound to tenant/location, generate optional signed upload URL to `raw_menus`, return `{ ingestion_id, upload_url? }`.
- Enforce mime whitelist (pdf/jpg/jpeg/png) and record `status='uploaded'`.

#### T4 `ingest_menu_process`
- POST `/functions/v1/ingest_menu_process` with `{ ingestion_id }`.
- Fetch file from storage, convert PDFs to images (bounded by `OCR_MAX_PAGES`), resize to `OCR_IMAGE_MAX_EDGE`.
- Call OpenAI Responses API (`gpt-4o` vision) per page using `response_format: json_schema` (`menu_schema`).
- Merge page results, dedupe similar items (name/price match), compute confidence, and upsert staging rows.
- Persist combined `raw_text` and `structured_json` on `menu_ingestions`, set `status='awaiting_review'`, track `pages_processed`, `items_count`, and any errors.
- Ensure idempotent reruns replace prior staging data for the ingestion.

#### T5 `ingest_menu_publish`
- POST `/functions/v1/ingest_menu_publish` with `{ ingestion_id, menu_id }`.
- Wrap in transaction: upsert categories/items/modifiers for the menu/location, carry allergens/tags/is_alcohol flags, and align currency.
- Increment menu version, trigger `supabase/functions/menu/embed_items`, set ingestion `status='published'`.
- Return `{ published:true, items_upserted, categories_created, version }`.

**Acceptance criteria**
- Endpoints require auth, honour idempotency (ingestion_id), and redact sensitive fields in logs.
- Processing step enforces JSON Schema validation; failures surface in `errors` array and observability counters.
- Publish step leaves system consistent even on retry or partial failure (transactional rollback).

### PH4 – Merchant UI workflow

**Objectives**
- Enable merchants to upload menus, review extracted items, and publish updates without leaving the PWA.

**Deliverables**
- Upload screen `apps/web/src/app/(merchant)/merchant/menu/upload/page.tsx`: drag-and-drop picker, file guards, status/progress UI. Calls `ingest_menu_start`, streams file to signed URL, initiates processing.
- Draft review screen `apps/web/src/app/(merchant)/merchant/menu/review/[ingestion_id]/page.tsx`: page thumbnails, editable table for items (price, description, allergens, tags, is_alcohol, confidence). Supports merging with existing catalogue items and flagging anomalies (missing price, high price).
- Menu hub `apps/web/src/app/(merchant)/merchant/menu/page.tsx`: list active ingestions with statuses (`uploaded`, `processing`, `awaiting_review`, `failed`) and entry points to upload/review.
- Persist review edits back to staging tables via Edge Function or Supabase RPC.

**Acceptance criteria**
- Merchant can complete Upload → Process → Review → Publish flow with immediate reflectivity in live menu.
- Confidence filters and anomaly flags function; high price items require explicit confirmation before publish.

### PH5 – Agents & AI integration

**Objectives**
- Wire OpenAI Responses API with structured outputs and provide guidance for batch processing.

**Deliverables**
- Integrate OpenAI SDK within `ingest_menu_process` using strict `menu_schema`; reject or retry on schema violations, log page-level errors without exposing raw media URLs.
- Propagate confidence from model output to staging rows; never fabricate allergens/prices when missing—leave unset and lower confidence.
- Design note (README or `docs/`) covering Batch API usage for large menus: cost estimates, latency trade-offs, and switching instructions.

**Acceptance criteria**
- All stored JSON conforms to `menu_schema`; validation tests cover happy-path and failure modes.
- Confidence scoring visible in UI and metrics.
- Batch processing guidance reviewed with agents team.

### PH6 – Validation, idempotency, and safety

**Objectives**
- Guarantee safe retries, sanity checks, and privacy-respecting observability.

**Deliverables**
- Idempotency keyed on `ingestion_id` across all functions; reruns replace staging data without duplicating rows.
- Price sanity rules: flag unusually high values relative to location/menu norms; require manual confirmation before publish.
- Allergen policy: never invent allergens; mark low-confidence extractions with `confidence < OCR_MIN_CONFIDENCE` and highlight for review.
- Logging redaction: strip storage URLs/filenames, include only `ingestion_id`, `tenant_id`, aggregate metrics.

**Acceptance criteria**
- Reprocessing an ingestion yields consistent results without duplicates.
- Logs contain no PII, secrets, or raw file paths.
- Publish is blocked until flagged issues resolved or acknowledged.

### PH7 – Tests & observability

**Objectives**
- Provide automated coverage and telemetry for ingestion quality and performance.

**Deliverables**
- Unit tests for dedupe/merge utilities, schema validator, price conversions (`tests/` or `apps/web/__tests__`).
- E2E tests simulating merchant upload→publish flow with mocked OpenAI responses (e.g., Playwright + MSW).
- Load/latency tests for Edge Functions to validate OCR scaling (consider k6/Deno benchmarks).
- Observability hooks emitting events: `ingestion.started`, `ingestion.processed`, `ingestion.awaiting_review`, `ingestion.published`, `ingestion.failed`; counters for `pages_processed`, `items_extracted`, `items_conf_ge_0_8` (Expose via `agents-service/src/observability.ts` or Supabase logs).

**Acceptance criteria**
- Dashboards highlight throughput, confidence distribution, and failure rates; alarms configured for sustained failures.
- Tests run in CI with OpenAI mocked to avoid external dependencies.

### JSON schema reference

```json
{
  "name": "menu_schema",
  "strict": true,
  "schema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["currency", "categories"],
    "properties": {
      "currency": { "type": "string", "minLength": 3, "maxLength": 3 },
      "categories": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["name", "items"],
          "properties": {
            "name": { "type": "string", "minLength": 1 },
            "items": {
              "type": "array",
              "items": {
                "type": "object",
                "required": ["name", "price", "currency"],
                "properties": {
                  "name": { "type": "string", "minLength": 1 },
                  "description": { "type": "string" },
                  "price": { "type": "number", "minimum": 0 },
                  "currency": { "type": "string", "minLength": 3, "maxLength": 3 },
                  "allergens": { "type": "array", "items": { "type": "string" } },
                  "is_alcohol": { "type": "boolean" },
                  "tags": { "type": "array", "items": { "type": "string" } },
                  "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### Final sign-off checklist
- [ ] Migration applied with RLS/policies verified.
- [ ] Storage buckets live with documented policies.
- [ ] Edge Functions deployed; idempotency tests passing.
- [ ] Merchant UI upload/review/publish E2E green.
- [ ] Structured Outputs validation enforced; failure handling tested.
- [ ] Metrics dashboards tracking ingestion health.

## Milestone review gates

1. **M0 (Phase 3 complete)** – Diner MVP usable offline with table sessions and compliance UI cues.
2. **M1 (Phase 5 complete)** – Payments + receipts pipelines working end-to-end in staging.
3. **M2 (Phase 8 complete)** – Merchant/Admin portals functional with AI configuration and compliance dashboards.
4. **M3 (Phase 10 complete)** – All automated tests, load, and security checks green; runbooks signed off.
5. **GA (Phase 11 complete)** – Production rollout executed with monitoring, on-call, and regulatory artefacts delivered.

Adhering to this plan positions ICUPA for a confident, compliant launch across Rwanda and Malta while preserving room for iterative AI enhancements and future region expansions.
