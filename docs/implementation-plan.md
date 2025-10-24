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

#### Suggested tasks
- Harden fiscal connectors and queue retries to keep receipt issuance within the ≤5s target. ([Start task](https://github.com/icupa/icupa/issues/new?title=P0%3A%20Close%20fiscal%20connector%20blockers&body=##%20Summary%0AComplete%20the%20fiscal%20connector%20work%20outlined%20in%20the%20P0%20section%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Receipts%20issue%20within%205s%20p95%0A-%20Retries%20and%20poison%20queue%20handling%20validated.))
- Implement MoMo/Airtel idempotency, duplicate guards, and regression coverage across payment functions. ([Start task](https://github.com/icupa/icupa/issues/new?title=P0%3A%20Stabilise%20mobile%20money%20integrations&body=##%20Summary%0AHarden%20the%20MoMo/Airtel%20workflows%20described%20in%20P0%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Idempotency%20keys%20persisted%0A-%20Duplicate%20guards%20exercised%0A-%20CI%20coverage%20updated.))
- Wire AI guardrails, agent timeouts, and compliance disclosures before moving beyond the critical blocker gate. ([Start task](https://github.com/icupa/icupa/issues/new?title=P0%3A%20Activate%20AI%20guardrails%20and%20disclosures&body=##%20Summary%0AComplete%20the%20AI%20safety%20and%20disclosure%20tasks%20from%20the%20P0%20section%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Guardrails%20block%20allergen/age%20violations%0A-%20Admin%20kill-switch%20hooks%20tested.))

### P1 – Canary 10% (Week 3)

- Stand up offline fallback navigation with Workbox strategies and verify Perf Budgets via Lighthouse CI (`lighthouserc.json`).
- Enforce Lighthouse gating in CI to block regressions on LCP/CLS/TTI before widening rollout.
- Instrument OpenTelemetry spans across the agents service and Supabase functions, exporting into Grafana dashboards that surface payments, agents, and fiscal receipt latency trends.
- Publish runbooks (payments, fiscal, AI kill switch) directly inside the admin console so the canary rotation can self-serve.
- Gate promotion on checkout success ≥99.5% and fiscal failure rate <0.5% over a continuous 72-hour staging window.

#### Suggested tasks
- Build and verify offline navigation plus perf budgets before enabling the 10% canary. ([Start task](https://github.com/icupa/icupa/issues/new?title=P1%3A%20Ship%20offline%20navigation%20and%20perf%20budgets&body=##%20Summary%0AImplement%20the%20offline%20fallback%20and%20performance%20budget%20work%20listed%20in%20P1%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Workbox%20strategies%20validated%0A-%20Lighthouse%20budgets%20enforced.))
- Add OpenTelemetry instrumentation and dashboards required for the canary gate. ([Start task](https://github.com/icupa/icupa/issues/new?title=P1%3A%20Instrument%20telemetry%20for%20canary%20rollout&body=##%20Summary%0AImplement%20the%20Grafana%20dashboards%20and%20OTel%20instrumentation%20from%20P1%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Dashboards%20show%20payments%20and%20receipt%20latency%0A-%20Trace%20coverage%20documented.))
- Surface the payments/fiscal/AI runbooks in the admin console and confirm the staging SLO gate. ([Start task](https://github.com/icupa/icupa/issues/new?title=P1%3A%20Expose%20runbooks%20and%20verify%20SLO%20gate&body=##%20Summary%0APublish%20the%20runbooks%20and%20validate%20the%20SLO%20gate%20requirements%20described%20in%20P1%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Runbooks%20visible%20in%20admin%0A-%2072h%20metrics%20captured.))

### P2 – Scale 50→100% (Weeks 4–5)

- Finish promo and inventory control agents with guardrails (budget caps, fairness constraints) and expose configuration in the admin portal.
- Operationalise reconciliation by activating the daily pg_cron jobs in `supabase/functions/reconciliation` and piping reports to `artifacts/reconciliation/` for finance review.
- Complete refund/void flows across Supabase functions, agents service, and admin UI; ensure asynchronous updates reconcile with payment provider states.
- Observe SLO stability for seven consecutive days with live alerts; resolve any anomalies surfaced by Grafana dashboards.
- Validate promo guardrails and inventory resiliency via scripted chaos tests in `tests/chaos/`.

#### Suggested tasks
- Launch promo and inventory guardrail agents with the required admin controls. ([Start task](https://github.com/icupa/icupa/issues/new?title=P2%3A%20Activate%20promo%20and%20inventory%20guardrails&body=##%20Summary%0ABuild%20the%20promo%20and%20inventory%20agent%20capabilities%20from%20P2%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Guardrails%20configurable%20in%20admin%0A-%20Runtime%20caps%20enforced.))
- Turn on reconciliation cron jobs and deliver finance-ready daily reports. ([Start task](https://github.com/icupa/icupa/issues/new?title=P2%3A%20Operationalise%20reconciliation%20jobs&body=##%20Summary%0AEnable%20the%20reconciliation%20pipelines%20noted%20in%20P2%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20pg_cron%20jobs%20running%0A-%20Reports%20stored%20in%20artifacts/reconciliation.))
- Finalise refund/void flows and confirm seven-day SLO stability before scaling to 100%. ([Start task](https://github.com/icupa/icupa/issues/new?title=P2%3A%20Complete%20refund%20flows%20and%20SLO%20validation&body=##%20Summary%0AComplete%20the%20refund/void%20work%20and%20SLO%20monitoring%20from%20P2%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Refund%20flows%20synced%20with%20providers%0A-%20Seven-day%20SLO%20evidence.))

### P3 – Post-GA Hardening (Ongoing)

- Finalise the voice waiter readiness assessment and decide on opt-in launch scope; provide fallback scripts and staff training materials.
- Schedule and execute chaos/load drills each quarter, capturing learnings in `docs/runbooks/chaos-drill.md` and updating on-call procedures.
- Maintain an active DPIA cadence using `docs/compliance/dpia-schedule.md`; ensure data processors are logged and review uptake is tracked.
- Pursue cost optimisation initiatives: model tiering for agents, asset/image pipeline tuning, and scheduled pruning of inactive embeddings.
- Keep the post-GA backlog groomed with security patch tracking, dependency updates, and conservative feature expansion.

#### Suggested tasks
- Complete the voice waiter readiness assessment and publish training collateral. ([Start task](https://github.com/icupa/icupa/issues/new?title=P3%3A%20Voice%20waiter%20readiness%20sign-off&body=##%20Summary%0AFinalise%20the%20voice%20waiter%20assessment%20from%20P3%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Opt-in%20scope%20documented%0A-%20Fallback%20scripts%20ready.))
- Run quarterly chaos/load drills and capture outcomes in the referenced runbooks. ([Start task](https://github.com/icupa/icupa/issues/new?title=P3%3A%20Execute%20chaos%20and%20load%20drills&body=##%20Summary%0ASchedule%20and%20record%20the%20chaos/load%20drills%20described%20in%20P3%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Drill%20notes%20saved%0A-%20On-call%20procedures%20updated.))
- Maintain DPIA cadence and drive cost optimisation experiments post-GA. ([Start task](https://github.com/icupa/icupa/issues/new?title=P3%3A%20Sustain%20DPIA%20and%20cost%20optimisation&body=##%20Summary%0AOwn%20the%20P3%20DPIA%20and%20cost%20optimisation%20actions%20from%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20DPIA%20schedule%20kept%0A-%20Cost%20savings%20tracked.))

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

### Suggested tasks
- Stand up the Supabase stack locally and document the bootstrap steps. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%200%3A%20Provision%20local%20Supabase%20stack&body=##%20Summary%0AExecute%20the%20Phase%200%20bootstrap%20steps%20from%20docs/implementation-plan.md%2C%20including%20Supabase%20startup%20and%20seeding.%0A%0A##%20Acceptance%20criteria%0A-%20supabase%20start%20%2B%20reset%20succeeds%0A-%20Seed%20script%20completes%0A-%20Documentation%20updated.))
- Verify workspace scripts (`npm run dev`, CI scaffolding) align with the quick-start instructions. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%200%3A%20Validate%20workspace%20tooling&body=##%20Summary%0AConfirm%20the%20workspace%20tooling%20outlined%20in%20Phase%200%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20npm%20run%20dev%20works%0A-%20CI%20pipelines%20execute%0A-%20Agents%20service%20health%20check%20passes.))
- Produce environment templates for the monorepo and agents service with placeholder secrets. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%200%3A%20Publish%20environment%20templates&body=##%20Summary%0ACreate%20and%20verify%20the%20environment%20templates%20referenced%20in%20Phase%200%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20.env.example%20files%20present%0A-%20Placeholders%20validated.))

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

### Suggested tasks
- Review and land the Phase 1 migration/RLS changes with additive-only diffs. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%201%3A%20Land%20database%20migrations%20and%20RLS&body=##%20Summary%0AComplete%20the%20Phase%201%20database%20and%20RLS%20deliverables%20from%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Migrations%20approved%0A-%20RLS%20tests%20green.))
- Implement the embeddings refresh function and schedule described in this phase. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%201%3A%20Ship%20embedding%20refresh%20flow&body=##%20Summary%0ABuild%20the%20embedding%20refresh%20function%20outlined%20in%20Phase%201%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Edge%20function%20deployed%0A-%20pg_cron%20schedule%20configured%0A-%20Vectors%20populated.))
- Extend SQL regression coverage to validate search relevance against the new vectors. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%201%3A%20Add%20search%20regression%20tests&body=##%20Summary%0AImplement%20the%20search%20regression%20coverage%20referenced%20in%20Phase%201%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Cosine%20similarity%20tests%20passing%0A-%20Artefacts%20saved%20to%20artifacts/phase1.))

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

### Suggested tasks
- Deliver the signed QR session creation flow end-to-end, including admin reissue tools. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%202%3A%20Complete%20QR%20session%20flow&body=##%20Summary%0AImplement%20the%20QR%20session%20journey%20captured%20in%20Phase%202%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Edge%20function%20and%20client%20hooks%20wired%0A-%20Admin%20reissue%20tool%20live.))
- Expand RLS regression tests to protect session isolation. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%202%3A%20Extend%20RLS%20session%20coverage&body=##%20Summary%0AAdd%20the%20RLS%20tests%20referenced%20in%20Phase%202%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Isolation%20tests%20passing%0A-%20Artefacts%20stored%20for%20audit.))
- Capture mobile QA evidence and notes in the designated Phase 2 directories. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%202%3A%20Record%20mobile%20QA%20artefacts&body=##%20Summary%0ADocument%20the%20mobile%20QA%20artefacts%20described%20in%20Phase%202%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Evidence%20saved%20to%20artifacts/phase2%0A-%20Notes%20logged%20under%20docs/outsourcing/notes.))

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

### Suggested tasks
- Build the diner browsing/cart/pay skeleton with accessibility baked in. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%203%3A%20Deliver%20diner%20PWA%20skeleton&body=##%20Summary%0AImplement%20the%20diner%20surface%20outlined%20in%20Phase%203%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Menu%2C%20detail%2C%20cart%20surfaces%20ready%0A-%20Accessibility%20scans%20pass.))
- Hook the pay placeholder to future payment integrations while respecting UI requirements. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%203%3A%20Wire%20pay%20placeholder&body=##%20Summary%0ABuild%20the%20Phase%203%20pay%20placeholder%20per%20docs/implementation-plan.md%20while%20prepping%20for%20later%20payment%20work.%0A%0A##%20Acceptance%20criteria%0A-%20Placeholder%20integrates%20future%20hooks%0A-%20UI%20meets%20design%20notes.))
- Complete the Phase 3 diner readiness checklist and archive evidence. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%203%3A%20Sign%20off%20diner%20readiness&body=##%20Summary%0ACollect%20and%20store%20the%20Phase%203%20readiness%20artefacts%20mentioned%20in%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Checklist%20signed%20off%0A-%20Artefacts%20linked%20from%20runbook.))

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

### Suggested tasks
- Finalise the Stripe/Adyen checkout and webhook handlers through capture. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%204%3A%20Complete%20card%20payment%20flows&body=##%20Summary%0AImplement%20the%20card%20payment%20functions%20described%20in%20Phase%204%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Checkout%20session%20and%20webhook%20wired%0A-%20Orders%20and%20payments%20sync.))
- Deliver mobile money request-to-pay stubs with webhook receivers and TODO scaffolding. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%204%3A%20Ship%20mobile%20money%20stubs&body=##%20Summary%0ABuild%20the%20mobile%20money%20functions%20highlighted%20in%20Phase%204%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Request-to-pay%20stub%20live%0A-%20Webhook%20handlers%20logging%20TODOs.))
- Update documentation for environment variables, queue helpers, and PSP onboarding. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%204%3A%20Document%20payment%20integration%20steps&body=##%20Summary%0ARefresh%20the%20docs%20described%20in%20Phase%204%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20README%20sections%20updated%0A-%20Onboarding%20steps%20captured.))

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

### Suggested tasks
- Build the receipt issuance Edge Functions and pipeline scaffolding. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%205%3A%20Implement%20receipt%20pipeline&body=##%20Summary%0ADeliver%20the%20receipt%20issuance%20flow%20outlined%20in%20Phase%205%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Edge%20functions%20return%20payloads%0A-%20Queue%20integration%20verified.))
- Expose receipt viewing/reprint features in the merchant UI. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%205%3A%20Ship%20receipt%20management%20UI&body=##%20Summary%0AImplement%20the%20merchant%20receipt%20tools%20listed%20in%20Phase%205%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20UI%20supports%20view/reprint%0A-%20Error%20remediation%20documented.))
- Draft downtime/incident runbooks for Rwanda and Malta fiscal channels. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%205%3A%20Author%20fiscal%20runbooks&body=##%20Summary%0AWrite%20the%20fiscal%20downtime%20runbooks%20referenced%20in%20Phase%205%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Runbooks%20cover%20Rwanda%20and%20Malta%0A-%20Escalation%20paths%20defined.))

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

### Suggested tasks
- Implement the multi-agent definitions and guardrails described for Phase 6. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%206%3A%20Implement%20agents%20service%20v1&body=##%20Summary%0ABuild%20the%20agents%20and%20guardrails%20outlined%20in%20Phase%206%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Agents%20handle%20queries%0A-%20Guardrails%20log%20breaches.))
- Wire retrieval collections and telemetry storage for agent interactions. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%206%3A%20Complete%20retrieval%20and%20telemetry&body=##%20Summary%0AConnect%20the%20retrieval%20collections%20and%20telemetry%20pipelines%20from%20Phase%206%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Collections%20fresh%0A-%20agent_events%20populated.))
- Expose admin kill switches and budget controls for each agent class. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%206%3A%20Add%20agent%20governance%20controls&body=##%20Summary%0AImplement%20the%20admin%20controls%20noted%20in%20Phase%206%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Kill-switch%20UI%20available%0A-%20Budgets%20observable.))

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

### Suggested tasks
- Build the KDS and floor management experiences for merchants. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%207%3A%20Deliver%20KDS%20and%20floor%20management&body=##%20Summary%0AImplement%20the%20merchant%20portal%20features%20called%20out%20in%20Phase%207%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Realtime%20orders%20visible%0A-%20Floor%20states%20editable.))
- Ship the menu manager with AI-assisted copy review flow. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%207%3A%20Launch%20menu%20manager&body=##%20Summary%0ABuild%20the%20menu%20manager%20UI%20outlined%20in%20Phase%207%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20AI%20suggestions%20require%20approval%0A-%20Audit%20trail%20persisted.))
- Implement the promo builder workflow with guardrail parameters. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%207%3A%20Enable%20promo%20builder&body=##%20Summary%0ADevelop%20the%20promo%20builder%20described%20in%20Phase%207%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Bandit%20parameters%20stored%0A-%20Runtime%20caps%20enforced.))

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

### Suggested tasks
- Implement the tenant onboarding wizard with automated Supabase provisioning. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%208%3A%20Build%20tenant%20onboarding%20wizard&body=##%20Summary%0AComplete%20the%20onboarding%20wizard%20from%20Phase%208%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Tenants%20and%20roles%20provisioned%0A-%20Seeded%20menu%20available.))
- Deliver the AI configuration UI and propagation pipeline. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%208%3A%20Ship%20AI%20config%20console&body=##%20Summary%0ABuild%20the%20AI%20settings%20experience%20outlined%20in%20Phase%208%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Agent%20configs%20update%0A-%20Audit%20trail%20recorded.))
- Surface compliance dashboards and DSR tooling required for go-live. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%208%3A%20Launch%20compliance%20dashboards&body=##%20Summary%0AImplement%20the%20compliance%20panels%20described%20in%20Phase%208%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20KPIs%20visible%0A-%20DSR%20entry%20points%20linked.))

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

### Suggested tasks
- Implement offline caching, background sync queues, and service worker hooks. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%209%3A%20Deliver%20offline%20and%20sync%20capabilities&body=##%20Summary%0ABuild%20the%20offline%20and%20background%20sync%20features%20outlined%20in%20Phase%209%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Workbox%20strategies%20live%0A-%20Background%20sync%20tests%20pass.))
- Wire push notification subscription and sending flows end-to-end. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%209%3A%20Enable%20web%20push%20flows&body=##%20Summary%0AImplement%20the%20push%20subscription%20and%20send%20functions%20listed%20in%20Phase%209%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Subscriptions%20stored%0A-%20Sample%20push%20delivered.))
- Capture outsourced offline QA artefacts in the prescribed locations. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%209%3A%20Archive%20offline%20QA%20artefacts&body=##%20Summary%0ACollect%20the%20Phase%209%20offline%20QA%20evidence%20referenced%20in%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Artifacts/phase9%20populated%0A-%20Tests/offline%20assets%20updated.))

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

### Suggested tasks
- Build the Playwright, k6, and security coverage needed for launch readiness. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%2010%3A%20Deliver%20test%2C%20load%2C%20and%20security%20coverage&body=##%20Summary%0AImplement%20the%20testing%2C%20load%2C%20and%20security%20tracks%20from%20Phase%2010%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Playwright%20suite%20green%0A-%20k6%20budgets%20met%0A-%20Security%20review%20signed%20off.))
- Automate incident response runbooks and ensure they are referenced in tooling. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%2010%3A%20Automate%20incident%20runbooks&body=##%20Summary%0AConnect%20the%20incident%20runbooks%20from%20Phase%2010%20of%20docs/implementation-plan.md%20into%20operational%20tooling.%0A%0A##%20Acceptance%20criteria%0A-%20Runbooks%20linked%20in%20admin%0A-%20Drill%20results%20tracked.))
- Coordinate outsourced QA/security partners and store artefacts per playbook. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%2010%3A%20Coordinate%20vendor%20deliverables&body=##%20Summary%0AEnsure%20the%20Phase%2010%20vendor%20artefacts%20land%20in%20the%20directories%20specified%20in%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Artifacts/phase10%20updated%0A-%20Security%20archive%20complete.))

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

### Suggested tasks
- Finalise feature flag rollout plans and automation for each launch lever. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%2011%3A%20Finalise%20feature%20flag%20rollout&body=##%20Summary%0AImplement%20the%20feature%20flag%20controls%20documented%20in%20Phase%2011%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Flags%20mapped%20to%20tenants%0A-%20Rollback%20scripts%20ready.))
- Execute the canary ramp plan and capture monitoring evidence. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%2011%3A%20Run%20canary%20ramp&body=##%20Summary%0ACarry%20out%20the%20Phase%2011%20canary%20plan%20from%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Canary%2010%E2%86%9250%E2%86%92100%25%20documented%0A-%20Monitoring%20screenshots%20saved.))
- Publish launch comms, on-call schedules, and monitoring dashboards in the admin console. ([Start task](https://github.com/icupa/icupa/issues/new?title=Phase%2011%3A%20Publish%20launch%20operations%20hub&body=##%20Summary%0AShare%20the%20launch%20communications%2C%20on-call%20matrix%2C%20and%20dashboards%20outlined%20in%20Phase%2011%20of%20docs/implementation-plan.md.%0A%0A##%20Acceptance%20criteria%0A-%20Admin%20console%20sections%20populated%0A-%20Stakeholder%20sign-off%20recorded.))

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
