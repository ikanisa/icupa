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
   - Node.js 18.17.x (LTS)
   - npm 10+ (or pnpm/yarn if preferred)

2. **Bootstrap environment variables**
   - Copy `.env.example` to `.env.local` (ignored by Git) and provide the Supabase project details you intend to use. Production builds and CI now fail fast if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (or their `NEXT_PUBLIC_*` equivalents) are absent, so populate them before running `npm run build` or deploying.
   - Copy `agents-service/.env.example` to `agents-service/.env` when running the OpenAI Agents service locally.

3. **Link your Supabase project** *(optional but recommended for deploy scripts)*
   ```bash
   supabase login              # uses SUPABASE_ACCESS_TOKEN from your .env
   supabase link --project-ref <your-project-ref>
   supabase secrets set --env-file .env.supabase
   ```
   Linking stores the project reference in `.supabase/config.json`, allowing the deploy scripts under `scripts/supabase/` to run without additional flags.

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Start Supabase locally**
   ```bash
   supabase start
   supabase db reset --local --yes
   supabase seed --local --yes
   ```
   These commands provision the Dockerised Supabase stack, apply the Phase 0 + Phase 1 migrations, and seed demo data covering
   tenants, locations, menus, table sessions, orders, and agent telemetry. The Phase 1 migration introduces pgvector-powered
   embeddings, hardened RLS policies, and staff role helpers.

6. **Validate database policies and semantic search**
   ```bash
   supabase db test
   ```
   The SQL tests in `supabase/tests` assert that diners bound by the `x-icupa-session` header cannot read other table orders,
   that staff with tenant roles can, and that cosine similarity queries surface the correct item using the seeded embeddings.

7. **Run the development server**
   ```bash
   npm run dev
   ```
   The application is served at `http://localhost:5173/` by default. Hot module reload is enabled through Vite.

8. **(Optional) Start the agents service**
   ```bash
   cd agents-service
   npm install
   npm run dev
   ```
   The Fastify instance listens on `http://localhost:8787/` by default. In addition to `/health`, the service now exposes `POST /agents/waiter`, which orchestrates the waiter → allergen guardian → upsell agents via the OpenAI Agents SDK. Requests accept the diner message alongside optional `table_session_id`, `tenant_id`, `location_id`, declared allergens, cart context, and an existing `session_id`. Responses include the grounded reply, filtered upsell suggestions (with citation tokens), and any allergen disclaimers. Override the port via `AGENTS_PORT` inside `agents-service/.env`.

   > 💡  Capture thumbs-up or thumbs-down ratings by POSTing to `/agent-feedback` with `session_id`, `agent_type`, and `rating` (plus optional tenant, location, or table session context). Feedback is recorded in `agent_events` alongside the existing telemetry pipeline.

   > ℹ️  The agents service honours kill switches and spend caps defined in `agent_runtime_configs`. Defaults can be tuned via `AGENT_SESSION_BUDGET_USD` and `AGENT_DAILY_BUDGET_USD` in `.env`.

9. **Lint the project** (optional but recommended before submitting patches)
   ```bash
   npm run lint
   ```

10. **Type-check the project**
   ```bash
   npm run typecheck
   ```

---

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL for your Supabase project. It is injected into the generated Supabase client and must match the project you plan to target. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key used by the browser client. Store the matching service role key only in secure server-side environments (Edge Functions, agents service, etc.). |
| `NEXT_PUBLIC_AGENTS_URL` | ➖ | Optional URL for the agent orchestration service. Configure when connecting the UI to OpenAI-powered agents. |
| `VITE_AGENTS_STREAMING` | ➖ | Enable SSE updates from `/agent-sessions/:id/stream` when the agents service exposes a streaming feed (`true`/`false`). |
| `VITE_AGENTS_LONG_POLLING` | ➖ | Fallback toggle that polls `/agent-sessions/:id/events` every few seconds when SSE is unavailable. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ➖ | VAPID public key used to register web push subscriptions from the PWA. Generate a matching private key and store it securely in Supabase for outbound delivery. |

### Supabase secrets for Edge Functions

Configure the following secrets in the Supabase dashboard (or via `supabase secrets set`) before deploying the payments Edge Functions. All values should be scoped per environment (dev, staging, prod):

