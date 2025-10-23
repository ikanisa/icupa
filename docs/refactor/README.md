# Multi-tenant refactor overview

This phase aligns the diner, merchant, and admin surfaces around the same multi-tenant contract. Use the sections below as a high-level map before diving into individual modules.

## Diner checkout

- `src/components/client/ClientShell.tsx` continues to source menu/location data via `useMenuData`, but the Playwright journey in `tests/playwright/specs/diner.journey.spec.ts` now intercepts Supabase requests so Kigali (RWF) and Valletta (EUR) tenants can be exercised deterministically in CI.
- Vitest coverage in `src/components/merchant/MerchantShell.test.tsx` and `src/pages/AdminQrTools.test.tsx` demonstrates how to stabilise React Query hooks and Supabase Edge Function calls when writing component-level tests.

### Migration notes

1. When adding new diner tenant features, seed the relevant Supabase tables (`supabase/seed/seed.sql`) and extend the SQL assertions in `supabase/tests/multi_tenant_flows.sql` so both tenants remain covered.
2. Set `icupa_table_session`, `icupa_age_gate_choice`, and `icupa_install_banner_dismissed` in Playwright fixtures if a new journey relies on the age gate or session banners.

## Merchant dashboards

- `src/components/merchant/MerchantShell.tsx` and child panels accept `MerchantLocation` objects; the Playwright spec `tests/playwright/specs/merchant.operations.spec.ts` stubs location-specific orders, inventory, and promo payloads so tab interactions remain tenant-aware.
- React Query consumers (`useMerchantLocations`, `useKdsOrders`, `useInventoryControls`) should be mocked in Vitest to avoid creating real Supabase clients during unit tests.

### Migration notes

1. When introducing new merchant panels, expose deterministic mocks under `tests/playwright/specs` and register Supabase routes in the shared helpers.
2. Keep audit logging and promo spend invariants synced with the SQL regression files in `supabase/tests/merchant_portal.sql` and `supabase/tests/multi_tenant_flows.sql`.

## Admin QR tooling

- The admin Edge Function UI at `src/pages/AdminQrTools.tsx` now has both unit (`AdminQrTools.test.tsx`) and Playwright (`tests/playwright/specs/admin.qr-tools.spec.ts`) coverage to guarantee the bearer token, QR payload, and signature all flow through when rotating table codes.
- CI hooks (`scripts/ci/reset-supabase-test-db.mjs`) run before Vitest/Playwright/Supabase suites so every environment starts with the same seeded QR tokens and table inventory.

### Migration notes

1. Use the reset script locally (`node scripts/ci/reset-supabase-test-db.mjs`) whenever migrations or seeds change so unit/e2e suites run against fresh fixtures.
2. When adding new admin tooling, capture the Supabase invocation contract in both Vitest and Playwright to keep mocks deterministic.

## Onboarding checklist

- Review `docs/testing.md` for the latest ownership matrix and cadence per suite.
- Run `npm run verify` followed by `npm run test:e2e` on feature branches touching multi-tenant logic.
- Extend `supabase/tests/multi_tenant_flows.sql` whenever tenant-scoped tables are added to ensure CI enforces cross-tenant boundaries.
