# ICUPA Architecture Refactor Plan

## Route & Component Inventory

### Legacy React SPA (`src/`)
- **Top-level providers:** The Vite-powered SPA wraps all routes in React Query, Supabase session, tooltip, and toast providers before rendering the React Router configuration. Owners: `@ikanisa/frontend-team` (SPA) with Supabase integration co-owned by backend. Dependencies: `react-router-dom`, `@tanstack/react-query`, `@supabase/supabase-js`, shared UI system. 【F:src/App.tsx†L1-L21】【F:src/modules/core/providers/QueryProvider.tsx†L1-L29】【F:src/modules/supabase/SupabaseSessionProvider.tsx†L1-L78】【F:.github/CODEOWNERS†L24-L33】
- **`/` → `ClientLandingPage`** delegates to `ClientShell`, which drives menu filtering, cart state, push notifications, and Supabase-backed table sessions for diners. Owners: `@ikanisa/frontend-team`. Key dependencies include local hooks, Zustand stores, Lucide icons, Framer Motion, and Supabase client instrumentation. 【F:src/modules/routing/AppRouter.tsx†L6-L24】【F:src/components/client/ClientShell.tsx†L1-L135】【F:.github/CODEOWNERS†L24-L33】
- **`/admin` and `/admin/tools/qr` → Admin console surfaces** render `AdminShell` and QR tooling from the legacy component library, maintaining compatibility while the Next.js admin app matures. Owners: `@ikanisa/frontend-team`. 【F:src/modules/routing/AppRouter.tsx†L7-L23】【F:.github/CODEOWNERS†L24-L33】
- **`/merchant` and `/merchant/receipts` → Merchant portal and receipt viewer** rely on the legacy merchant modules pending migration to `apps/vendor`. Dependencies include Supabase integrations and shared merchant components. Owners: `@ikanisa/frontend-team`. 【F:src/modules/routing/AppRouter.tsx†L8-L24】【F:.github/CODEOWNERS†L24-L33】
- **Fallback `*` → `NotFoundPage`** keeps 404 handling inside the SPA until routing is fully delegated to the Next.js apps. Owners: `@ikanisa/frontend-team`. 【F:src/modules/routing/AppRouter.tsx†L10-L24】【F:.github/CODEOWNERS†L24-L33】

### Next.js Surfaces (`apps/*`)
- **Marketing hub (`apps/web`)** offers a landing page linking to each surface with product copy and LiquidGlass UI cards, plus dedicated marketing routes under `(surfaces)` that showcase the client, merchant, and admin experiences. Owners: `@ikanisa/frontend-team`. Dependencies: shared UI kit, Lucide icons, Framer Motion, Supabase SDK, Zustand, TanStack Query. 【F:apps/web/app/page.tsx†L1-L83】【F:apps/web/app/(surfaces)/merchant/page.tsx†L1-L84】【F:apps/web/app/(surfaces)/admin/page.tsx†L1-L92】【F:apps/web/app/(surfaces)/client/page.tsx†L1-L7】【F:apps/web/package.json†L6-L37】【F:.github/CODEOWNERS†L35-L41】
- **Client PWA (`apps/client`)** rebuilds diner flows (menu browsing, cart, payment, receipts) in Next.js with client components, Fuse.js search, Zustand cart state, and TanStack Query. Owners: `@ikanisa/frontend-team`. Dependencies: shared menu data, Supabase SDK, shared UI kit. 【F:apps/client/app/page.tsx†L1-L96】【F:apps/client/app/pay/page.tsx†L1-L85】【F:apps/client/package.json†L5-L31】【F:.github/CODEOWNERS†L35-L39】
- **Vendor portal (`apps/vendor`)** mirrors merchant operations (dashboards, orders, menus, inventory, promos) with React Query-backed API calls and shared UI primitives. Owners: `@ikanisa/frontend-team`. Dependencies: Supabase SDK, TanStack Query, shared UI kit, analytics cards. 【F:apps/vendor/app/page.tsx†L1-L167】【F:apps/vendor/package.json†L5-L32】【F:.github/CODEOWNERS†L35-L41】
- **Admin console (`apps/admin`)** provides authenticated control panels (overview, compliance, analytics, feature flags) built on TanStack Query and shared data contracts. Owners: `@ikanisa/frontend-team`. Dependencies: Supabase, internal config/types packages, Lucide, Recharts. 【F:apps/admin/app/page.tsx†L1-L48】【F:apps/admin/app/(console)/compliance/page.tsx†L1-L134】【F:apps/admin/package.json†L5-L30】【F:.github/CODEOWNERS†L35-L38】
- **API adapters (`apps/api`)** expose lightweight handlers for WhatsApp bots, OpenAI Realtime tooling, and health checks, bridging to shared AI orchestration utilities. Owners: default `@ikanisa/core-team`. Dependencies: internal AI router/tooling, WhatsApp Cloud API, OpenAI Realtime. 【F:apps/api/whatsapp/webhook.ts†L1-L133】【F:apps/api/openai/realtimeWebhook.ts†L1-L92】【F:.github/CODEOWNERS†L6-L8】
- **Voice agent server (`apps/voice-agent`)** hosts an Express + WebSocket service for Twilio media streams, MCP servers, and health/readiness endpoints. Owners: default `@ikanisa/core-team`. Dependencies: Express, ws, dotenv, Twilio-specific handlers, Supabase credentials. 【F:apps/voice-agent/src/index.ts†L1-L133】【F:.github/CODEOWNERS†L6-L8】
- **OCR converter (`apps/ocr-converter`)** remains a Node service for menu ingestion. Owner: `@ikanisa/backend-team`. (No code changes in this pass.) 【F:.github/CODEOWNERS†L35-L41】
- **EcoTrips workspace (`apps/ecotrips`)** is a nested monorepo (Next.js apps, Supabase functions, Turbo pipeline) managed by `@ikanisa/ecotrips-team`, carrying its own lint/type tooling and Supabase automation. 【F:apps/ecotrips/package.json†L1-L37】【F:.github/CODEOWNERS†L35-L41】

