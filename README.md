# ICUPA – Multi-Vendor Dine-In PWA (Rwanda & Malta)

ICUPA is a three-surface, multi-tenant Progressive Web Application that powers diner, merchant, and admin experiences for in-venue ordering across Rwanda and Malta. The codebase is a Vite + React workspace that currently focuses on the diner surface while exposing shared design primitives, Supabase integration helpers, and agent-ready UI shells. This README documents how to work with the repository today and summarises the product, compliance, and AI guardrails that guide ongoing implementation.

---

## Repository structure

```
├── public/                    # Static assets consumed by the PWA shell
├── src/                       # React application code
│   ├── components/            # Shared UI building blocks (client, merchant, admin shells)
│   ├── integrations/          # Supabase client + typed helpers
│   ├── hooks/                 # Reusable React hooks
│   ├── lib/                   # Utility modules (formatters, motion helpers, etc.)
│   └── pages/                 # Route-level entry points wired through react-router
├── agents-service/            # Fastify-based service for OpenAI agent endpoints (Phase 0 health check only)
├── supabase/
│   ├── migrations/            # SQL migrations applied during `supabase db reset`
│   ├── seed/                  # Seed data to exercise diner shell flows
│   └── functions/             # Edge Function sources (stubs during Phase 0)
├── package.json               # Workspace scripts and dependencies
├── vite.config.ts             # Vite tooling & alias configuration
└── .env.example               # Template for local environment variables
```

---

## Getting started

1. **Install prerequisites**
   - Node.js 20+
   - npm 10+ (or pnpm/yarn if preferred)

2. **Bootstrap environment variables**
   - Copy `.env.example` to `.env.local` (ignored by Git) and provide the Supabase project details you intend to use.
   - Copy `agents-service/.env.example` to `agents-service/.env` when running the OpenAI Agents service locally.

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Start Supabase locally**
   ```bash
   supabase start
   supabase db reset
   supabase db execute --file supabase/seed/seed.sql
   ```
   These commands provision the Dockerised Supabase stack, apply the Phase 0 + Phase 1 migrations, and seed demo data covering
   tenants, locations, menus, table sessions, orders, and agent telemetry. The Phase 1 migration introduces pgvector-powered
   embeddings, hardened RLS policies, and staff role helpers.

5. **Validate database policies and semantic search**
   ```bash
   supabase db test
   ```
   The SQL tests in `supabase/tests` assert that diners bound by the `x-icupa-session` header cannot read other table orders,
   that staff with tenant roles can, and that cosine similarity queries surface the correct item using the seeded embeddings.

6. **Run the development server**
   ```bash
   npm run dev
   ```
   The application is served at `http://localhost:5173/` by default. Hot module reload is enabled through Vite.

7. **(Optional) Start the agents service**
   ```bash
   cd agents-service
   npm install
   npm run dev
   ```
   The Fastify instance listens on `http://localhost:8787/` by default. In addition to `/health`, the service now exposes `POST /agents/waiter`, which orchestrates the waiter → allergen guardian → upsell agents via the OpenAI Agents SDK. Requests accept the diner message alongside optional `table_session_id`, `tenant_id`, `location_id`, declared allergens, cart context, and an existing `session_id`. Responses include the grounded reply, filtered upsell suggestions (with citation tokens), and any allergen disclaimers. Override the port via `AGENTS_PORT` inside `agents-service/.env`.

   > ℹ️  The agents service honours kill switches and spend caps defined in `agent_runtime_configs`. Defaults can be tuned via `AGENT_SESSION_BUDGET_USD` and `AGENT_DAILY_BUDGET_USD` in `.env`.

8. **Lint the project** (optional but recommended before submitting patches)
   ```bash
   npm run lint
   ```

9. **Type-check the project**
   ```bash
   npm run typecheck
   ```

---

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | ✅ | URL for your Supabase project. It is injected into the generated Supabase client and must match the project you plan to target. |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key used by the browser client. Store the matching service role key only in secure server-side environments (Edge Functions, agents service, etc.). |
| `VITE_AGENTS_SERVICE_URL` | ➖ | Optional URL for the agent orchestration service. Configure when connecting the UI to OpenAI-powered agents. |
| `VITE_VAPID_PUBLIC_KEY` | ➖ | VAPID public key used to register web push subscriptions from the PWA. Generate a matching private key and store it securely in Supabase for outbound delivery. |
| `VITE_CARD_PAYMENTS_PROVIDER` | ➖ | Selects the card processor (`stripe` or `adyen`) the diner UI should invoke. Defaults to `stripe` and can be switched per environment when Adyen links are available. |

### Supabase secrets for Edge Functions

Configure the following secrets in the Supabase dashboard (or via `supabase secrets set`) before deploying the payments Edge Functions. All values should be scoped per environment (dev, staging, prod):

