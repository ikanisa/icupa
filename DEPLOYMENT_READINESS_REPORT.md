# Deployment Readiness Report

## Summary
We completed the Vercel readiness pass for the ecoTrips monorepo. Node 18 and npm workspaces are now enforced, each Next.js app validates its required environment variables, and automation can reproduce Vercel preview builds through the new GitHub Actions workflow and preflight script. Artifacts live under `audit/` for inventory, env coverage, and per-app Vercel configuration.

## Inventory Highlights
- **Apps:** marketing site (`app`), client (`apps/client`), admin (`apps/admin`).
- **Frameworks:** Next.js App Router across the stack (14.x for workspaces, 15.x for marketing).
- **Package manager:** npm workspaces (lockfile normalized, package manager pinned to `npm@10.8.2`).
- **Node runtime:** 18.20.4 via `.nvmrc` and `engines` constraints.
- Detailed metadata captured in `audit/inventory.json`.

## Vercel Configuration Plan
- Per-app `vercel.json` committed under each project to document build/install commands (`npm ci` + `npm run build`).
- `audit/vercel-plan.md` maps repo paths to Vercel rootDirectory assignments and enumerates shared settings (standalone output, Supabase env).
- All `next.config.ts` files now import runtime env validators and set `output: "standalone"`.

## Environment Matrix
- `audit/env-matrix.csv` lists 19 environment variables across runtime/test scopes.
- `.env.example` files ship with each app showing required Supabase configuration and optional automation secrets.
- Runtime env validators (`src/env.ts`) fail fast during builds if required variables are absent.

## CI & Tooling
- **GitHub Actions:** `.github/workflows/vercel-preview-build.yml` runs `vercel pull` + `vercel build` for marketing/client/admin in parallel when secrets are provided, uploading build logs for triage.
- **Local preflight:** `scripts/vercel-preflight.mjs` verifies Node/npm versions, checks env completeness, and executes `npm run build` in each project after confirming linking state.

## Risk & Follow-up
- Secrets (`VERCEL_PROJECT_ID_*`, `VERCEL_ORG_ID`, `VERCEL_TOKEN`) must be added to GitHub for the preview workflow to run automatically; otherwise the job self-documents the missing values.
- Run `vercel link` inside each project directory to populate `.vercel/project.json` before using the preflight script or CI locally.
- Supabase service role/anon keys must be configured in Vercel project settings; without them builds will fail during env validation.

## Readiness by App
| App | Status | Rationale | Time to Green |
| --- | ------ | --------- | ------------- |
| Marketing (`app`) | Amber | Env validator enforces Supabase secrets; awaiting actual secrets + Vercel linking. | ~0.5 day to provision secrets and link project |
| Client (`apps/client`) | Amber | Build validated locally; requires Supabase anon key + Vercel project secrets. | ~0.5 day |
| Admin (`apps/admin`) | Amber | Same as client; no additional blockers once secrets provided. | ~0.5 day |

Once Vercel secrets are configured and each project is linked, both the GitHub workflow and `scripts/vercel-preflight.mjs` will produce green preview builds aligned with Vercel production behavior.