### Agents Service (`agents-service/src`)
Fastify exposes multiple AI agent entry points alongside health checks, using OpenAI Agents, Supabase tool integrations, telemetry, and optional realtime routes. Owners: `@ikanisa/ai-team` (agents) & `@ikanisa/backend-team` (server). Dependencies: `@openai/agents`, Supabase SDK, Zod validation, OTEL, pricing utilities.
- `/health`, `/` diagnostics. 【F:agents-service/src/server.ts†L323-L332】
- `/agents/waiter` orchestrates upsell, allergen, and waiter agents with contextual telemetry and Supabase-backed tool usage. 【F:agents-service/src/server.ts†L334-L551】
- `/agents/promo`, `/agents/inventory`, `/agents/support`, `/agents/compliance` run managed agent pipelines with tool allowlists and fallback prompts. 【F:agents-service/src/server.ts†L553-L718】
- `/agent-feedback` records ratings for downstream analytics. 【F:agents-service/src/server.ts†L721-L739】
- Optional realtime routes register under `/ai/*` when enabled. 【F:agents-service/src/server.ts†L751-L768】
- Agent definitions rely on Supabase tools, retrieval augmenters, and cost-aware handoffs. 【F:agents-service/src/agents/agents.ts†L1-L120】【F:.github/CODEOWNERS†L43-L47】

### Supabase Edge Functions (`supabase/functions`)
Supabase-hosted Deno functions manage onboarding, auth, menu ingestion, payments, receipts, notifications, and voice control. Owners: `@ikanisa/backend-team` with specialized teams per namespace. Dispatcher patterns route subpaths to specific handlers.
- Payments gateway aggregator routes Stripe, MTN MoMo, Airtel, and refund handlers. 【F:supabase/functions/payments/index.ts†L1-L45】【F:.github/CODEOWNERS†L56-L63】
- Receipts aggregator issues Rwanda EBM, Malta fiscal numbers, and queue processors. 【F:supabase/functions/receipts/index.ts†L1-L31】【F:.github/CODEOWNERS†L56-L63】
- Menu embeddings endpoint triggers pgvector updates for semantic search. 【F:supabase/functions/menu/index.ts†L1-L26】
- Admin role management enforces RBAC with Supabase service-role keys and tenant scoping. 【F:supabase/functions/admin/manage_user_roles/index.ts†L1-L200】
- Auth WhatsApp OTP flow provisions tenants, locations, and roles, updating merchant profiles atomically. 【F:supabase/functions/auth/whatsapp_verify_otp/index.ts†L1-L195】
- Voice session dispatcher bridges to SIP session handlers for OpenAI Realtime voice experiences. 【F:supabase/functions/voice/index.ts†L1-L26】

## Lint, TypeScript, and Formatting Configuration Snapshot