| Secret | Required | Description |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | ✅ (EU) | Stripe secret key used by the checkout Edge Function. Generate a restricted key with write access to PaymentIntents/Checkout Sessions. |
| `STRIPE_WEBHOOK_SECRET` | ✅ (EU) | Signing secret for the Stripe webhook (`payments/stripe/webhook`). |
| `STRIPE_ACCOUNT_ID` | ➖ | Optional. Set when using Stripe Connect to route payments through a connected account. |
| `ADYEN_API_KEY` | ✅ (EU) | API key for Adyen Checkout. Required before enabling Adyen payment links. |
| `ADYEN_MERCHANT_ACCOUNT` | ✅ (EU) | Merchant account identifier passed to Adyen Checkout requests. |
| `ADYEN_ENVIRONMENT` | ➖ (EU) | Set to `live` when using production credentials; defaults to `test`. |
| `ADYEN_CHECKOUT_VERSION` | ➖ (EU) | Override the Adyen Checkout API version (defaults to `v71`). |
| `ADYEN_WEBHOOK_HMAC_KEY` | ➖ (EU) | Optional HMAC secret for validating Adyen webhook signatures. |
| `MOMO_CLIENT_ID` / `MOMO_CLIENT_SECRET` | ➖ (RW) | Credentials for the MTN MoMo API. The current implementation logs a TODO until live credentials are available. |
| `MOMO_API_BASE` | ➖ (RW) | Override the MTN MoMo API base URL (defaults to the sandbox). |
| `MOMO_WEBHOOK_SECRET` | ➖ (RW) | Shared secret used to validate MTN MoMo webhook callbacks. |
| `AIRTEL_KEY` / `AIRTEL_SECRET` | ➖ (RW) | Credentials for Airtel Money collections. Required before enabling live requests. |
| `AIRTEL_WEBHOOK_SECRET` | ➖ (RW) | Shared secret for Airtel Money webhook validation. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Required so the Edge Functions can create orders/payments with service-role privileges. |
| `SUPABASE_FUNCTIONS_URL` | ➖ | Optional override for the Edge Functions domain. Defaults to the derived `https://<project>.functions.supabase.co` host; set explicitly when running behind a custom gateway. |
| `TABLE_QR_ADMIN_SECRET` | ➖ | Bearer token required by `admin/reissue_table_qr` when rotating table QR payloads. |
| `ADMIN_ONBOARDING_SECRET` | ➖ | Bearer token required by `admin/onboard_tenant` to create tenants, locations, and default agent settings. |

Environment variables are consumed via `import.meta.env` and validated during module initialisation. Missing required values will throw explicit errors to prevent accidental usage of leaked credentials at build time.【F:src/integrations/supabase/client.ts†L1-L24】

---

## Available npm scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Starts the Vite development server. |
| `npm run build` | Builds an optimised production bundle. |
| `npm run build:dev` | Produces a development-mode build artefact. |
| `npm run preview` | Serves the production bundle locally for smoke testing. |
| `npm run lint` | Runs ESLint across the repository. |
| `npm run supabase:test` | Executes the SQL regression suite in `supabase/tests` via the Supabase CLI. |
| `npm run test` | Runs the Vitest suite, including offline cart persistence checks. |
| `npm run test:accessibility` | Audits the Phase 3 diner surfaces with axe-core to keep WCAG 2.2 AA regressions from slipping into the PWA. |

Scripts are defined in `package.json` alongside the curated dependency set (React 18, Radix UI, Tailwind, Framer Motion, Supabase client SDK, TanStack Query, etc.).【F:package.json†L1-L61】

---

## Supabase integration notes

- The Supabase browser client is created in `src/integrations/supabase/client.ts`. It now reads credentials from environment variables instead of hard-coded keys and automatically forwards the active `x-icupa-session` header for every REST call so diner-scoped RLS policies remain effective.【F:src/integrations/supabase/client.ts†L1-L34】【F:src/lib/table-session.ts†L1-L47】
- Generated types (see `src/integrations/supabase/types.ts`) keep interactions type-safe. When the schema evolves, regenerate types with the Supabase CLI (`supabase gen types typescript --schema public`).
- Persisted sessions rely on `localStorage` when running in the browser. When rendering on the server, the storage adapter gracefully degrades to `undefined`, matching Supabase's SSR recommendations.【F:src/integrations/supabase/client.ts†L16-L23】

### Phase 1 database checklist

With the Supabase CLI installed, ensure the local instance passes the new RLS and semantic search assertions:

```bash
supabase start
supabase db reset
supabase db execute --file supabase/seed/seed.sql
supabase db test
```

The migrations create enums, helper functions, ivfflat indexes, and row-level security policies spanning diners (by `x-icupa-session`) and staff (via `user_roles`). Identity tables (`profiles`, `user_roles`) now enforce RLS so diners can only edit their own profile while tenant managers review assignments scoped to their venues, with coverage in [`supabase/tests/rls_identity.sql`](supabase/tests/rls_identity.sql). Session-bound queries are locked down through [`supabase/tests/rls_orders.sql`](supabase/tests/rls_orders.sql) and the new [`supabase/tests/rls_table_sessions.sql`](supabase/tests/rls_table_sessions.sql), which verify diners can only see their active session and that direct inserts remain restricted to the service role. Seeds provision demo users, menus, items with deterministic embeddings, and sample agent telemetry so the SQL regression tests can execute.

