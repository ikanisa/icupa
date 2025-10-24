# Supabase Migration Order & Dependencies

This project maintains a large catalog of SQL migrations under
`supabase/migrations`. The files must be applied in order because later
changes depend on schemas, policies, and helper functions introduced in earlier
steps. The conventions below document the sequencing so that operators can
replay the history or generate new bundles confidently.

## Numbered baseline (0001 – 0033)

The `000x` files form the foundation. Apply them sequentially without gaps.
Each file either introduces a new schema or augments the structures from the
previous step.

| Range | Theme | Depends on |
| ----- | ----- | ---------- |
| 0001 | Initial public/fin/ops schemas | — |
| 0002 | RLS hardening for the base tables | 0001 |
| 0003 – 0009 | Payments + permits primitives, shared reporting views | 0001–0002 |
| 0010 – 0014 | Permit & group collaboration flows (requests, helpers, public API) | 0004 (group basics), 0009 (ops views) |
| 0015 – 0018 | Group payout ledgers & reporting helpers | 0012 – 0014 |
| 0019 – 0025 | Agent runtime & evaluation surfaces | 0001 – 0011 |
| 0026 – 0027 | Payment metadata and snapshot helpers | 0003 – 0009 |
| 0028 – 0033 | WhatsApp messaging, finance RPCs, app roles, ops views | prior numbered migrations |

*Guidance:* because later migrations reference schemas created earlier, do not
cherry-pick or skip files inside this set.

## Timestamped extensions (20250922…)

The timestamped migrations are additive features layered onto the numbered
baseline. Apply them after `0033_ops_views_additions.sql`.

- `20250922070148_init_schema.sql` backfills a consolidated view for scheduled
  jobs and expects all agent-runtime tables from `0019+` to exist.
- `20250922083454_wa_messages.sql` and `20250922083455_wa_state.sql` extend the
  WhatsApp helpers introduced in `0028_wa_messages.sql`.
- `20250922083456_metrics_counters.sql` adds metrics counters on top of the
  observability helpers from earlier migrations.
- `20250922083457_inventory_cache.sql` and
  `20250922083510_inventory_cache_rpcs.sql` depend on the catalog cache tables
  from `0027_payment_snapshot.sql`.
- `20250922083458_group_escrow_status_rpc.sql` enhances the group escrow RPCs
  defined across `0012_groups_splitpay.sql` through
  `0018_group_payout_report_helpers.sql`.
- `20250922083459_privacy_datamap.sql` layers on the privacy request surfaces
  introduced in `0011_permits_public_functions.sql` and
  `0024_agent_evals.sql`.
- `20250922083500_dr_registry.sql` expects the disaster-recovery registry tables
  staged by `0020_agent_runtime_public_helpers.sql`.
- `20250922083511_ops_chaos_policies.sql` introduces a shared registry for chaos
  injection scenarios consumed by synthetics and the wallet tile downloader.

## Adding new migrations

1. Append new files with the next available prefix (either incremental number or
   timestamp). Avoid renumbering existing migrations.
2. Record prerequisite objects in the comment header so future contributors can
   validate ordering quickly.
3. Update this README whenever a migration introduces a new dependency chain or
   cross-schema interaction.

Following these rules keeps the deployment pipeline deterministic and makes it
clear which areas need attention when promoting changes between environments.