### Repository Root
- **ESLint**: Flat config extending `@eslint/js` and `typescript-eslint`, enabling React Hooks and React Refresh plugins, with targeted overrides for UI exports. Owners: `@ikanisa/frontend-team`. 【F:eslint.config.js†L1-L42】【F:.github/CODEOWNERS†L16-L21】
- **TypeScript**: Base config targets ES2020 with bundler resolution, shared path aliases, and relaxed strictness for the legacy SPA; app/node tsconfigs extend it for browser vs. tooling contexts. Owners: `@ikanisa/core-team`. 【F:tsconfig.base.json†L1-L31】【F:tsconfig.app.json†L1-L13】【F:tsconfig.node.json†L1-L9】【F:.github/CODEOWNERS†L16-L21】
- **Prettier**: Shared 100-character line width, trailing commas, double quotes. Owners: `@ikanisa/core-team`. 【F:prettier.config.mjs†L1-L14】【F:.github/CODEOWNERS†L16-L21】
- **Package tooling**: Root scripts run Vite SPA dev, Next app dev filters, Supabase workflows, lint-staged, and verification suites across PWAs, agents, and Supabase. 【F:package.json†L11-L156】

### App-Specific Tooling
- **Next PWAs (`apps/web`, `apps/client`, `apps/vendor`, `apps/admin`)**: Each extends root tsconfig with Next plugins, shared workspace path aliases, and strict or relaxed mode depending on maturity. Owners: `@ikanisa/frontend-team`. 【F:apps/web/tsconfig.json†L1-L81】【F:apps/client/tsconfig.json†L1-L62】【F:apps/vendor/tsconfig.json†L1-L62】【F:apps/admin/tsconfig.json†L1-L62】【F:.github/CODEOWNERS†L35-L41】
- **Per-app dependencies** emphasize Supabase SDK, TanStack Query, shared UI/config/types packages, plus surface-specific libs (Fuse.js for client search, Recharts for admin analytics). 【F:apps/web/package.json†L6-L37】【F:apps/client/package.json†L5-L31】【F:apps/vendor/package.json†L5-L32】【F:apps/admin/package.json†L5-L30】
- **Voice agent**: Uses standalone tsconfig emitting CommonJS, enabling declaration/source maps for Node deployment. 【F:apps/voice-agent/tsconfig.json†L1-L24】

### Agents Service
- **tsconfig** outputs CommonJS with strict checks, producing declarations for Fastify deployment. Owners: `@ikanisa/backend-team`. Dependencies: OpenAI Agents SDK, Fastify, OTEL, Supabase. 【F:agents-service/tsconfig.json†L1-L18】【F:agents-service/package.json†L1-L41】【F:.github/CODEOWNERS†L43-L47】

### Packages
- **Shared packages (`packages/*`)**: UI exports (Tailwind + Radix wrappers), config (feature flags), types, db clients. Ownership per CODEOWNERS (frontend/back/core/back). Feature flag schema centralizes migration toggles. 【F:packages/ui/tsconfig.json†L1-L11】【F:packages/config/src/feature-flags.ts†L1-L30】【F:.github/CODEOWNERS†L49-L54】
- **EcoTrips packages**: Independent lint (Next core web vitals), Prettier profile, Turbo-powered workspace with deno format/test commands, and Next build wrappers. Owners: `@ikanisa/ecotrips-team`. 【F:apps/ecotrips/package.json†L1-L37】【F:apps/ecotrips/app/package.json†L1-L52】【F:apps/ecotrips/packages/eslint-config/next.cjs†L1-L5】【F:apps/ecotrips/packages/prettier-config/index.cjs†L1-L8】【F:apps/ecotrips/tsconfig.base.json†L1-L43】【F:apps/ecotrips/supabase/functions/tsconfig.json†L1-L14】

### Supabase Functions Tooling
- Edge functions use Deno (no local tsconfig at root), but EcoTrips subrepo supplies ESNext bundler configs for its Supabase functions. 【F:supabase/functions/payments/index.ts†L1-L45】【F:apps/ecotrips/supabase/functions/tsconfig.json†L1-L14】

## Migration Mappings