| Secret | Required | Description |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | ✅ (EU) | Stripe secret key used by the checkout Edge Function. Generate a restricted key with write access to PaymentIntents/Checkout Sessions. |
| `STRIPE_WEBHOOK_SECRET` | ✅ (EU) | Signing secret for the Stripe webhook (`payments/stripe/webhook`). |
| `STRIPE_ACCOUNT_ID` | ➖ | Optional. Set when using Stripe Connect to route payments through a connected account. |
| `MOMO_CLIENT_ID` / `MOMO_CLIENT_SECRET` | ➖ (RW) | Credentials for the MTN MoMo API. The current implementation logs a TODO until live credentials are available. |
| `MOMO_API_BASE` | ➖ (RW) | Override the MTN MoMo API base URL (defaults to the sandbox). |
| `MOMO_WEBHOOK_SECRET` | ➖ (RW) | Shared secret used to validate MTN MoMo webhook callbacks. |
| `AIRTEL_KEY` / `AIRTEL_SECRET` | ➖ (RW) | Credentials for Airtel Money collections. Required before enabling live requests. |
| `AIRTEL_WEBHOOK_SECRET` | ➖ (RW) | Shared secret for Airtel Money webhook validation. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Required so the Edge Functions can create orders/payments with service-role privileges. |
| `SUPABASE_FUNCTIONS_URL` | ➖ | Optional override for the Edge Functions domain. Defaults to the derived `https://<project>.functions.supabase.co` host; set explicitly when running behind a custom gateway. |
| `TABLE_QR_ADMIN_SECRET` | ➖ | Bearer token required by `admin/reissue_table_qr` when rotating table QR payloads. |
| `ADMIN_ONBOARDING_SECRET` | ➖ | Bearer token required by `admin/onboard_tenant` to create tenants, locations, and default agent settings. |
| `ADMIN_INVITE_REDIRECT_URL` | ➖ | Optional. Redirect target used by staff invites issued through `admin/user_roles`; falls back to the Supabase dashboard invite link when unset. |

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
| `npm run verify:full` | Runs linting, type checks, unit tests, Playwright journeys, and Supabase SQL tests in one pass. |
| `npm run test` | Runs the Vitest suite, including offline cart persistence checks. |
| `npm run test:accessibility` | Audits the Phase 3 diner surfaces with axe-core to keep WCAG 2.2 AA regressions from slipping into the PWA. |