- **Outsourcing playbook** – External database specialists follow [`docs/outsourcing/phase1-outsourcing.md`](docs/outsourcing/phase1-outsourcing.md) to review migrations, run RLS regressions, and rehearse embedding refreshes. Artefacts land in `artifacts/phase1/*` with meeting notes stored under `docs/outsourcing/notes/` so Phase 1 owners can audit deliverables.

### Embedding refresh Edge Function

`supabase/functions/menu/embed_items` calls OpenAI's embeddings API (`text-embedding-3-large` by default) to populate or refresh item vectors in batches. It accepts optional `item_ids` and `force` flags via JSON body and honours a `limit` query parameter (default 32). Configure `OPENAI_API_KEY` (and optionally `OPENAI_EMBEDDING_MODEL`) in the Supabase dashboard before deploying, then trigger with:

```bash
supabase functions deploy menu/embed_items
supabase functions invoke menu/embed_items --project-ref <ref> --no-verify-jwt
```

The follow-up migration registers an hourly pg_cron job (`menu_embed_items_hourly`) that invokes the Edge Function so vectors stay fresh without manual intervention. The target URL lives in `public.scheduler_config` under the `menu_embed_items_url` key—by default it points at the local Supabase stack (`http://host.docker.internal:54321/functions/v1/menu/embed_items`). Override it in hosted environments after deploying the function:

```sql
update public.scheduler_config
set value = 'https://<project-ref>.functions.supabase.co/menu/embed_items'
where key = 'menu_embed_items_url';
```

The helper raises a notice instead of failing when the URL is blank, making it safe to temporarily disable the job during maintenance windows.

The ivfflat index on `items.embedding` (lists=100) accelerates cosine similarity queries used by the diner shell's semantic search and agent recommendation tooling.

### Menu search Edge Function & SQL RPC

- `supabase/migrations/20240330000010_phase1_search_function.sql` introduces a stable SQL helper, `public.search_menu_items`, that performs cosine-similarity lookups against `items.embedding`, returning the top matches above a configurable score threshold while respecting location/tenant filters.【F:supabase/migrations/20240330000010_phase1_search_function.sql†L1-L43】 Regression coverage in [`supabase/tests/search_menu_items.sql`](supabase/tests/search_menu_items.sql) guarantees the deterministic seed data continues to surface Nyamirambo Chill Brew as the best match for its embedding.【F:supabase/tests/search_menu_items.sql†L1-L33】
- The new Edge Function at `supabase/functions/menu/search_items` accepts diner queries, derives an OpenAI embedding, scopes results to the active table session's tenant/location, and proxies back structured results with similarity scores so the client can display grounded matches without exposing API keys.【F:supabase/functions/menu/search_items/index.ts†L1-L166】 Deploy alongside the embedding refresh worker:

```bash
supabase functions deploy menu/search_items --no-verify-jwt
```

Clients should invoke the function with the `x-icupa-session` header so the lookup scopes to the table's location, e.g.:

```ts
const response = await supabase.functions.invoke('menu/search_items', {
  headers: { 'x-icupa-session': tableSessionId },
  body: { query: 'light cold brew', limit: 6, minScore: 0.58 },
});
```

The response mirrors the SQL helper output and includes the resolved tenant/location context for debugging. The OpenAI model can be tuned through the `OPENAI_EMBEDDING_MODEL` secret shared with the refresh worker, keeping configuration centralised.

### Table session Edge Function & QR tooling

- `supabase/functions/create_table_session` validates signed QR payloads, captures the caller's IP and device fingerprint, and issues a four-hour table session identifier that powers the diner RLS policies. Configure `TABLE_QR_SIGNING_SECRET`, `TABLE_SESSION_TTL_HOURS` (defaults to `4`), and `TABLE_QR_MAX_AGE_MINUTES` (defaults to `15`) as Supabase secrets before deploying the function.【F:supabase/functions/create_table_session/index.ts†L1-L124】
- A hardened `public.current_table_session_id()` helper now re-checks Supabase for the referenced session on every request and returns `NULL` once the four-hour TTL elapses, preventing stale headers from bypassing RLS checks.【F:supabase/migrations/20240331000000_phase2_session_expiry_guard.sql†L1-L46】
- Browser storage keeps the session token in `localStorage` and forwards it via the `x-icupa-session` header on every Supabase request; clearing or expiring the session removes the header automatically.【F:src/lib/table-session.ts†L1-L47】【F:src/integrations/supabase/client.ts†L17-L34】
- The diner client surfaces live badges, toasts, and alerts as the session approaches expiry, giving diners ten minutes of warning and clearing stale IDs to prevent RLS rejections.【F:src/hooks/useTableSession.ts†L12-L167】【F:src/components/client/ClientShell.tsx†L30-L376】
- Rotate QR payloads with the admin-only Edge Function at `supabase/functions/admin/reissue_table_qr`. Supply `TABLE_QR_ADMIN_SECRET` (the bearer token expected by the function) and optionally `TABLE_QR_APP_BASE_URL` so the response includes a shareable `?qr=<token>&sig=<signature>` link.【F:supabase/functions/admin/reissue_table_qr/index.ts†L1-L112】
- **Outsourcing playbook** – Phase 2 vendors follow [`docs/outsourcing/phase2-outsourcing.md`](docs/outsourcing/phase2-outsourcing.md) to rehearse QR key rotations, probe session isolation, and capture mobile QA evidence. Artefacts live in `artifacts/phase2/*` with coordination notes under `docs/outsourcing/notes/` so the core team can audit deliverables.