| Legacy Surface | Destination Next Service | Notes |
| --- | --- | --- |
| `src/modules/client/*` (React Router diner shell) | `apps/client` Next PWA (`/`, `/cart`, `/item/[id]`, `/pay`, `/ai`, `/receipt/[id]`) | Preserve cart/session semantics; replace Supabase hooks with Next server components and shared TanStack stores. 【F:src/components/client/ClientShell.tsx†L1-L135】【F:apps/client/app/page.tsx†L1-L96】 |
| `src/modules/merchant/*` | `apps/vendor` dashboards (`/`, `/orders`, `/menu`, `/inventory`, `/floor`, `/promos`, `/settings`, `/kds`) | Align Supabase queries and telemetry streams; reuse LiquidGlass UI primitives. 【F:apps/vendor/app/page.tsx†L1-L167】 |
| `src/modules/admin/*` | `apps/admin` console routes (`/`, `/login`, `/flags`, `/analytics`, `/compliance`, `/tenants`, `/ai`) | Map feature toggles and compliance dashboards, ensuring metrics parity. 【F:apps/admin/app/page.tsx†L1-L48】【F:apps/admin/app/(console)/compliance/page.tsx†L1-L134】 |
| SPA 404 and marketing entry | `apps/web` landing + `(surfaces)` routes | Link legacy SPA banner to new surfaces via feature flag (`multi-pwa-banner`). 【F:apps/web/app/page.tsx†L1-L83】【F:packages/config/src/feature-flags.ts†L15-L28】 |
| WhatsApp bot & realtime webhooks in SPA/misc | `apps/api` handlers (`/whatsapp/send`, `/whatsapp/webhook`, `/openai/realtimeWebhook`) | Consolidate AI orchestration entry points with shared tooling. 【F:apps/api/whatsapp/webhook.ts†L1-L133】【F:apps/api/openai/realtimeWebhook.ts†L1-L92】 |
| Legacy agent orchestration | `agents-service` Fastify endpoints | Maintain compatibility layer by proxying from Next API routes during migration. 【F:agents-service/src/server.ts†L323-L739】 |
| Supabase functions (auth, payments, receipts, menu) | Continue as shared backend; expose typed SDK wrappers via `apps/supabase/functions` packages for use in Next apps. 【F:supabase/functions/payments/index.ts†L1-L45】【F:supabase/functions/auth/whatsapp_verify_otp/index.ts†L1-L195】 |

## Risks and Mitigations
- **Data duplication between legacy SPA and Next client**: `ClientShell` consumes live Supabase data and complex hooks, while the Next client PWA currently relies on static fixtures, risking drift in allergen logic, cart math, and install flows. Mitigate by extracting shared hooks/stores into packages and gating rollout via feature flags. 【F:src/components/client/ClientShell.tsx†L1-L135】【F:apps/client/app/page.tsx†L1-L96】【F:packages/config/src/feature-flags.ts†L15-L28】
- **Role/permission consistency**: Admin Supabase functions enforce RBAC; migrating admin console must respect the same `user_roles` guards to avoid privilege escalation. Mitigate by generating typed clients from Supabase definitions and reusing serverless endpoints. 【F:supabase/functions/admin/manage_user_roles/index.ts†L1-L200】
- **Payment/fiscal workflows**: Edge functions coordinate multiple providers (Stripe, MTN, Airtel, Rwanda EBM, Malta fiscal). New PWAs must preserve request headers (`x-icupa-session`) and error handling to avoid breaking compliance. Mitigate with integration tests and shared API clients. 【F:supabase/functions/payments/index.ts†L1-L45】【F:supabase/functions/receipts/index.ts†L1-L31】【F:apps/client/app/pay/page.tsx†L1-L85】
- **AI agent coupling**: Agents-service exposes multiple specialized agents with budget enforcement and telemetry; migrating clients must maintain schema parity or risk unexpected costs. Mitigate by centralizing Zod schemas and ensuring Next API routes proxy through the service until native ports are ready. 【F:agents-service/src/server.ts†L334-L718】【F:agents-service/src/agents/agents.ts†L1-L120】
- **EcoTrips workspace divergence**: Separate tooling (Turbo, Deno, custom lint) can drift from ICUPA defaults. Mitigate by documenting interop and establishing bridge packages for shared components. 【F:apps/ecotrips/package.json†L1-L37】【F:apps/ecotrips/packages/eslint-config/next.cjs†L1-L5】

## Feature Flag Strategy
- Use `coreFeatureFlags.multiPwaBanner` to surface links from the legacy SPA to the Next PWAs selectively by role/tenant, enabling phased rollout. 【F:packages/config/src/feature-flags.ts†L15-L24】
- Gate AI-specific features (e.g., Next client AI waiter) with `coreFeatureFlags.aiWaiterBeta`, allowing controlled opt-in per audience. 【F:packages/config/src/feature-flags.ts†L22-L28】
- Introduce migration-specific flags (e.g., `merchant-next-enabled`) alongside Supabase config tables so operators can toggle surfaces without redeploys. Extend `FeatureFlag` schema for region/tenant targeting during rollout. 【F:packages/config/src/feature-flags.ts†L1-L30】

## Stakeholder Review Notes
- Coordinate with owners per CODEOWNERS for each area (frontend, backend, AI, payments, compliance, EcoTrips) to approve migration sequencing. 【F:.github/CODEOWNERS†L24-L63】
- Validate that deployment tooling (Vercel for Next apps, Fastify service hosting, Supabase edge functions) can coexist during transition; ensure staging environments wire to both legacy SPA and Next apps before flipping flags. 【F:package.json†L11-L49】【F:agents-service/package.json†L1-L41】【F:supabase/functions/payments/index.ts†L1-L45】
