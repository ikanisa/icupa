# PH0 Discovery Report

## Frontend and Shared Code Inventory
- **Root application (`vite` stack):** The monorepo currently ships a Vite-based React app with comprehensive scripts for linting, type-checking, Vitest, Playwright, Lighthouse, and Supabase database verification, all defined in the root `package.json`. 【F:package.json†L1-L87】
- **Existing Next.js app (`apps/staff-pwa`):** The primary customer-facing UI lives under `apps/staff-pwa`, using Next.js 14 with React 18, TailwindCSS, React Query, Zustand, and Framer Motion. Its config disables the powered-by header, enforces strict mode, and injects security headers (CSP, HSTS, Referrer Policy, Permissions Policy) for every route. Tailwind is composed via a shared preset, layering Aurora/glass tokens and reduced-motion variants. 【F:apps/staff-pwa/package.json†L1-L39】【F:apps/staff-pwa/next.config.mjs†L1-L54】【F:apps/staff-pwa/tailwind.config.ts†L1-L60】
- **Secondary tooling (`apps/ocr-converter`):** A lightweight Node service (server.mjs) supports OCR conversions, likely invoked by ingestion flows. 【F:apps/ocr-converter/server.mjs†L1-L40】
- **Shared packages:**
  - `packages/ui` exposes the shared component library with Tailwind utility helpers and declares React peer dependencies. 【F:packages/ui/package.json†L1-L19】
  - `packages/config/tailwind-preset.ts` centralizes Aurora/glass design tokens, colors, and animation primitives consumed by Tailwind configs. 【F:packages/config/tailwind-preset.ts†L1-L81】
  - `packages/ingestion-utils` (not yet inspected for this phase) contains ingestion helpers that we can reuse when porting vendor flows. 【F:packages/ingestion-utils/package.json†L1-L12】
- **Global Tailwind setup:** A root Tailwind config remains in place for the legacy app shell with Aurora/glass tokens and animations, ensuring additive changes keep compatibility. 【F:tailwind.config.ts†L1-L86】

## Supabase Edge Functions and CORS Status
| Namespace / Path | Exported endpoints | Observed CORS handling |
| --- | --- | --- |
| `auth` | `whatsapp_send_otp`, `whatsapp_verify_otp`, `whatsapp_webhook`, `admin_email_magiclink` routed via the namespace index. 【F:supabase/functions/auth/index.ts†L1-L35】 | Success/error responses set JSON headers only; no `Access-Control-Allow-Origin` is returned today. 【F:supabase/functions/auth/whatsapp_send_otp/index.ts†L18-L48】 |
| `create_table_session` | Single handler for QR-authenticated table sessions. 【F:supabase/functions/create_table_session/index.ts†L1-L40】 | JSON responses add `Content-Type`/`Cache-Control` only; CORS headers are absent. 【F:supabase/functions/create_table_session/index.ts†L21-L37】 |
| `payments` | Stripe checkout/webhook, MTN MoMo request/webhook, Airtel request/webhook, and refunds share a dispatcher. 【F:supabase/functions/payments/index.ts†L1-L38】 | Responses rely on individual handlers that return JSON without CORS allowances (e.g., 404 fallback only sets `content-type`). 【F:supabase/functions/payments/index.ts†L30-L37】 |
| `merchant` | Inventory auto-86 toggles and onboarding updates. 【F:supabase/functions/merchant/index.ts†L1-L27】 | Responses mirror other namespaces with JSON headers only. |
| `menu` | `embed_items` inference endpoint. 【F:supabase/functions/menu/index.ts†L1-L24】 | No CORS headers today. |
| `ingest_menu_start/process/publish` | Standalone handlers orchestrate ingestion lifecycle. 【F:supabase/functions/ingest_menu_start/index.ts†L1-L33】 | Shared utilities return JSON with cache-control only, no origin allow-list. |
| `notifications` | Push subscribe/unsubscribe/send. 【F:supabase/functions/notifications/index.ts†L1-L32】 | Dispatcher and handlers omit CORS headers. |
| `receipts` | Rwanda EBM, Malta fiscalization, and async queue processing. 【F:supabase/functions/receipts/index.ts†L1-L32】 | No explicit `Access-Control-Allow-*` headers. |
| `client-events-log-storage-error` | Logs client storage quota errors with service-role context. 【F:supabase/functions/client-events-log-storage-error/index.ts†L1-L57】 | Helper `jsonResponse` adds only `Content-Type`/`Cache-Control`. 【F:supabase/functions/client-events-log-storage-error/index.ts†L18-L36】 |
| `compliance` | Data subject requests and Clerk verification. 【F:supabase/functions/compliance/index.ts†L1-L27】 | JSON-only headers, no CORS configuration. |
| `reconciliation` | Daily reconciliation run + latest summary endpoints. 【F:supabase/functions/reconciliation/index.ts†L1-L59】 | Responses set `content-type`/`cache-control` without origin allow-list. 【F:supabase/functions/reconciliation/index.ts†L25-L46】 |
| `voice` | Session bootstrapper for voice agent. 【F:supabase/functions/voice/index.ts†L1-L23】 | Dispatcher responses omit CORS headers. |
| `ops` | DB health ping, scheduler refresh, test receipt queue. 【F:supabase/functions/ops/index.ts†L1-L32】 | JSON-only headers, no CORS configuration. |
| `admin` | Tenant onboarding, QR reissue, agent actions, role management. 【F:supabase/functions/admin/index.ts†L1-L32】 | Dispatcher responses omit CORS headers. |

**Summary:** Every inspected function either calls shared responders or returns JSON without `Access-Control-Allow-Origin`. No origin allow-list exists yet, so the multi-PWA rollout will need additive CORS updates per namespace.

## CI / Automation Inventory
- **Primary CI (`ci.yml`):** On push/PR the pipeline runs lint and typecheck jobs in parallel, gates a `performance` job that runs Next/Vite build plus Lighthouse perf suite, executes database migrations against a local Postgres service, checks Deno formatting for Edge Functions, and conditionally runs Playwright when a base URL secret is available. 【F:.github/workflows/ci.yml†L1-L76】【F:.github/workflows/ci.yml†L78-L121】
- **Edge deploy (`deploy.yml` & `supabase-deploy.yml`):** Manual workflows deploy Supabase Edge Functions after installing the Supabase CLI and seeding project secrets; the matrix variant triggers post-deploy health checks automatically. 【F:.github/workflows/deploy.yml†L1-L46】【F:.github/workflows/supabase-deploy.yml†L1-L44】
- **E2E on demand (`playwright.yml`):** Provides a dispatcher for running Playwright suites against arbitrary environments with HTML/GitHub reporters. 【F:.github/workflows/playwright.yml†L1-L36】
- **Post-deploy health (`post-deploy-health*.yml`):** Scripts run HTTP smoke checks against provided Supabase function base URLs and can fan out across staging/production environments. 【F:.github/workflows/post-deploy-health.yml†L1-L27】【F:.github/workflows/post-deploy-health-matrix.yml†L1-L14】

These automation hooks establish the baseline gating we must preserve when adding new PWAs, ensuring lint/type/build/test steps remain mandatory before shipping.