Deploy and test locally:

```bash
supabase functions deploy create_table_session --no-verify-jwt
supabase functions deploy admin/reissue_table_qr --no-verify-jwt
supabase functions invoke admin/reissue_table_qr \
  --project-ref <ref> \
  --no-verify-jwt \
  --header "Authorization: Bearer $TABLE_QR_ADMIN_SECRET" \
  --body '{"table_id":"00000000-0000-4000-8000-000000000501"}'
```

The React admin stub at `/admin/tools/qr` wraps the reissue endpoint so operations teams can mint new QR payloads without leaving the app. Paste a one-time admin token, submit the table identifier, and copy the refreshed link or payload returned by the tool.【F:src/pages/AdminQrTools.tsx†L1-L119】

### Payments Edge Functions & queueing

- `supabase/functions/payments/stripe/checkout` and `supabase/functions/payments/adyen/checkout` validate the cart payload, bind the order to the active table session, and create either a Stripe Checkout Session or Adyen payment link while persisting provisional order/payment rows.【F:supabase/functions/payments/stripe/checkout/index.ts†L1-L200】【F:supabase/functions/payments/adyen/checkout/index.ts†L1-L187】
- `supabase/functions/payments/stripe/webhook` and `supabase/functions/payments/adyen/webhook` verify provider signatures, mark payments as `captured`, update the linked order, and enqueue fiscalisation jobs via `public.enqueue_fiscalization_job`.【F:supabase/functions/payments/stripe/webhook/index.ts†L1-L87】【F:supabase/functions/payments/adyen/webhook/index.ts†L1-L163】
- Rwandan mobile money flows are stubbed via `payments/momo/request_to_pay` and `payments/airtel/request_to_pay`, which persist pending payments, emit structured events, and return developer-friendly references.【F:supabase/functions/payments/momo/request_to_pay/index.ts†L1-L94】【F:supabase/functions/payments/airtel/request_to_pay/index.ts†L1-L94】 Their companion webhooks accept provider callbacks and transition payments to `captured`/`failed` while logging signature validation results.【F:supabase/functions/payments/momo/webhook/index.ts†L1-L63】【F:supabase/functions/payments/airtel/webhook/index.ts†L1-L60】
- The Phase 4 migration seeds a durable `fiscalization_jobs` queue and exposes `public.enqueue_fiscalization_job(order_uuid uuid, payment_uuid uuid)` so capture handlers can hand off receipt generation work.【F:supabase/migrations/20240226000000_phase4_payments.sql†L1-L25】
- Regression coverage for Phase 4 now includes RLS enforcement and queue payload verification so diners stay isolated and receipts processing consumes well-structured jobs.【F:supabase/tests/payments_rls.sql†L1-L99】【F:supabase/tests/payments_queue.sql†L1-L63】

The diner pay screen now calls these Edge Functions, surfaces pending vs. captured states, and offers a one-tap redirect to the hosted Stripe or Adyen flow when available.【F:src/components/client/PaymentScreen.tsx†L99-L352】 Mobile money stubs remain non-blocking while their production credentials are added.

### Receipts pipeline & runbooks

- `supabase/functions/receipts/process_queue` drains the `fiscalization_jobs` queue, fans out to the regional receipt stubs, persists `public.receipts`, and emits `receipt_issued` events for the UI.【F:supabase/functions/receipts/process_queue/index.ts†L1-L170】
- Payment capture handlers now ping the fiscalisation worker directly after enqueueing jobs so receipts land without waiting for an external scheduler. Override the invocation host with `SUPABASE_FUNCTIONS_URL` when running behind a proxy.【F:supabase/functions/_shared/payments.ts†L38-L119】
- Regional stubs return simulated payloads so integrations can be wired incrementally: `receipts/issue_ebm_rwanda` mirrors RRA EBM 2.1 responses, while `receipts/issue_fiscal_malta` provides placeholders for Malta fiscal signatures.【F:supabase/functions/receipts/issue_ebm_rwanda/index.ts†L1-L75】【F:supabase/functions/receipts/issue_fiscal_malta/index.ts†L1-L75】
- The diner pay screen now watches for receipt inserts and surfaces fiscal IDs, QR guidance, and reprint messaging once the worker completes.【F:src/components/client/PaymentScreen.tsx†L642-L775】
- Merchants can review history, inspect queue health metrics, manually trigger the worker, and follow downtime guidance from `/merchant/receipts`, which consumes the same Supabase data with staff-focused troubleshooting copy.【F:src/pages/MerchantReceipts.tsx†L1-L520】
- Staff can manually requeue failed or skipped fiscalisation jobs via `public.retry_fiscalization_job`, exposed as a retry button in the merchant receipts dashboard so incidents are cleared without service-role credentials.【F:supabase/migrations/20240401000000_phase5_retry_fiscalization_job.sql†L1-L33】【F:src/pages/MerchantReceipts.tsx†L1-L520】
- The queue health card uses the `fiscalization_queue_summary()` RPC to surface counts, oldest wait times, and last error context per status, giving operators immediate insight before running the worker.【F:supabase/migrations/20240402000000_phase5_queue_summary.sql†L1-L49】【F:src/pages/MerchantReceipts.tsx†L1-L520】
- The fiscalisation runbook documents incident detection, recovery, and escalation paths for Rwanda and Malta deployments.【F:docs/runbooks/fiscalization.md†L1-L69】

