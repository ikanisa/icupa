# Vercel Environment Sync

Track and audit the environment variables synced into the Vercel Preview and Production environments.

## Shared Variables
| Key | Scope | Preview | Production | Notes |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client (Next.js) | ✅ | ✅ | Points at the managed Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client (Next.js) | ✅ | ✅ | Supabase anon key with row-level security enforced. |
| `VITE_SUPABASE_URL` | Client (Vite) | ✅ | ✅ | Mirrors `NEXT_PUBLIC_SUPABASE_URL`; required for the diner shell. |
| `VITE_SUPABASE_ANON_KEY` | Client (Vite) | ✅ | ✅ | Mirrors `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server (Edge Functions, agents) | ✅ | ✅ | Required for privileged mutations invoked via Supabase Edge Functions. |
| `NEXT_PUBLIC_AGENTS_URL` | Client (Next.js) | ✅ | ✅ | Points at the deployed agents-service HTTPS endpoint. |
| `VITE_AGENTS_URL` | Client (Vite) | ✅ | ✅ | Same as above for the Vite shell. |
| `VITE_VAPID_PUBLIC_KEY` | Client (Vite) | ✅ | ✅ | Public VAPID key for push subscription opt-in. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Client (Next.js) | ✅ | ✅ | Push notifications on the marketing/admin Next.js apps. |
| `VERCEL_REGION` | Build/runtime | ✅ (`fra1`) | ✅ (`fra1`) | Keep runtime close to EU Supabase region; update alongside `vercel.json`. |

> ℹ️ `scripts/deploy/vercel-preview.mjs` now refuses to deploy if either `NEXT_PUBLIC_AGENTS_URL` or `VITE_AGENTS_URL` are missing. Keep both environments aligned with the production agents-service hostname before invoking the deploy script.

## Preview-only Variables
| Key | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `PLAYWRIGHT_BASE_URL` | CI smoke tests | ✅ (`https://staging.icupa.dev`) | Points Playwright at the evergreen staging deployment so `verify-full` skips the local dev server. |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI auth | ✅ | Enables CLI migrations in GitHub Actions and local automation. |

## Production-only Variables
| Key | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `TABLE_QR_ADMIN_SECRET` | Admin QR regeneration | ✅ | Rotated quarterly; stored in 1Password and Vercel Production only. |
| `PUSH_WEBHOOK_SECRET` | Notifications Edge Function | ✅ | Shared with Supabase secret store for outbound push delivery. |

## Promotion Log
| Date | From → To | Notes |
| --- | --- | --- |
| 2025-02-14 | Preview → Production | Seeded Supabase + Agents URLs and VAPID keys across both environments before launch rehearsal. |
| 2025-02-14 | Local `.env` → Preview | Imported fresh Supabase service-role key after rotating credentials with security team. |
