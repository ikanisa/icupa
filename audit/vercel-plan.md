# Vercel Deployment Plan

This repository hosts multiple deployable targets. Each Vercel project should pin Node.js 18 and use npm workspaces from the monorepo root.

## Monorepo Settings
- **Install command:** `npm install --include-workspace-root --workspaces`
- **Build cache:** Enable npm cache. Vercel should run commands from the repository root when using the `--prefix ..` flag for workspace-scoped builds.
- **Environment:** Provide shared Supabase credentials and agents URLs as described in the env matrix.

## Apps

### Admin Console (`apps/admin`)
- **Framework:** Next.js 14 (App Router)
- **Vercel rootDirectory:** `apps/admin`
- **Install Command:** `npm install --include-workspace-root --workspaces --prefix ..`
- **Build Command:** `npm run build --workspace @icupa/admin --prefix ..`
- **Dev Command (local):** `npm run dev --workspace @icupa/admin`
- **Output Directory:** `.next`
- **Node.js version:** 18
- **Notes:** Requires Supabase URL/keys and optional NEXT_PUBLIC_APP_URL for link building. Next config exports `output: 'standalone'` to enable Vercel auto-lambda packaging.

### Client App (`apps/client`)
- **Framework:** Next.js 14 (App Router)
- **rootDirectory:** `apps/client`
- **Install Command:** `npm install --include-workspace-root --workspaces --prefix ..`
- **Build Command:** `npm run build --workspace @icupa/client --prefix ..`
- **Output Directory:** `.next`
- **Notes:** Shares Supabase credentials with Admin app.

### Vendor Portal (`apps/vendor`)
- **Framework:** Next.js 14 (App Router)
- **rootDirectory:** `apps/vendor`
- **Install Command:** `npm install --include-workspace-root --workspaces --prefix ..`
- **Build Command:** `npm run build --workspace @icupa/vendor --prefix ..`
- **Output Directory:** `.next`
- **Notes:** Uses Supabase edge functions and same env schema as other Next apps.

### Marketing Site (`apps/web`)
- **Framework:** Next.js 14 (App Router)
- **rootDirectory:** `apps/web`
- **Install Command:** `npm install --include-workspace-root --workspaces --prefix ..`
- **Build Command:** `npm run build --workspace icupa-web --prefix ..`
- **Output Directory:** `.next`
- **Notes:** Provides marketing and onboarding experience with push subscription requiring public VAPID key.

### Vite Frontend (`.`)
- **Framework:** Vite + React 18 + SW
- **rootDirectory:** `.`
- **Install Command:** `npm install`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Notes:** Validate Supabase URL/key at build. When deploying on Vercel use the static adapter (`@vercel/static-build`), which Vercel auto-detects for Vite.

## Services

### Agents Service (`agents-service`)
- **Framework:** Fastify (Node.js runtime)
- **Deployment target:** Not deployed to Vercel (requires long-lived server & OpenAI Agents). Recommend container-based deployment or background worker.

## Additional Configuration
- Ensure each Vercel project defines `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (if required), and `NEXT_PUBLIC_AGENTS_URL` or `VITE_AGENTS_URL` depending on app. Mirror these in both Preview and Production environments.
- Configure optional `VERCEL_AUTOMATION_BYPASS_SECRET` for CI-driven deployments when Deployment Protection is active.
- Enable automatic invalidation headers per app via updated Next.js config and per-project `vercel.json` (checked into each app directory).
- Follow `docs/deployment/vercel-env-sync.md` for the environment variable promotion log, including Supabase, Agents, and push notification credentials.