## Demo data for the client shell

- `src/data/menu.ts` ships with representative Kigali (Rwanda) and Valletta (Malta) menu entries so designers and engineers can exercise the new diner shell without a live Supabase instance.【F:src/data/menu.ts†L1-L210】
- The diner experience uses the dataset to power search, allergen-aware filtering, dietary preferences, and a mobile drawer that explains each dish. When Supabase connectivity is wired, this module becomes the contract for serialising menu responses.
- Currency formatting for Rwanda (RWF) and Malta (EUR) lives in `src/lib/currency.ts`, ensuring price transparency across the UI while we finalise the payment integrations.【F:src/lib/currency.ts†L1-L12】

---

## AI and agent experience roadmap

The UI includes dedicated surfaces for the AI waiter, allergen guardian, and merchant automation flows. As we wire the OpenAI Agents SDK, we will:

1. Register agents (waiter, upsell, inventory, compliance, etc.) inside a dedicated agents service (or Supabase Edge Functions) that consumes Supabase tools and honours guardrails (age gates, allergen blocks, availability filters).
2. Enable retrieval using Supabase collections (`menu`, `allergens`, `policies`) so conversational answers cite menu knowledge cards.
3. Capture telemetry in `agent_sessions` and `agent_events` tables to drive bandit learning, evaluations, and transparency dashboards.
4. Surface per-tenant configuration (instructions, autonomy levels, budgets, experiments) through the admin UI while keeping kill-switches available across regions.

Refer back to this README as the authoritative overview when expanding the agents layer—the document will be updated alongside implementation milestones.

---

## Compliance & operational guardrails

- **Data protection** – Honour GDPR (Malta/EU) and Rwanda DPL by providing regional data routing, opt-outs for personalised upsell, and full data subject tooling (export/delete).
- **Fiscalisation** – Integrate Rwanda EBM 2.1 / Malta fiscal receipt issuance from the merchant surface as part of the post-payment workflow.
- **Food & beverage safety** – Enforce allergen disclosure before checkout and age gates for alcohol (17+ Malta, 18+ Rwanda) with staff override trails.
- **Observability** – Emit OpenTelemetry traces, structured logs (without PII), and targeted KPIs (AOV lift, prep SLA, receipt latency) to sustain the defined service-level objectives.

---

## Roadmap snapshot

| Phase | Focus |
| --- | --- |
| Phase 0 | Local environment bootstrapping (Supabase project, .env configuration, baseline migrations). |
| Phase 1 | Database and RLS hardening plus semantic search scaffolding (pgvector embeddings). |
| Phase 2 | Table QR session flows with secure `x-icupa-session` headers. |
| Phase 3 | Client PWA skeleton (menu → cart → pay placeholder) with liquid-glass aesthetic. |
| Phase 4+ | Payments, fiscalisation, agents, merchant/admin portals, offline/push support, and production rollout gates. |

Each phase builds on the constraints defined in the project brief: performance budgets (LCP ≤ 2.5s), checkout success ≥ 99.5%, fiscal receipt latency ≤ 5s (p95), and hallucination rates ≤ 0.5% for AI-generated content.

> 🔍 **Need deeper detail?** Refer to [`docs/implementation-plan.md`](docs/implementation-plan.md) for a phase-by-phase delivery playbook that maps objectives, deliverables, and acceptance criteria through GA.

---

## Contributing

1. Create a feature branch from `work`.
2. Ensure `npm run lint` passes before committing.
3. Follow the additive-only rule—avoid destructive schema or file moves without coordinated migrations.
4. Submit a PR with a summary of changes, test evidence, and any relevant screenshots (especially for UI work).

For questions about architecture, compliance, or the AI roadmap, start with this README and escalate via the team handbook or the admin console runbooks.

### Phase 3 – Client PWA MVP

Phase 3 unlocks the diner journey from menu discovery to the payment placeholder while keeping the gradient, liquid-glass aesthetic responsive across devices.【F:src/components/client/ClientShell.tsx†L200-L372】 Highlights include:

