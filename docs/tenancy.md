# Tenancy Model — ICUPA Platform

**Last Updated:** 2025-11-01

This guide documents how multi-tenant isolation is implemented after the repository refactor. Share with engineering, support, and compliance teams when onboarding new environments or reviewing security controls.

## 1. Tenancy Overview

- **Tenant Scope:** Each venue/location is a tenant. Tenants are grouped into organizations for invoicing and shared analytics.
- **Runtime Isolation:**
  - **Frontend:** Runtime tenant context resolved from QR payload, stored in signed JWT, and passed through to feature flag evaluation.
  - **Backend:** Supabase Row-Level Security (RLS) enforces tenant boundaries using `tenant_id` columns on transactional tables.
  - **Agents Service:** Uses tenant-scoped API keys and row-level grants for `tenant_profiles`, `agent_runtime_configs`, and `agent_events`.
- **Configuration:** Tenant entitlements live in `tenant_features` with feature flag overrides for beta rollouts.

## 2. Data Model

| Table/View | Purpose | Key Columns | RLS Policy |
| ---------- | ------- | ----------- | ---------- |
| `tenant_profiles` | Canonical tenant metadata (name, timezone, billing) | `id`, `slug`, `timezone`, `billing_plan` | `tenant_profiles_rls` ensures only matching tenant_id access |
| `tenant_locations` | Physical sites tied to tenants | `id`, `tenant_id`, `address`, `qr_payload` | `tenant_locations_rls` restricts per tenant |
| `tenant_features` | Feature flag state, start/end times | `tenant_id`, `feature_key`, `enabled_from` | `tenant_features_rls` restricts per tenant |
| `tenant_members` | Merchant/admin operators | `id`, `tenant_id`, `role`, `auth_user_id` | `tenant_members_rls` restricts per tenant |
| `tenant_audit_log` | Immutable audit trail | `id`, `tenant_id`, `actor`, `event_type` | Append-only, read scoped to tenant |

Legacy views (`vw_tenant_profiles`) remain for backward compatibility and alias to the new tables. They will be removed after the 2025-12 deprecation window.

## 3. Access Patterns

1. **Web App**
   - Tenancy context resolved in `apps/web/src/app/providers/tenant-context.tsx`.
   - API calls include `tenantId` header. Supabase edge functions read context from JWT.
   - Feature flags evaluated via `packages/config/src/flags.ts` with tenant + location dimensions.
2. **Agents Service**
   - Tenant access token minted via Supabase function `agents_issue_token`.
   - Fastify hooks inject `tenantId` into OpenAI tool calls and Supabase queries.
   - Guardrails enforce per-tenant conversation budgets via `agent_runtime_configs`.
3. **Operations Tooling**
   - Admin console provides tenant switcher that queries `tenant_profiles` with support override privileges.
   - Runbooks reference stored procedures `sp_enable_tenant_feature` and `sp_disable_tenant_feature` for flag changes.

## 4. Environment Configuration

| Environment | Supabase Project | Feature Flag Baseline | Notes |
| ----------- | ---------------- | --------------------- | ----- |
| Local | `.env.local` with anon/service keys | `demo_icupa` seeded; all beta flags enabled | Use `pnpm supabase:start` for local dev |
| Preview | Supabase Preview Branch | Only QA tenants (`qa-tenant-*`) enabled | PR-specific; auto-destroyed after merge |
| Staging | `icupa-staging` | Canary tenants only (`demo_icupa`, `pilot_*`) | Used for regression, load testing |
| Production | `icupa-prod` | Feature flags default off unless GA | Canary cadence documented in go-live runbook |

## 5. Operational Processes

- **Provisioning:**
  1. Create tenant via admin console (writes to `tenant_profiles`).
  2. Assign locations and members.
  3. Seed feature flags via `sp_enable_tenant_feature` if needed.
  4. Confirm metrics board `Tenancy → Health` shows green.
- **Deprovisioning:**
  1. Disable feature flags and agent runtime configs.
  2. Mark tenant as `status = 'deactivated'`.
  3. Archive data to cold storage (export + encrypt).
  4. Revoke Supabase service keys in Vault.
- **Audit:** Quarterly review of `tenant_members` vs HR roster; store evidence in `audit/` folder.

## 6. Future Enhancements

- Automate tenant provisioning via CLI (`pnpm tenants:create --slug ...`).
- Expand per-tenant metric coverage (latency, AI guardrail breaches) and export to `artifacts/observability/`.
- Evaluate use of Supabase Organizations when GA for multi-project tenancy.

