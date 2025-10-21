# Vercel Deployment Plan

## Overview
- **Team Node version:** `18.20.4` (pinned via `.nvmrc` and `engines` fields).
- **Package manager:** `npm` with workspaces (enforced by `packageManager` field and `npm ci`).
- **Apps covered:** marketing site (`app`), client SPA (`apps/client`), admin console (`apps/admin`).

## Project Mapping

| Vercel Project | Repo Path      | Root Directory Setting | Install Command | Build Command | Output Directory |
| -------------- | -------------- | ---------------------- | --------------- | ------------- | ---------------- |
| ecotrips-marketing | `app`         | `app`                  | `npm ci`        | `npm run build` | `.next` |
| ecotrips-client    | `apps/client` | `apps/client`          | `npm ci`        | `npm run build` | `.next` |
| ecotrips-admin     | `apps/admin`  | `apps/admin`           | `npm ci`        | `npm run build` | `.next` |

Each directory includes a `vercel.json` file to keep the configuration co-located with the source.

## Shared Settings
- Enable `output: "standalone"` (committed in every `next.config.ts`) to allow the Vercel build output to contain the production server bundle.
- `npm ci` must run with workspaces enabled (default for npm >= 7).
- Provide `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for browser-facing apps; `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for marketing API routes.
- If Deployment Protection is enabled, supply `VERCEL_AUTOMATION_BYPASS_SECRET` to CI and preview environments.

## Marketing Site (`app`)
- **Framework:** Next.js 15 App Router.
- **Edge/SSR:** API route `app/api/leads` requires Supabase service role. No Node-specific APIs beyond Fetch; safe for edge if desired.
- **Env Vars:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional `PLAYWRIGHT_BASE_URL` for tests.
- **Build Notes:** Uses Turbopack flags for dev/build; `next build` with `--turbopack` works in CI and Vercel.

## Client App (`apps/client`)
- **Framework:** Next.js 14 App Router.
- **Edge/SSR:** UI components call Supabase client-side only; validated env ensures presence of anon key.
- **Env Vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Images:** Remote patterns allow Unsplash; extend in Vercel UI if marketing assets hosted elsewhere.

## Admin App (`apps/admin`)
- **Framework:** Next.js 14 App Router.
- **Edge/SSR:** Uses Supabase auth helpers; requires same public Supabase vars as client.
- **Env Vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Auth:** Additional roles `ops`/`admin` enforced via app logic; no extra env required.

## Observability & Logs
- Enable Vercel build logs and insights for each project.
- Ensure `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and the per-project `VERCEL_PROJECT_ID_*` secrets exist for CI workflows.

## Deployment Workflow
1. `vercel pull --environment=preview` executed from each project directory using the linked project IDs.
2. `vercel build` runs with Node 18.
3. Artifacts from `.vercel/output/logs` uploaded to GitHub for debugging.
4. Successful build triggers automatic preview; production builds follow Vercel Git integration (auto or manual promote).

## Follow-up Tasks
- Link each Vercel project to the appropriate subdirectory with `vercel link` locally (once) to populate `.vercel/project.json` before running the preflight script.
- Configure Supabase service role and anon keys in Vercel dashboard secrets.