- **Rich menu exploration** – Category chips, allergen toggles, dietary badges, and semantic search blend Supabase-backed results with Fuse.js fallbacks so diners always see relevant dishes.【F:src/components/client/ClientShell.tsx†L214-L303】【F:src/components/client/MenuFiltersSheet.tsx†L1-L122】【F:src/components/client/MenuGrid.tsx†L1-L168】
- **Transparent dish details** – The drawer surfaces allergens, pairings, prep time, and alcohol guidance alongside locale-aware pricing, reinforcing safety and price transparency requirements.【F:src/components/client/MenuItemDrawer.tsx†L1-L107】【F:src/lib/currency.ts†L1-L12】
- **Persistent cart with splits & tips** – A Zustand store keeps orders, split preferences, and tip amounts across reloads, while the cart UI exposes offline safeguards before handing off to the pay tab.【F:src/stores/cart-store.ts†L80-L140】【F:src/components/client/Cart.tsx†L200-L438】
- **Payment placeholder & AI dock** – The payment screen previews regional methods, queue status, and offline messaging, and the AI chat tab offers a reduced-motion aware assistant shell until the Agents SDK comes online.【F:src/components/client/PaymentScreen.tsx†L1-L210】【F:src/components/client/AIChatScreen.tsx†L1-L170】【F:src/components/client/ActionDock.tsx†L1-L74】
- **PWA readiness** – Manifest updates, the install prompt hook, and the Workbox service worker enable Add-to-Home-Screen guidance, offline caching, and background-sync messaging without breaking existing environments.【F:public/manifest.json†L1-L41】【F:src/hooks/useInstallPrompt.ts†L1-L56】【F:src/components/client/ClientShell.tsx†L456-L530】【F:src/sw.ts†L1-L154】
- **Accessibility guardrails** – Axe-powered regression tests run via `npm run test:accessibility` to enforce WCAG 2.2 AA compliance on the diner surfaces.【F:tests/accessibility/phase3.test.tsx†L1-L59】

External partners following the [Phase 3 outsourcing playbook](docs/outsourcing/phase3-outsourcing.md) should drop artefacts into `artifacts/phase3/` and append audit notes under `docs/outsourcing/notes/` so accessibility, UX, and performance findings stay traceable.

### Phase 7 – Merchant portal core

Phase 7 introduces a staff-facing control surface at `/merchant` that unifies KDS orchestration, floor management, menu copy
reviews, inventory automation, and promo configuration. Highlights:

- **Realtime KDS board** subscribes to Supabase Realtime (`orders` table) to stream new tickets, compute prep timers, and
  synchronise table states whenever a cook marks dishes ready or served. Status transitions automatically post into
  `table_state_events` so the floor view stays aligned.【F:src/components/merchant/KDSBoard.tsx†L1-L162】【F:src/hooks/useKdsOrders.ts†L1-L210】
- **Drag-and-drop floor planner** extends the `tables` schema with layout coordinates and a `table_state_t` enum, letting staff
  reposition tables, toggle states (`vacant` → `bill`), and insert audit events without leaving the portal.【F:supabase/migrations/20240318000000_phase7_merchant_portal.sql†L1-L123】【F:src/components/merchant/FloorPlanner.tsx†L1-L189】
- **Menu manager approvals** fetch pending AI rewrites from `menu_copy_suggestions`, surface a diff view, enforce human
  approval, and toggle availability directly on the `items` table. The audit trail keeps approved/rejected records for later
  review.【F:src/hooks/useMenuManager.ts†L1-L196】【F:src/components/merchant/MenuManagerPanel.tsx†L1-L189】
- **Inventory automation controls** expose per-item stock, thresholds, and auto-86 autonomy caps backed by new
  `inventory_items` columns. Updates propagate to Supabase instantly and feed the agents’ availability guardrails.【F:supabase/migrations/20240318000000_phase7_merchant_portal.sql†L53-L61】【F:src/components/merchant/InventoryManagerPanel.tsx†L1-L170】
- **Promo builder** writes epsilon-bandit campaign settings into `promo_campaigns`, logs actions in `promo_audit_events`, and
  provides activation/pause workflows that enforce budget and fairness caps before promotion goes live.【F:src/hooks/usePromoCampaigns.ts†L1-L146】【F:src/components/merchant/PromoBuilderPanel.tsx†L1-L211】
- **Payments desk** aggregates unsettled tickets, surfaces provider failures, and lets authorised staff trigger the new
  `payments/manual_capture` Edge Function to mark cash or manual settlements as captured while logging audit trails in
  `payment_action_events`.【F:src/components/merchant/PaymentsDesk.tsx†L1-L266】【F:src/hooks/useOutstandingPayments.ts†L1-L105】【F:supabase/functions/payments/manual_capture/index.ts†L1-L156】

The supporting SQL regression (`supabase/tests/merchant_portal.sql`) confirms staff roles can update table states, approve menu
copy, adjust inventory automation flags, and seed promo audits without violating RLS policies.【F:supabase/tests/merchant_portal.sql†L1-L55】

