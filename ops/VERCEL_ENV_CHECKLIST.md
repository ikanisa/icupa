# ecoTrips Vercel Environment Checklist

Two Vercel projects run from the monorepo:

- `ecoTrips-web` → `apps/client`
- `ecoTrips-admin` → `apps/admin`

Configure the following for each project before enabling previews or production deploys. Never paste secrets into git; use Vercel project settings or the Lovable secrets manager.

## Shared Environment Variables

| Name | Scope | Notes |
| ---- | ----- | ----- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Admin | Supabase project URL (`https://woyknezboamabahknmjr.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Admin | Supabase anon key (store in Vercel, not git). |
| `NEXT_PUBLIC_SITE_URL` | Client + Admin (optional) | Used for magic-link redirects when sending outside Vercel preview domains. |
| `OPENAI_API_KEY` | Client + Admin | GPT-5 agents (Lovable/Vercel secret). |

## Edge Function Secrets (Vercel env or Supabase config)

These remain outside the browsers. Configure for Supabase Edge Function deploys or Vercel serverless functions as needed:

- `SUPABASE_SERVICE_ROLE`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `WA_VERIFY_TOKEN`
- `WA_ACCESS_TOKEN`
- `WA_PHONE_ID`
- `WA_GRAPH_BASE`

## Feature Flags

Set default values ("0" or "1") using Vercel Environment Variables or Supabase Config for:

- `INVENTORY_OFFLINE`
- `WA_OFFLINE`
- `PAYMENT_MOCK`

## Deployment Steps

1. Link repo to each Vercel project (`vercel link` or dashboard UI) with the correct root (`apps/client`, `apps/admin`).
2. Run `npm install` once locally so Vercel caches workspace dependencies.
3. Add the variables above to each project and mark them for Preview + Production.
4. For passwordless magic links, set **Redirect URLs** in Supabase Auth → URL Configuration:
   - `https://<client-domain>/api/auth/callback`
   - `https://<admin-domain>/api/auth/callback`
5. Trigger a preview deploy and verify the health endpoints (`/api/auth/callback?code=test` should 400 without code, `/` renders PWA shell).
6. After deploy, run `deno run -A ops/perf/perf_runner.ts --scenario smoke` against the preview base URL and record metrics in `ops/VERIFICATION.md`.

## Post-Deploy Checklist

- Confirm login magic links redirect to `/` (client) and `/dashboard` (admin).
- Validate admin role gating by granting `sec.user_roles` → `ops` and checking `/login` redirects after sign-out.
- Attach Supabase logs + Vercel request IDs to incident response docs in `ops/observability/`.

## Credential Validation Notes
- Cross-check `.env.local.example` with Vercel: ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` reference the production Supabase project `woyknezboamabahknmjr` before promoting any environment. Update Vercel first, then refresh the local example file through secrets sync.
- When `.env.local.example` is updated, propagate the canonical Supabase project URL (`https://woyknezboamabahknmjr.supabase.co`) and replace the anonymous key placeholder with the value pulled via `vercel env pull` to keep developers aligned with production defaults.
- Confirm `OPENAI_API_KEY` is present in both Vercel projects and matches the organization-wide key registered for router + agents; document the key owner and rotation schedule in `ops/observability/KEY_ROTATIONS.md`.
- Run `vercel env pull` prior to release readiness reviews and compare the pulled values against `.env.local.example` to catch drift or placeholder credentials.
- For Supabase service role credentials, verify they are absent from `.env.local.example` but live in Vercel encrypted storage; only mirror to local `.env` during sanctioned incident rehearsals using temporary tokens.
