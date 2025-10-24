# Payout reconciliation fixtures

The finance reconciliation fixtures provide an observable way to validate the `payouts-recon` edge function
without needing live Stripe exports. The internal and external payloads ship through `ops.console_fixtures` and
the reconciliation state is stored in `fin.payouts_ext`.

## Fixture payloads

- **Internal payouts** (`finance.payouts.recon.internal`)
  - `11111111-2222-3333-4444-555555555555` – USD 4,820.00 (created 2024-05-04)
  - `66666666-7777-8888-9999-000000000000` – USD 1,050.00 (created 2024-04-24)
  - `aaaaaaaa-bbbb-cccc-dddd-ffffffffffff` – USD 2,875.00 (created 2024-04-08)
- **External statements** (`finance.payouts.recon.external`)
  - `po-ext-201` – USD 4,820.00 recorded 2024-05-06
  - `po-ext-202` – USD 1,050.00 recorded 2024-04-26
  - `po-ext-203` – USD 1,999.00 recorded 2024-03-28 (intentionally unmatched)

Run the reconciliation via the admin finance page or with a direct HTTP call:

```bash
curl -X POST \
  -H "Authorization: Bearer <OPS_ACCESS_TOKEN>" \
  "https://<project-ref>.functions.supabase.co/payouts-recon"
```

## Before and after snapshot

| Stage   | Total rows | Reconciled | Pending | Notes |
| ------- | ---------- | ---------- | ------- | ----- |
| Before  | 0          | 0          | 0       | Clean slate before running the function. |
| After   | 3          | 2          | 1       | `po-ext-201` and `po-ext-202` match internal fixtures, `po-ext-203` remains outstanding. |

Matched rows populate `fin.payouts_ext.payout_id` with the internal payout identifier, while leaving the `metadata.escrow_id`
field for quick comparisons against escrow records.

The function logs both stages with payloads similar to:

```json
{
  "level": "INFO",
  "event": "finance.payouts.recon",
  "fn": "payouts-recon",
  "stage": "after",
  "requestId": "...",
  "counts": { "total": 3, "reconciled": 2, "pending": 1 },
  "matched": 2,
  "unmatched_internal": ["aaaaaaaa-bbbb-cccc-dddd-ffffffffffff"],
  "unmatched_external": ["po-ext-203"]
}
```

This sample confirms that fixtures flow through `fin.payouts_ext`, powering the payout aging widget in the admin
console and enabling deterministic verification of reconciliation behaviour.