### Phase 8 – Admin console

Phase 8 equips central operations with a governance console at `/admin` that wraps onboarding, AI configuration, analytics, and compliance tooling in a single gradient surface.【F:src/components/admin/AdminShell.tsx†L1-L132】【F:src/pages/AdminConsole.tsx†L1-L6】 Highlights include:

- **Onboarding wizard** drives the new `admin/onboard_tenant` Edge Function so authorised staff can create tenants, seed venues/menus, and pre-load agent policies in one step. The form accepts a bearer token (`ADMIN_ONBOARDING_SECRET`) and hydrates the tenant selector automatically after success.【F:src/components/admin/OnboardingWizard.tsx†L1-L171】【F:supabase/functions/admin/onboard_tenant/index.ts†L1-L220】
- **AI agent settings** renders live rows from `agent_runtime_configs`, exposing instructions, tool allow-lists, autonomy levels, budgets, and experiment flags with inline validation. Every update flips the sync flag, writes to `agent_config_audit_events`, and surfaces a human-readable audit timeline so ops can trace who changed what before the agents service ingests the patch.【F:src/components/admin/AgentSettingsPanel.tsx†L1-L318】【F:src/hooks/useAgentConfigs.ts†L1-L110】【F:src/hooks/useAgentConfigAudits.ts†L1-L40】【F:supabase/migrations/20240322000000_phase8_admin_console.sql†L1-L135】
- **Analytics overview** consumes `tenant_kpi_snapshots` to surface GMV, AOV, attach rates, and AI acceptance KPIs with a trendline, keeping finance and merchandising aligned across regions. A new “Platform defaults” selector lets operations edit global agent policies while gating analytics/compliance tabs to tenant views so shared baselines don’t distort per-venue reporting.【F:src/components/admin/AnalyticsOverview.tsx†L1-L153】【F:src/hooks/useTenantKpis.ts†L1-L37】【F:src/hooks/useAgentConfigs.ts†L1-L128】
- **Compliance workspace** now layers a fiscalisation SLA tracker, AI disclosure copy editor, KYBC checklist, and the original task table so operations can monitor queue breaches, tune disclosure copy, chase KYBC evidence, and resolve compliance follow-ups without leaving the console.【F:src/components/admin/FiscalizationSlaCard.tsx†L1-L66】【F:src/components/admin/AiDisclosureEditor.tsx†L1-L149】【F:src/components/admin/KybcChecklist.tsx†L1-L195】【F:src/components/admin/CompliancePanel.tsx†L1-L380】【F:src/hooks/useComplianceTasks.ts†L1-L153】【F:src/hooks/useComplianceNotices.ts†L1-L120】【F:src/hooks/useKybcChecklist.ts†L1-L144】【F:src/hooks/useFiscalizationSlaSummary.ts†L1-L36】【F:supabase/migrations/20240409000000_phase8_compliance_enhancements.sql†L1-L128】
- **DSR request tooling** exposes export/delete intake with live status controls, tying the UI to the new `dsr_requests` table so privacy leads can log fulfilment notes, trigger completion timestamps, and jump to the documented runbook without leaving the console.【F:src/components/admin/DsrRequestsPanel.tsx†L1-L238】【F:src/hooks/useDsrRequests.ts†L1-L157】【F:supabase/migrations/20240408000000_phase8_dsr_requests.sql†L1-L74】【F:docs/runbooks/dsr-requests.md†L1-L55】

The Phase 8 migration also extends `agent_runtime_configs` with governance metadata, introduces KPI/compliance tables, and attaches triggers that log audit trails on every change. A dedicated SQL regression verifies staff can update configs, manage compliance tasks end-to-end, and that diners remain blocked by RLS when attempting the same updates.【F:supabase/migrations/20240322000000_phase8_admin_console.sql†L1-L170】【F:supabase/tests/admin_console.sql†L1-L88】

### Phase 9 – Offline, background sync, and push

Phase 9 hardens the diner PWA against flaky connectivity while unlocking standards-compliant web push so guests can receive fiscal receipts or order updates once they leave the tab.【F:src/sw.ts†L1-L173】【F:src/components/client/ClientShell.tsx†L1-L420】 Key capabilities include:

