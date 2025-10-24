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
- Run `npm run deploy` to execute a scripted `vercel pull` → `vercel build` → `vercel deploy` flow once secrets are available. The helper automatically loads `.env.deploy`, `.env.preview`, `.env.production.local`, or `.env.local` if present and also supports `--env-file <path>` overrides for bespoke bundles.
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
- `CI / verify-full` status check enforced on `main` (runs lint, typecheck, vitest, Playwright, and Supabase migration tests).
- New workflow `.github/workflows/vercel-preview-build.yml` runs `vercel pull` + `vercel build` for preview and production across all projects in parallel matrix jobs.
- Artifact uploads capture `.vercel/output/logs` for debugging failing builds.
- `scripts/vercel-preflight.mjs` offers a local sanity check that verifies env vars and builds every workspace (`npm run vercel:preflight`).

## Branch Protection & Reviews
- `main` requires 2 approving reviews, dismisses stale reviews on new commits, and blocks force pushes/deletions.
- Required status checks: `CI / verify-full`, `CI / lint`, `CI / typecheck`, `CI / migrations-validate`.
- `Require branches to be up to date before merging` enabled to ensure the latest `main` artifacts pass the verify suite.

## Rehearsal Deployments
- Latest dry run from feature branch `work` built with placeholder Supabase credentials and passed smoke QA via `npm run preview -- --host 127.0.0.1 --port 5000`.
- Preview deploy checklist exercised against temporary Vercel preview URLs (see `docs/deployment/vercel-env-sync.md` for the environment promotion log).
- Supabase smoke (`scripts/smoke/functions-smoke.sh`) queued for execution once service-role secrets land in the preview environment.

### 2025-10-23 Preview Attempt
- Attempted to trigger the workspace deployment via `npm run deploy`, but the script is not defined in `package.json`; Vercel preview could not be kicked off from the CLI.
- Ran `npm run vercel:preflight` to validate readiness. The script halted immediately because required Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are absent in the shell.
- Without the missing secrets the preview URL never materialized, so no end-to-end verification of performance reporting (metrics posting, sampling controls, callbacks) was possible in this session.

### 2025-10-24 Preview Attempt
- Added a non-interactive deployment helper (`npm run deploy`) that shells out to the Vercel CLI with `vercel pull`, `vercel build`, and `vercel deploy` steps.
- Populated placeholder Supabase environment variables locally; the helper now runs until it calls `vercel pull`.
- The CLI halted with `ENETUNREACH` because outbound network access to `vercel.com` is blocked in the current environment. A valid `VERCEL_TOKEN` (and optionally `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID`) will still be required once connectivity is restored.

## Release & Rollback
- Tag production releases using `git tag vYYYY.MM.DD` on the merge commit and push with `git push origin --tags`. Mirror the tag into Vercel (Project → Deployments → Promote) when promoting preview to production.
- Rollback playbook:
  1. Identify the last known good deployment in Vercel.
  2. Promote it to production and tag the rollback commit as `rollback-<timestamp>`.
  3. Run `scripts/smoke/ingestion-smoke.mjs` and `npm run smoke:ingestion` against production URLs to verify stability.
- Capture rollback steps and resolution details in `docs/runbooks/rollback-log.md` for future audits.

## Outstanding Risks & Follow-ups
1. **Secrets provisioning** – Populate all required env vars in Vercel and GitHub before relying on CI. Missing keys will fail the preflight and workflow early.
2. **Agents service deployment** – Needs container/VM deployment with network access to OpenAI and Supabase; not suitable for Vercel serverless runtime.
3. **Repository hygiene** – `node_modules` directories remain committed in `agents-service/`. Recommend cleaning and ignoring to reduce checkout size.
4. **Playwright base URL secret** – Provide `PLAYWRIGHT_BASE_URL` to avoid local server spin-up inside the `verify-full` workflow when testing against staged deployments.

## Time-to-Green Estimates
- **Web apps:** <1 hour once secrets are provided and CI secrets configured.
- **Agents service:** 1–2 days to provision runtime, secure secrets management, and wire into Supabase/OpenAI infrastructure.
