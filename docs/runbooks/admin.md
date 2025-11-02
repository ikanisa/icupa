# Admin Console Runbook

## Overview

The Admin Console governs tenant onboarding, AI guardrails, and compliance programmes across every ICUPA deployment. It surfaces features such as tenant lifecycle management, AI guardrails, and compliance insights that are defined in the shared application dictionary.【F:packages/types/src/apps.ts†L83-L107】

## Monitoring & Telemetry

- **Supabase Edge Functions** — Critical mutations (`admin/feature_flags/upsert`, `admin/agents/update_settings`, `auth/admin_email_magiclink`) proxy through Supabase functions. Failures surface as warnings (`[admin] Falling back to mocked response`) in the browser console; review Supabase function logs when this occurs.【F:apps/admin/lib/api.ts†L16-L56】
- **Agents integration** — The console reads and patches agent settings via Supabase. Confirm the Agents service health dashboards before modifying AI autonomy budgets.【F:apps/admin/lib/api.ts†L34-L55】
- **Front-end telemetry** — Browser-level warnings default to `console.warn` only when falling back to mocked data; treat recurring warnings as a signal that Supabase connectivity is degraded.【F:apps/admin/lib/api.ts†L40-L44】

## Feature Flags & Kill Switches

1. Navigate to **Admin → Flags** (`/flags`). The page hydrates flag state using TanStack Query and Supabase data.【F:apps/admin/app/(console)/flags/page.tsx†L5-L53】
2. Toggle a flag. Each change calls the `admin/feature_flags/upsert` Edge Function and invalidates cached queries so all clients refresh automatically.【F:apps/admin/app/(console)/flags/page.tsx†L25-L64】【F:apps/admin/lib/api.ts†L47-L55】
3. Use the toast feedback to confirm success; on error, inspect the Supabase Edge Function logs and requeue once the incident is mitigated.【F:apps/admin/app/(console)/flags/page.tsx†L29-L43】
4. Record rollouts and kill-switch activations in the **Rollout Notes** section below to maintain operator history.

## Rollback Procedure

- **Application rollback**: Execute `vercel rollback <previous-deployment-url>` to restore the prior build. Promote a known-good preview only after smoke tests pass again.【F:deployments/admin/README.md†L52-L63】
- **Feature flag rollback**: Revert any critical toggles through `/flags`. Each toggle is idempotent and syncs through Supabase realtime.【F:apps/admin/app/(console)/flags/page.tsx†L25-L64】
- **AI settings rollback**: Use the AI Settings surface to republish safe defaults; the mutation posts to `admin/agents/update_settings` through Supabase and reuses the same warning channel for degraded mode.【F:apps/admin/lib/api.ts†L48-L55】

## Incident Response

1. **Assess impact**: Check Supabase function logs for recent 4xx/5xx responses tied to admin endpoints (`auth/admin_email_magiclink`, `admin/feature_flags/upsert`).【F:apps/admin/lib/api.ts†L34-L55】
2. **Stabilise**: If the console is partially available, activate relevant kill-switches or fallback experiences using the Flags page while backend remediation occurs.【F:apps/admin/app/(console)/flags/page.tsx†L25-L64】
3. **Communicate**: Page the on-call channel, provide context (affected tenants, incident timestamps), and open a status entry referencing this runbook.
4. **Recover**: After fixes, redeploy via Vercel, re-run smoke tests, and capture the resolution in the Rollout Notes log.【F:deployments/admin/README.md†L65-L81】
5. **Post-incident**: File a retrospective summarising detection, containment, and follow-up actions. Link to Supabase logs and relevant GitHub issues in the incident tracker.

## Rollout Notes

| Timestamp (UTC) | Action | Command | Result |
| --- | --- | --- | --- |
| 2025-11-02 13:19 | Production smoke test | `curl -I https://admin.icupa.dev/login` | 200 OK (cache hit) |
| 2025-11-02 13:19 | Production smoke test | `curl -I https://admin.icupa.dev/` | 200 OK (cache hit) |
| 2025-11-02 13:20 | Production smoke test | `curl -I https://admin.icupa.dev/tenants` | 200 OK (cache hit) |

_Local verification used the production-equivalent build via `pnpm --filter @icupa/admin build` prior to these checks; replicate the same commands for each deploy._【aef12d†L1-L15】【227457†L4-L18】【8231bb†L1-L15】【13847e†L1-L15】