- **Offline-aware service worker** now precaches the shell, caches menus with `StaleWhileRevalidate`, applies `CacheFirst` for imagery, and enqueues POST/PATCH/PUT/DELETE requests against the Supabase REST and Edge Function origins into a Workbox background-sync queue that broadcasts a replay count once connectivity returns.【F:src/sw.ts†L13-L154】
- **Background sync toast hook** listens for the service worker replay message and surfaces a contextual toast so diners know their queued actions were delivered after reconnecting.【F:src/hooks/useBackgroundSyncToast.ts†L1-L53】【F:src/components/client/ClientShell.tsx†L30-L109】
- **Push opt-in UX and hook** expose a gradient card inside the diner shell that requests notification permission, converts the VAPID key, persists the subscription via Supabase Edge Functions, and guides iOS users through the Add to Home Screen flow required for push on Safari.【F:src/components/client/ClientShell.tsx†L74-L213】【F:src/hooks/usePushSubscription.ts†L1-L126】
- **Push verification controls** let diners preview a test alert and disable subscriptions without leaving the card, while dry-running the `notifications/send_push` stub so ops can confirm stored endpoints without delivering production traffic.【F:src/components/client/ClientShell.tsx†L120-L214】【F:src/hooks/usePushSubscription.ts†L1-L238】【F:supabase/functions/notifications/send_push/index.ts†L1-L121】
- **Notification storage & functions** add a `notification_subscriptions` table plus `notifications/subscribe_push`, `notifications/unsubscribe_push`, and `notifications/send_push` functions so the platform can securely register browser endpoints, enforce diner `x-icupa-session` headers during opt-outs, and stub out future delivery pipelines without leaking PII through RLS.【F:supabase/migrations/20240324000000_phase9_notifications.sql†L1-L69】【F:supabase/functions/notifications/subscribe_push/index.ts†L1-L189】【F:supabase/functions/notifications/unsubscribe_push/index.ts†L1-L144】【F:supabase/functions/notifications/send_push/index.ts†L1-L121】
- **Offline cart regression tests** verify cart mutations persist into localStorage, survive reloads, and clear correctly after sync using Vitest, providing automated coverage for the offline queue requirement.【F:src/stores/cart-store.test.ts†L1-L116】
- **Offline sync telemetry** records replay metrics into `offline_sync_events` whenever the service worker flushes its background queue, giving operations visibility into latency and failure counts for vendor reporting.【F:src/sw.ts†L1-L205】【F:src/hooks/useBackgroundSyncToast.ts†L1-L141】【F:supabase/migrations/20240412000000_phase9_offline_sync_events.sql†L1-L73】
- **Admin offline queue summary** exposes per-location background-sync performance (batches, failures, latency) through the compliance workspace so tenant operators can audit reconnection health without leaving the console.【F:src/components/admin/OfflineSyncSummaryCard.tsx†L1-L122】【F:src/hooks/useOfflineSyncSummary.ts†L1-L53】【F:supabase/migrations/20240413000000_phase9_offline_sync_summary.sql†L1-L121】
- **Outsourcing playbook** keeps the Phase 9 vendors aligned on caching audits, push enablement, and offline QA execution so external partners deliver artefacts into the correct directories (`artifacts/phase9/*`, `tests/offline/`). Read the coordination details in [docs/outsourcing/phase9-outsourcing.md](docs/outsourcing/phase9-outsourcing.md).【F:docs/outsourcing/phase9-outsourcing.md†L1-L137】

### Phase 10 – Testing, load, and security hardening

Phase 10 closes the pre-GA quality gates by introducing automated end-to-end coverage, load validation, and formal security reviews ahead of the release canary.【F:docs/implementation-plan.md†L189-L212】 Key tracks include:

- **Playwright diner/merchant/admin suites** that walk the critical QR → pay → receipt path, exercise the realtime KDS, and verify AI configuration flows so regressions surface before they reach staging.【F:docs/implementation-plan.md†L194-L199】 Vendor onboarding, timelines, and deliverables live in the [Phase 10 outsourcing playbook](docs/outsourcing/phase10-outsourcing.md) so the contracted QA partner can plug into our workflow without blocking the core team.【F:docs/outsourcing/phase10-outsourcing.md†L1-L87】 The suites ship from `tests/playwright/`, which now includes a Playwright configuration, placeholder specs for each surface, and CI wiring to honour the `PLAYWRIGHT_BASE_URL` secret.
- **k6 load scenarios** for `create_table_session` and payment webhooks live in `tests/k6/scripts/` with result handling documented in `tests/k6/README.md`. Vendors should commit scenario updates and publish HTML/JSON summaries to `artifacts/phase10/load/` alongside their Grafana exports.
- **Security attestation packs** belong in `docs/security/phase10/`, with encrypted deliverables covering the OWASP ASVS L2 test plan, findings, remediation tracker, and final attestation letter. Meeting notes sit under `docs/outsourcing/notes/` for continuity once vendor access is revoked.
- **k6 load tests** against `create_table_session` and the payment webhooks to confirm latency and error-rate budgets under peak concurrency, keeping the Supabase Edge Functions within their p95 targets.【F:docs/implementation-plan.md†L199-L201】
- **Security hardening review** covering CSP/HSTS/SameSite policies, dependency audits, secrets scanning, and RLS black-box probes mapped to the OWASP ASVS checklist so launch blockers are remediated quickly.【F:docs/implementation-plan.md†L201-L202】
- **Incident response runbooks** for payments timeouts, fiscalisation outages, and AI kill-switch activation that document detection, mitigation, and rollback steps for the on-call rotation.【F:docs/runbooks/payments-timeout.md†L1-L94】【F:docs/runbooks/fiscalization.md†L1-L137】【F:docs/runbooks/ai-kill-switch.md†L1-L108】
