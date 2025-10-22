# Deployment Readiness Report

## Overview
- **Audit date:** 2025-10-21
- **Node version:** 18.20.4 (pinned via `.nvmrc` and enforced in `package.json` engines)
- **npm version:** 10.7.0 (documented in `package.json` engines to align workspace tooling)
- **Package manager:** npm workspaces (`package-lock.json`), bun lockfile removed to avoid drift.
- **Key artifacts:**
  - `audit/inventory.json`
  - `audit/vercel-plan.md`
  - `audit/env-matrix.csv`
  - `.github/workflows/vercel-preview-build.yml`
  - `scripts/vercel-preflight.mjs`

## App Health Status
| App | Path | Status | Notes |
| --- | --- | --- | --- |
| Vite Frontend | `.` | Amber | Requires Supabase credentials and Agents URL. `vercel build` validated locally via preflight script once env provided. |
| Admin Console | `apps/admin` | Amber | Next.js standalone output enabled. Provide Supabase URL/key and optional service-role key. |
| Client App | `apps/client` | Amber | Same Supabase requirements as Admin. |
| Vendor Portal | `apps/vendor` | Amber | Same Supabase requirements. |
| Marketing Site | `apps/web` | Amber | Requires Supabase + optional VAPID key for push. |
| OCR Converter | `apps/ocr-converter` | Amber | Needs shared token to secure endpoint; not a Vercel target. |
| Agents Service | `agents-service` | Red | Must run outside Vercel with OpenAI + Supabase service role secrets. |

_All web apps move to Green once the required environment variables listed in `audit/env-matrix.csv` are supplied in Vercel and the GitHub secrets below are configured._

## Environment Matrix Summary
- Required env vars validated at runtime via `@icupa/config/env` and new app-specific `env.server.ts` imports.
- `.env.example` files added for every deployable app plus agents service and OCR converter shim.
- See `audit/env-matrix.csv` for full breakdown (build vs runtime, optional defaults, and usage notes).

## Vercel Configuration
- Per-app `vercel.json` files define install/build commands using npm workspaces and set `output: 'standalone'` in Next.js configs.
- Root `vercel.json` now includes Vite framework metadata with static output directory `dist`.
- Follow `audit/vercel-plan.md` to map each Vercel project to its `rootDirectory`, `installCommand`, and `buildCommand`.
- Recommended secrets for GitHub Actions (per project):
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID_VITE`
  - `VERCEL_PROJECT_ID_ADMIN`
  - `VERCEL_PROJECT_ID_CLIENT`
  - `VERCEL_PROJECT_ID_VENDOR`
  - `VERCEL_PROJECT_ID_WEB`
  - Optional: `VERCEL_AUTOMATION_BYPASS_SECRET` when Deployment Protection is enabled.

## CI & Tooling
- New workflow `.github/workflows/vercel-preview-build.yml` runs `vercel pull` + `vercel build` for preview and production across all projects in parallel matrix jobs.
- Artifact uploads capture `.vercel/output/logs` for debugging failing builds.
- `scripts/vercel-preflight.mjs` offers a local sanity check that verifies env vars and builds every workspace (`npm run vercel:preflight`).

## Outstanding Risks & Follow-ups
1. **Secrets provisioning** – Populate all required env vars in Vercel and GitHub before relying on CI. Missing keys will fail the preflight and workflow early.
2. **Agents service deployment** – Needs container/VM deployment with network access to OpenAI and Supabase; not suitable for Vercel serverless runtime.
3. **Repository hygiene** – `node_modules` directories remain committed in `agents-service/`. Recommend cleaning and ignoring to reduce checkout size.

## Time-to-Green Estimates
- **Web apps:** <1 hour once secrets are provided and CI secrets configured.
- **Agents service:** 1–2 days to provision runtime, secure secrets management, and wire into Supabase/OpenAI infrastructure.