Installing dependencies with `npm install` now pulls in the Supabase CLI as a local dev dependency (`node_modules/.bin/supabase`).
That ensures pretest database resets, SQL migrations, and `npm run supabase:test` all work without a separate global installation.
When you need to run the CLI directly, prefer `npx supabase <command>` so the project-pinned version stays in sync across machines.

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
supabase db reset --local --yes
supabase seed --local --yes
supabase db test
```

The migrations create enums, helper functions, ivfflat indexes, and row-level security policies spanning diners (by `x-icupa-session`) and staff (via `user_roles`). Seeds provision demo users, menus, items with deterministic embeddings, and sample agent telemetry so the SQL regression tests can execute.

- SQL tests now include merchant onboarding/auth coverage (see `supabase/tests/rls_user_mgmt.sql`) so WhatsApp OTP storage, merchant profiles, and diner preferences remain tenant-scoped.

- **Automation** – Run `npm run test` for Vitest suites and `npx playwright test` (or `npm run test:e2e`) for the scripted journeys covering diner checkout (`client.journey.spec.ts`), merchant ingestion (`merchant.menu.ingestion.spec.ts`), merchant WhatsApp login, admin magic link flows, and the AI chat happy path (`diner.ai-assistant.spec.ts`).

- **Outsourcing playbook** – External database specialists follow [`docs/outsourcing/phase1-outsourcing.md`](docs/outsourcing/phase1-outsourcing.md) to review migrations, run RLS regressions, and rehearse embedding refreshes. Artefacts land in `artifacts/phase1/*` with meeting notes stored under `docs/outsourcing/notes/` so Phase 1 owners can audit deliverables.

### Embedding refresh Edge Function

`supabase/functions/menu/embed_items` calls OpenAI's embeddings API (`text-embedding-3-large` by default) to populate or refresh item vectors in batches. It accepts optional `item_ids` and `force` flags via JSON body and honours a `limit` query parameter (default 32). Configure `OPENAI_API_KEY`, `EMBED_ITEMS_API_KEY` (shared secret), and optionally `OPENAI_EMBEDDING_MODEL` in the Supabase dashboard before deploying, then trigger with:

```bash
supabase functions deploy menu
supabase functions invoke menu/embed_items --project-ref <ref> --no-verify-jwt \\
  --header \"Authorization: Bearer $EMBED_ITEMS_API_KEY\"
```

The follow-up migration registers an hourly pg_cron job (`menu_embed_items_hourly`) that invokes the Edge Function so vectors stay fresh without manual intervention. The target URL lives in `public.scheduler_config` under the `menu_embed_items_url` key—by default it points at the local Supabase stack (`http://host.docker.internal:54321/functions/v1/menu/embed_items`). Override it in hosted environments after deploying the function:

```sql
update public.scheduler_config
set value = 'https://<project-ref>.functions.supabase.co/menu/embed_items'
where key = 'menu_embed_items_url';
```

The helper raises a notice instead of failing when the URL is blank, making it safe to temporarily disable the job during maintenance windows.

> ⚠️ Whether you call the function from `supabase functions invoke`, pg_cron, or an external scheduler, include `Authorization: Bearer $EMBED_ITEMS_API_KEY` (or `x-api-key`) in every request. Calls without the shared secret now receive `401 Unauthorized`.

The ivfflat index on `items.embedding` (lists=100) accelerates cosine similarity queries used by the diner shell's semantic search and agent recommendation tooling.

### OCR menu ingestion pipeline

- **Schema & buckets** – `supabase/migrations/20250315000000_menu_ingestion.sql` introduces `menu_ingestions` + `menu_items_staging`, enables RLS, and provisions the storage buckets `raw_menus` (private) and `menu_images` (public/signed). Apply the migration with `supabase db reset` or `supabase db push`.
- **Edge Functions** – Deploy the ingestion lifecycle:

  ```bash
  supabase functions deploy ingest_menu_start --no-verify-jwt
  supabase functions deploy ingest_menu_process --no-verify-jwt
  supabase functions deploy ingest_menu_publish --no-verify-jwt
  ```

- **Environment** – Set these secrets before invoking the pipeline:

  | Variable | Purpose |
  | --- | --- |
  | `OPENAI_API_KEY` | Required. Vision Responses API for OCR structuring. |
  | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Already required for other Edge Functions. |
  | `OCR_CONVERTER_URL` | Optional. HTTPS endpoint that converts PDFs to images (Supabase signs the source URL). |
  | `OCR_CONVERTER_TOKEN` | Optional bearer token for the converter microservice. |
  | `OCR_OPENAI_MODEL` (default `gpt-4o`) | Vision model used by `ingest_menu_process`. |
  | `OCR_SIGNED_UPLOAD_TTL_SECONDS` (default `900`) | Signed upload URL lifetime. |
  | `OCR_SIGNED_DOWNLOAD_TTL_SECONDS` (default `600`) | Signed download lifetime when fetching from Storage. |
  | `OCR_MAX_PAGES` (default `25`) | Hard ceiling on processed pages. |
  | `OCR_IMAGE_MAX_EDGE` (default `1200`) | Resize bound passed to the converter. |
  | `OCR_MIN_CONFIDENCE` (default `0.55`) | Confidence floor for flagging uncertain items. |

- **Local converter shim** – This repo includes a minimal HTTP service at `apps/ocr-converter` you can run locally while wiring the pipeline. It fetches image sources and returns base64 payloads, and returns an explicit 501 for PDFs (deploy a full converter in production).

  ```bash
  # in a separate terminal
  npm run dev:ocr:converter
  ```

  Then set in your Supabase project (or locally):

  - `OCR_CONVERTER_URL=http://host.docker.internal:8789/convert`
  - `OCR_CONVERTER_TOKEN=<match apps/ocr-converter/.env>`

  The production converter should accept `{ source_url, max_pages, max_edge }` and return `{ images: [{ page, base64, content_type }] }`.

### Merchant authentication & onboarding

- **WhatsApp OTP** – `auth/whatsapp_send_otp` hashes codes (SHA-256) and enforces per-number rate limits before calling the WhatsApp Graph API. `auth/whatsapp_verify_otp` validates the hash + TTL, automatically creates/updates Supabase users, merchant profiles, and assigns `user_roles`.
- **Onboarding function** – `merchant/onboarding_update` lets merchants progress through Verify → Business → MoMo → GPS → Menu → Done, storing MoMo codes and GPS pins (with map deeplink support). The merchant PWA (`/merchant/login`, `/merchant/settings`, `/merchant/menu*`) is gated so only authenticated, fully onboarded merchants can publish menus.

### Admin email magic links

- `auth/admin_email_magiclink` generates Supabase magic links via the Admin API, sends emails through the configured SMTP credentials, and is surfaced at `/admin/login`. Admin shell verifies both session and `user_roles` before loading panels.

### Release utilities

- `npm run release:checklist` runs the go-live health checks (agents service, receipts worker, reconciliation cron, voice waiter). Configure `SUPABASE_FUNCTIONS_URL`, `AGENTS_BASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` to target staging or production.
- `npm run release:canary-toggle` flips agent experiments on/off (set `CANARY_AGENT`, `CANARY_ENABLED`, and optional `CANARY_TENANT_ID` to scope per tenant).

#### Bulk secrets and function deployment

Use the helper scripts under `scripts/supabase/` to load secrets and deploy all Edge Functions quickly:

```bash
cp .env.supabase.example .env.supabase
# Fill values, then set them in your project
./scripts/supabase/set-secrets.sh --project <your-ref> --env-file .env.supabase
# Deploy functions (no-verify-jwt by default for local/dev)
./scripts/supabase/deploy-functions.sh --project <your-ref>
```

#### Run all dev services together

To launch the web app, agents service, and the OCR converter shim concurrently:

```bash
npm run dev:all
```


- **Invocation flow** – Merchants invoke `ingest_menu_start` (returns `ingestion_id` + signed upload URL), upload the asset to `raw_menus`, call `ingest_menu_process` to run OCR + OpenAI structuring, then review/publish via the merchant PWA. Publish uses `ingest_menu_publish` which wraps a transactional stored procedure and triggers `menu/embed_items` for refreshed embeddings.
- **Observability** – Each function writes timeline events to `agent_events` (`ingestion.started`, `processing`, `awaiting_review`, `published`, `failed`) with counters for pages processed, items extracted, and confidence buckets. Grafana/DataDog dashboards can pivot on these payloads for throughput and error monitoring.
- **Queue & cron metrics** – The `monitoring.pgmq_queue_metrics` and `monitoring.cron_job_metrics` views expose queue depth and pg_cron health; call `rpc.list_queue_metrics` / `rpc.list_cron_jobs` from the admin console for live dashboards or alerts.

### Table session Edge Function & QR tooling

- `supabase/functions/create_table_session` validates signed QR payloads, captures the caller's IP and device fingerprint, and issues a four-hour table session identifier that powers the diner RLS policies. Configure `TABLE_QR_SIGNING_SECRET`, `TABLE_SESSION_TTL_HOURS` (defaults to `4`), and `TABLE_QR_MAX_AGE_MINUTES` (defaults to `15`) as Supabase secrets before deploying the function.【F:supabase/functions/create_table_session/index.ts†L1-L124】
- Browser storage keeps the session token in `localStorage` and forwards it via the `x-icupa-session` header on every Supabase request; clearing or expiring the session removes the header automatically.【F:src/lib/table-session.ts†L1-L47】【F:src/integrations/supabase/client.ts†L17-L34】
- Rotate QR payloads with the admin-only Edge Function at `supabase/functions/admin/reissue_table_qr`. Supply `TABLE_QR_ADMIN_SECRET` (the bearer token expected by the function) and optionally `TABLE_QR_APP_BASE_URL` so the response includes a shareable `?qr=<token>&sig=<signature>` link.【F:supabase/functions/admin/reissue_table_qr/index.ts†L1-L112】
- **Outsourcing playbook** – Phase 2 vendors follow [`docs/outsourcing/phase2-outsourcing.md`](docs/outsourcing/phase2-outsourcing.md) to rehearse QR key rotations, probe session isolation, and capture mobile QA evidence. Artefacts live in `artifacts/phase2/*` with coordination notes under `docs/outsourcing/notes/` so the core team can audit deliverables.

Deploy and test locally:

```bash
supabase functions deploy create_table_session --no-verify-jwt
supabase functions deploy admin --no-verify-jwt
supabase functions invoke admin/reissue_table_qr \
  --project-ref <ref> \
  --no-verify-jwt \
  --header "Authorization: Bearer $TABLE_QR_ADMIN_SECRET" \
  --body '{"table_id":"00000000-0000-4000-8000-000000000501"}'
```

The React admin stub at `/admin/tools/qr` wraps the reissue endpoint so operations teams can mint new QR payloads without leaving the app. Paste a one-time admin token, submit the table identifier, and copy the refreshed link or payload returned by the tool.【F:src/pages/AdminQrTools.tsx†L1-L119】

### Clerk → Supabase verification (P0 bridge)

If you are using Clerk for the web UI but keeping Supabase as the application database and RLS authority, you can verify a Clerk user token from Supabase Edge Functions using `compliance/verify_clerk`:

```bash
supabase functions deploy compliance --no-verify-jwt
supabase functions invoke compliance/verify_clerk \
  --project-ref <ref> \
  --no-verify-jwt \
  --header "Authorization: Bearer <clerk_session_jwt>"
```

Configure:

- `CLERK_JWKS_URL` – Clerk JWKS endpoint for your instance.
- `CLERK_ISSUER` – Optional issuer to enforce in JWT verification.

The function responds with the Clerk subject, email, and whether a corresponding Supabase `auth.users` record already exists (matched by email). This acts as the glue to connect Clerk-auth flows to Supabase while you finalise your production token exchange strategy (JWT audience alignment or a dedicated linkage flow).

### Payments Edge Functions & queueing

- `supabase/functions/payments/stripe/checkout` validates the cart payload, binds the order to the active table session, and creates a Stripe Checkout Session while persisting provisional order/payment rows.【F:supabase/functions/payments/stripe/checkout/index.ts†L1-L168】
- `supabase/functions/payments/stripe/webhook` verifies Stripe signatures, marks payments as `captured`, updates the linked order, and enqueues fiscalisation jobs via `public.enqueue_fiscalization_job`.【F:supabase/functions/payments/stripe/webhook/index.ts†L1-L87】
- Rwandan mobile money flows are stubbed via `payments/momo/request_to_pay` and `payments/airtel/request_to_pay`, which persist pending payments, emit structured events, and return developer-friendly references.【F:supabase/functions/payments/momo/request_to_pay/index.ts†L1-L94】【F:supabase/functions/payments/airtel/request_to_pay/index.ts†L1-L94】 Their companion webhooks accept provider callbacks and transition payments to `captured`/`failed` while logging signature validation results.【F:supabase/functions/payments/momo/webhook/index.ts†L1-L63】【F:supabase/functions/payments/airtel/webhook/index.ts†L1-L60】
- The Phase 4 migration seeds a durable `fiscalization_jobs` queue and exposes `public.enqueue_fiscalization_job(order_uuid uuid, payment_uuid uuid)` so capture handlers can hand off receipt generation work.【F:supabase/migrations/20240226000000_phase4_payments.sql†L1-L25】

Hardening updates:

- Stripe Checkout now uses an idempotency key derived from the payment so duplicate client retries cannot create multiple sessions.【F:supabase/functions/payments/stripe/checkout/index.ts†L1-L80】
- Mobile money webhooks support optional HMAC verification: set `MOMO_WEBHOOK_HMAC_SECRET` and/or `AIRTEL_WEBHOOK_HMAC_SECRET` alongside the legacy `*_WEBHOOK_SECRET`. When HMAC is configured the function verifies `x-mtn-signature-hmac`/`x-airtel-signature-hmac` against the raw body; otherwise it falls back to the legacy shared-secret header check.【F:supabase/functions/payments/momo/webhook/index.ts†L1-L40】【F:supabase/functions/payments/airtel/webhook/index.ts†L1-L40】 The idempotency register in `payment_webhook_events` continues to deduplicate repeated deliveries.

### P2 – Inventory auto‑86 and reconciliation

- Auto‑86 Edge Function: `merchant/inventory/auto_86` disables or re‑enables menu items for a location (staff‑gated). Body: `{ location_id, item_ids: string[], enable?: boolean, reason?: string }`. Returns `{ updated, enable }` and records an event for audit.【F:supabase/functions/merchant/inventory/auto_86/index.ts†L1-L80】
- Reconciliation job: `reconciliation/reconcile_daily` scans captured payments in the last 24h, enqueues missing receipts for fiscalisation, and returns a summary `{ inspected, with_receipts, enqueued }`. Accepts `{ since_hours, tenant_id, location_id }`. Intended for pg_cron / automation with service role credentials.【F:supabase/functions/reconciliation/reconcile_daily/index.ts†L1-L120】

The diner pay screen now calls these Edge Functions, surfaces pending vs. captured states, and offers a one-tap redirect to the hosted Stripe flow when available.【F:src/components/client/PaymentScreen.tsx†L99-L341】 Mobile money stubs remain non-blocking while their production credentials are added.

### Receipts pipeline & runbooks

- `supabase/functions/receipts/process_queue` drains the `fiscalization_jobs` queue, fans out to the regional receipt stubs, persists `public.receipts`, and emits `receipt_issued` events for the UI.【F:supabase/functions/receipts/process_queue/index.ts†L1-L170】
- Payment capture handlers now ping the fiscalisation worker directly after enqueueing jobs so receipts land without waiting for an external scheduler. Override the invocation host with `SUPABASE_FUNCTIONS_URL` when running behind a proxy.【F:supabase/functions/_shared/payments.ts†L38-L119】
- Regional stubs return simulated payloads so integrations can be wired incrementally: `receipts/issue_ebm_rwanda` mirrors RRA EBM 2.1 responses, while `receipts/issue_fiscal_malta` provides placeholders for Malta fiscal signatures.【F:supabase/functions/receipts/issue_ebm_rwanda/index.ts†L1-L75】【F:supabase/functions/receipts/issue_fiscal_malta/index.ts†L1-L75】
- The diner pay screen now watches for receipt inserts and surfaces fiscal IDs, QR guidance, and reprint messaging once the worker completes.【F:src/components/client/PaymentScreen.tsx†L642-L775】
- Merchants can review history, manually trigger the queue, and follow downtime guidance from `/merchant/receipts`, which consumes the same Supabase data with staff-focused troubleshooting copy.【F:src/pages/MerchantReceipts.tsx†L1-L214】
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

The supporting SQL regression (`supabase/tests/merchant_portal.sql`) confirms staff roles can update table states, approve menu
copy, adjust inventory automation flags, and seed promo audits without violating RLS policies.【F:supabase/tests/merchant_portal.sql†L1-L55】

### Phase 8 – Admin console

Phase 8 equips central operations with a governance console at `/admin` that wraps onboarding, AI configuration, analytics, and compliance tooling in a single gradient surface.【F:src/components/admin/AdminShell.tsx†L1-L132】【F:src/pages/AdminConsole.tsx†L1-L6】 Highlights include:

- **Onboarding wizard** drives the new `admin/onboard_tenant` Edge Function so authorised staff can create tenants, seed venues/menus, and pre-load agent policies in one step. The form accepts a bearer token (`ADMIN_ONBOARDING_SECRET`) and hydrates the tenant selector automatically after success.【F:src/components/admin/OnboardingWizard.tsx†L1-L171】【F:supabase/functions/admin/onboard_tenant/index.ts†L1-L220】
- **Staff access management** calls the `admin/user_roles` Edge Function so owners/admins/support can invite or revoke staff from the console. Invites emit Supabase magic links (using `ADMIN_INVITE_REDIRECT_URL`) and immediately upsert `user_roles`, allowing the new staff member to inherit merchant permissions and trigger automated profile creation.【F:apps/web/components/admin/RoleManagerPanel.tsx†L1-L192】【F:supabase/functions/admin/manage_user_roles/index.ts†L1-L209】
- **AI agent settings** renders live rows from `agent_runtime_configs`, exposing instructions, tool allow-lists, autonomy levels, budgets, and experiment flags with inline validation. Every update flips the sync flag, writes to `agent_config_audit_events`, and surfaces a human-readable audit timeline so ops can trace who changed what before the agents service ingests the patch.【F:src/components/admin/AgentSettingsPanel.tsx†L1-L318】【F:src/hooks/useAgentConfigs.ts†L1-L110】【F:src/hooks/useAgentConfigAudits.ts†L1-L40】【F:supabase/migrations/20240322000000_phase8_admin_console.sql†L1-L135】
- **Analytics overview** consumes `tenant_kpi_snapshots` to surface GMV, AOV, attach rates, and AI acceptance KPIs with a trendline, keeping finance and merchandising aligned across regions.【F:src/components/admin/AnalyticsOverview.tsx†L1-L129】【F:src/hooks/useTenantKpis.ts†L1-L37】【F:supabase/seed/seed.sql†L161-L186】
- **Compliance dashboard** lists outstanding fiscalisation, AI disclosure, and KYBC tasks with severity badges and due dates backed by the new `compliance_tasks` table.【F:src/components/admin/CompliancePanel.tsx†L1-L52】【F:src/hooks/useComplianceTasks.ts†L1-L39】【F:supabase/migrations/20240322000000_phase8_admin_console.sql†L21-L74】

The Phase 8 migration also extends `agent_runtime_configs` with governance metadata, introduces KPI/compliance tables, and attaches triggers that log audit trails on every change. A dedicated SQL regression verifies staff can update configs, see audit rows, and that diners remain blocked by RLS when attempting the same updates.【F:supabase/migrations/20240322000000_phase8_admin_console.sql†L1-L170】【F:supabase/tests/admin_console.sql†L1-L52】

### Phase 9 – Offline, background sync, and push

Phase 9 hardens the diner PWA against flaky connectivity while unlocking standards-compliant web push so guests can receive fiscal receipts or order updates once they leave the tab.【F:src/sw.ts†L1-L173】【F:src/components/client/ClientShell.tsx†L1-L420】 Key capabilities include:

- **Offline-aware service worker** now precaches the shell, caches menus with `StaleWhileRevalidate`, applies `CacheFirst` for imagery, and enqueues POST/PATCH/PUT/DELETE requests against the Supabase REST and Edge Function origins into a Workbox background-sync queue that broadcasts a replay count once connectivity returns.【F:src/sw.ts†L13-L154】
- **Background sync toast hook** listens for the service worker replay message and surfaces a contextual toast so diners know their queued actions were delivered after reconnecting.【F:src/hooks/useBackgroundSyncToast.ts†L1-L53】【F:src/components/client/ClientShell.tsx†L30-L109】
- **Push opt-in UX and hook** expose a gradient card inside the diner shell that requests notification permission, converts the VAPID key, persists the subscription via Supabase Edge Functions, and guides iOS users through the Add to Home Screen flow required for push on Safari.【F:src/components/client/ClientShell.tsx†L74-L213】【F:src/hooks/usePushSubscription.ts†L1-L126】
- **Notification storage & functions** add a `notification_subscriptions` table plus `notifications/subscribe_push` and `notifications/send_push` functions so the platform can securely register browser endpoints and stub out future delivery pipelines without leaking PII through RLS.【F:supabase/migrations/20240324000000_phase9_notifications.sql†L1-L69】【F:supabase/functions/notifications/subscribe_push/index.ts†L1-L189】【F:supabase/functions/notifications/send_push/index.ts†L1-L121】
- **Offline cart regression tests** verify cart mutations persist into localStorage, survive reloads, and clear correctly after sync using Vitest, providing automated coverage for the offline queue requirement.【F:src/stores/cart-store.test.ts†L1-L116】
- **Outsourcing playbook** keeps the Phase 9 vendors aligned on caching audits, push enablement, and offline QA execution so external partners deliver artefacts into the correct directories (`artifacts/phase9/*`, `tests/offline/`). Read the coordination details in [docs/outsourcing/phase9-outsourcing.md](docs/outsourcing/phase9-outsourcing.md).【F:docs/outsourcing/phase9-outsourcing.md†L1-L137】

### Phase 10 – Testing, load, and security hardening

Phase 10 closes the pre-GA quality gates by introducing automated end-to-end coverage, load validation, and formal security reviews ahead of the release canary.【F:docs/implementation-plan.md†L189-L212】 Key tracks include:

- **Playwright diner/merchant/admin suites** that walk the critical QR → pay → receipt path, exercise the realtime KDS, and verify AI configuration flows so regressions surface before they reach staging.【F:docs/implementation-plan.md†L194-L199】 Vendor onboarding, timelines, and deliverables live in the [Phase 10 outsourcing playbook](docs/outsourcing/phase10-outsourcing.md) so the contracted QA partner can plug into our workflow without blocking the core team.【F:docs/outsourcing/phase10-outsourcing.md†L1-L87】 The suites ship from `tests/playwright/`, which now includes a Playwright configuration, placeholder specs for each surface, and CI wiring to honour the `PLAYWRIGHT_BASE_URL` secret.
- **k6 load scenarios** for `create_table_session` and payment webhooks live in `tests/k6/scripts/` with result handling documented in `tests/k6/README.md`. Vendors should commit scenario updates and publish HTML/JSON summaries to `artifacts/phase10/load/` alongside their Grafana exports.
- **Security attestation packs** belong in `docs/security/phase10/`, with encrypted deliverables covering the OWASP ASVS L2 test plan, findings, remediation tracker, and final attestation letter. Meeting notes sit under `docs/outsourcing/notes/` for continuity once vendor access is revoked.
- **k6 load tests** against `create_table_session` and the payment webhooks to confirm latency and error-rate budgets under peak concurrency, keeping the Supabase Edge Functions within their p95 targets.【F:docs/implementation-plan.md†L199-L201】
- **Security hardening review** covering CSP/HSTS/SameSite policies, dependency audits, secrets scanning, and RLS black-box probes mapped to the OWASP ASVS checklist so launch blockers are remediated quickly.【F:docs/implementation-plan.md†L201-L202】
- **Incident response runbooks** for payments timeouts, fiscalisation outages, and AI kill-switch activation that document detection, mitigation, and rollback steps for the on-call rotation.【F:docs/runbooks/payments-timeout.md†L1-L94】【F:docs/runbooks/fiscalization.md†L1-L137】【F:docs/runbooks/ai-kill-switch.md†L1-L108】
### Deploy Aggregators

Use aggregator function names when deploying with the Supabase CLI (nested names like `payments/stripe/checkout` are deployed under `payments`):

```bash
./scripts/supabase/deploy-functions.sh --project <project-ref>
# or, individually
supabase functions deploy payments --no-verify-jwt
supabase functions deploy admin --no-verify-jwt
supabase functions deploy compliance --no-verify-jwt
supabase functions deploy ops --no-verify-jwt
```

Typical nested routes served by aggregators:
- `payments/stripe/checkout`, `payments/stripe/webhook`, `payments/momo/request_to_pay`, `payments/airtel/webhook`
- `admin/user_roles`, `admin/onboard_tenant`, `admin/reissue_table_qr`
- `notifications/subscribe_push`, `notifications/send_push`
- `menu/embed_items`

### Endpoint Smoke (curl)

Expect 405 on GET for POST-only handlers; use `-X POST` to exercise:

```bash
BASE="https://<project-ref>.functions.supabase.co"
curl -i "$BASE/payments/stripe/checkout"           # 405 (method not allowed)
curl -i "$BASE/admin/user_roles"                    # 405 without auth
curl -i -X POST "$BASE/compliance/verify_clerk"     # 503 until Clerk env is set
curl -i "$BASE/ops/db_health"                        # 200 with rpc/tables/scheduler report
```

### Ops Endpoints

- `GET /ops/db_health`
  - Returns `{ ok, rpc, tables, scheduler }` with booleans for required RPCs/tables and your scheduler URL.
  - Example: `curl -s "$BASE/ops/db_health" | jq`

- `POST /ops/update_scheduler`
  - Upserts a scheduler_config key (default `menu_embed_items_url`) to a provided URL.
  - Auth: `Authorization: Bearer` header using either `SUPABASE_SERVICE_ROLE_KEY` or `ADMIN_ONBOARDING_SECRET`.
  - Example:
    ```bash
    BASE="https://<project-ref>.functions.supabase.co"
    SRK="<service-role-key>"  # or AOS=<admin-onboarding-secret>
    curl -s -X POST "$BASE/ops/update_scheduler" \
      -H "Authorization: Bearer $SRK" \
      -H 'Content-Type: application/json' \
      -d '{"url":"'"$BASE"/menu/embed_items"' }' | jq
    ```

- `POST /ops/enqueue_test_receipt`
  - Enqueues a fiscalisation job for a recently captured payment (or returns 204 if none found).
  - Auth: `Authorization: Bearer` using `SUPABASE_SERVICE_ROLE_KEY` or `ADMIN_ONBOARDING_SECRET`.
  - Example:
    ```bash
    BASE="https://<project-ref>.functions.supabase.co"
    SRK="<service-role-key>"
    curl -s -X POST "$BASE/ops/enqueue_test_receipt" -H "Authorization: Bearer $SRK" | jq
    ```

### CI/CD

- Supabase deploy workflow: `.github/workflows/supabase-deploy.yml`
  - Dispatch with `project_ref` and optional `verify_jwt`.
  - Automatically triggers the post-deploy health workflow.

- Post-deploy health checks: `.github/workflows/post-deploy-health.yml`
  - Inputs: `base_url` (e.g., `https://<ref>.functions.supabase.co`).
  - Runs `scripts/ops/health-check.sh`, which validates:
    - Ops db health endpoint (rpc/table/scheduler)
    - Reconciliation dry-run (200)
    - Receipts queue (204/202/200, or 500 in lean envs)

- Environment matrix option: `.github/workflows/post-deploy-health-matrix.yml`
  - Define repository environments `staging` and `production` with environment variable `FUNCTIONS_BASE_URL` set to the Functions base URL for each.
  - Dispatch this workflow to run health against both.
### Functions Smoke Script

Run quick endpoint checks against a hosted Supabase project:

```bash
export BASE="https://<project-ref>.functions.supabase.co"
# optional
export SRK="<service-role-key>"           # for admin-only checks
export AOS="<admin_onboarding_secret>"    # to test admin/onboard_tenant
export TABLE_SESSION_ID="<uuid>"          # to test checkout POST
export SUB_ENDPOINT="<push_endpoint>"     # to test send_push dry run

./scripts/smoke/functions-smoke.sh
```
   # Apply migrations to hosted project
   ./scripts/supabase/db-push.sh --project <your-project-ref>
