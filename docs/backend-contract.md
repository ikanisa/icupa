# Backend Contract Headers

The backend relies on a small set of custom HTTP headers to propagate diner identity, admin capabilities, and internal service provenance. Frontend clients and integrations must forward these headers exactly so that Supabase row-level security (RLS) and Edge Functions behave deterministically.

## Session-scoped diner access

| Header | Purpose | Producers | Consumers |
| --- | --- | --- | --- |
| `x-icupa-session` | Binds REST and Edge Function calls to a table session UUID so that diners only see their own orders. | QR flows issue the token and the web client forwards it for every Supabase request. | Supabase RLS policies (`supabase/tests/rls_orders.sql`, `supabase/tests/rls_menu_ingestions.sql`), payment functions, notifications, and voice flows rely on the header. |

When the header is missing the Edge Functions return explicit `missing_session` errors to avoid silent denials.【F:supabase/functions/payments/stripe/checkout/index.ts†L53-L68】【F:supabase/functions/notifications/unsubscribe_push/index.ts†L38-L64】 The shared helper normalises casing so downstream handlers can accept `X-ICUPA-Session` or `x-icupa-session` without drift.【F:supabase/functions/_shared/headers.ts†L1-L17】

The SQL regression suite in `supabase/tests` enforces that diners cannot read foreign data by injecting the header into the PostgreSQL `request.headers` setting.【F:supabase/tests/rls_orders.sql†L4-L36】 Keep this header stable; Playwright and Vitest integration tests execute the SQL files via `supabase db test` to guarantee RLS parity.【F:tests/playwright/specs/supabase.rls.spec.ts†L1-L27】【F:tests/supabase/rls.test.ts†L1-L32】

## Administrative automation

| Header | Purpose | Producers | Consumers |
| --- | --- | --- | --- |
| `x-icupa-admin-token` | Grants privileged access to manage reconciliation runs, refunds, and agent actions. | Internal dashboards attach the token when an admin session is present.【F:src/hooks/useReconciliationRuns.ts†L20-L60】【F:src/hooks/useAgentActionQueue.ts†L60-L84】 | Edge Functions validate the token before mutating protected resources.【F:supabase/functions/admin/agent_actions/index.ts†L189-L210】【F:supabase/functions/payments/refund/index.ts†L21-L30】 |
| `x-icupa-dsr-token` | Authenticates data subject requests for compliance exports. | The compliance portal supplies a signed token per request. | The DSR Edge Function rejects calls without the header.【F:supabase/functions/compliance/dsr/index.ts†L24-L42】 |
| `x-icupa-cron` | Marks trusted scheduled jobs (e.g. embeddings refresh). | Supabase cron invocations stamp the header. | Security definer functions check the header before executing.【F:supabase/migrations/20240221000000_phase1_embedding_cron.sql†L49-L68】 |

## Service-to-service calls

| Header | Purpose | Producers | Consumers |
| --- | --- | --- | --- |
| `x-icupa-internal` | Identifies backend processes when they talk to Supabase. | The agents service sets the header on its Supabase client.【F:agents-service/src/supabase.ts†L15-L25】 | RLS policies and audit logs can distinguish internal calls from diner interactions. |

## Implementation guidance

1. **Always forward the diner session header.** The shared Supabase browser client already injects `x-icupa-session`; confirm any new fetchers do the same so diners stay isolated.【F:src/integrations/supabase/client.ts†L1-L36】
2. **Normalise casing.** Use the `_shared/headers.ts` helper when authoring Edge Functions to avoid missing headers because of case differences.【F:supabase/functions/_shared/headers.ts†L1-L17】
3. **Guard admin endpoints.** Functions that mutate global state must check `x-icupa-admin-token` or `x-icupa-internal` to prevent privilege escalation.
4. **Update tests when headers change.** The Vitest and Playwright suites wrap the SQL RLS tests; if you introduce a new header-based policy, add a new SQL file and reference it from the suites so CI exercises it automatically.【F:tests/supabase/rls.test.ts†L1-L32】【F:tests/playwright/specs/supabase.rls.spec.ts†L1-L27】

By documenting the contract here, frontend teams can mirror backend expectations and ensure staged environments behave like production when deploying to Vercel.
