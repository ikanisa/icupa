# ICUPA Architecture Overview

This document summarises the major layers in the ICUPA monorepo and how they interact. It is a living reference – update it when you introduce new services, flows, or deployment targets.

## High-level surfaces

| Surface    | Location                                    | Description                                                                 |
|------------|---------------------------------------------|-----------------------------------------------------------------------------|
| Diner PWA  | `apps/web/src/app/(client)` & modules under `modules/diner` | Anonymous table experience (menu browsing, cart, pay, AI waiter)           |
| Merchant   | `apps/web/src/app/(merchant)` & `modules/merchant`           | WhatsApp-authenticated portal (KDS, menu ingestion, onboarding)            |
| Admin      | `apps/web/src/app/(admin)` & `modules/admin`                | Email magic-link console for tenants, AI guardrails, analytics             |
| Agents API | `apps/agents-service`                        | Fastify service wrapping the OpenAI Agents SDK with guardrails & telemetry |
| Supabase   | `supabase/`                                  | Schema migrations, storage policies, edge functions, tests                 |

> **Note**: The `modules/*` directories are being introduced during the refactor to group shared code by feature area. Existing components are gradually being moved from `apps/web/src/components`.

## Runtime responsibilities

### Web app (`apps/web`)

- Uses Vite + React + Tailwind + Radix for UI.
- `src/integrations/supabase/` creates the browser client; headers automatically forward `x-icupa-session` for RLS.
- Hooks in `src/hooks/` abstract Supabase queries (TanStack Query) and UI state.
- `src/components/ai/` hosts shared assistant widgets (chat transcript, composer, metadata view).
- Feature flags, kill switches, and telemetry contexts live under `src/lib/`.
- Tests:
  - Unit: Vitest (`npm run test`)
  - Accessibility smoke: `tests/accessibility/*.test.tsx`
  - Playwright journeys: `tests/playwright/specs/*`

### Agents service (`apps/agents-service`)

- Fastify server exposing:
  - `/agents/waiter` – orchestrates waiter, allergen guardian, upsell agents.
  - `/agent-feedback` – records thumbs up/down.
  - `/tools/*` – JSON-schema validated tool endpoints.
  - `/realtime/token` – issues short-lived WebRTC tokens for voice waiter.
- Agents defined via `@openai/agents` (multi-agent runner with guardrails).
- Shared modules:
  - `agents/` – Waiter, guardian definitions.
  - `tools/` – Zod schemas + Supabase/HTTP integrations.
  - `middleware/policy.ts` – budgets, feature flags, tool-depth checks.
  - `telemetry/` – OpenTelemetry spans + writes to `agent_events`.

### Supabase (`supabase/`)

- `migrations/` – forward-only SQL; each table enables RLS with policies defined near creation.
- `functions/` – Edge Functions (auth, menu ingestion, payments, embeddings, etc.).
- `tests/` – SQL regression suites validating RLS and business rules.
- Storage:
  - `raw_menus` (private) – uploaded menu files.
  - `menu_images` (signed access) – OCR previews.

### Shared packages (`packages/`)

- `ingestion-utils` – OCR merge/dedupe logic, price sanity heuristics, schema typings.
- Future home for `agent-utils` (tool schemas, safety validators) and UI kits.

## Cross-cutting concerns

- **Authentication**: Supabase Auth (anon sessions, WhatsApp OTP, admin magic links). Agents service validates Supabase session tokens when acting on behalf of diners.
- **AI & RAG**: Agents service uses OpenAI Agents SDK with file-search collections (`menu`, `allergens`, `policies`). Menu publish triggers `menu/embed_items` to refresh embeddings.
- **Safety**: Allergen blocking, age gates, price transparency enforced in both UI and agents service; logs redact PII and never store OTPs in plaintext.
- **Telemetry**: OpenTelemetry spans (frontend & agents), Supabase `agent_events` for auditing, release scripts under `scripts/release`.
- **Feature flags**: Controlled via `agent_runtime_configs` table and environment variables (e.g., `ai.waiter.enabled`, `ai.waiter.voice.enabled`).

## Suggested future structure

As the refactor progresses, aim for:

```
apps/
  web/
    src/
      app/
      modules/
        diner/
        merchant/
        admin/
        agents-ui/
        common/
      lib/
      hooks/
      integrations/
      styles/
  agents-service/
    src/
      index.ts
      config/
      middleware/
      agents/
      tools/
      telemetry/
      services/
      realtime/
packages/
  ingestion-utils/
  agent-utils/
supabase/
  migrations/
  functions/
  tests/
docs/
  ARCHITECTURE.md
  ...
```

Keep this document aligned with reality to help onboarding engineers find the right entry points quickly.
