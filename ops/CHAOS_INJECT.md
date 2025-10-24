# Chaos injection controls

The `chaos-inject` edge function publishes the active policy map that operators
can use during outage simulations. Policies are merged from three sources:

1. **Database (`ops.chaos_policies`)** – persisted overrides that survive
   redeploys. This should be the primary method for staging scenarios.
2. **Memory/env overrides (`CHAOS_INJECT_MEMORY`)** – quick JSON payloads that
   can be injected through the Edge Function configuration when reproducing an
   issue locally.
3. **Fixtures (`ops/fixtures/chaos_policy_map.json`)** – opt-in via
   `CHAOS_INJECT_FIXTURES=1` for automated smoke tests and local demos.

## Inspecting active policies

```
# Requires SUPABASE_URL + SERVICE_ROLE env vars
curl -s "$SUPABASE_URL/functions/v1/chaos-inject" \
  -H "apikey: $SUPABASE_SERVICE_ROLE" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE" | jq
```

The response returns:

- `policies`: deduplicated entries with `mode`, `fallback`, and source metadata.
- `source`: indicates whether the map came from fixtures, memory, the database,
  or a mixture.
- `total`: number of active policies after filtering out disabled or expired
  entries.

## Updating the policy map

Use the `ops.chaos_policies` table for durable updates:

```
insert into ops.chaos_policies (key, target, mode, fallback, enabled, notes)
values (
  'inventory-fixtures',
  'inventory-search',
  'force_failure',
  'fixtures',
  true,
  'Force fixture fallback during HBX chaos testing.'
)
on conflict (key)
  do update set
    enabled = excluded.enabled,
    notes = excluded.notes,
    fallback = excluded.fallback,
    updated_at = now();
```

Disable a scenario after testing by flipping `enabled` back to `false` or by
setting `expires_at` to a timestamp in the past. The next `chaos-inject`
invocation will drop the entry automatically.

## Synthetics + wallet behaviour

- `synthetics-probe` reads the policy map before health checks. If a target is
  marked `force_failure` with a `fallback`, the probe records the failure but
  keeps the overall status green as long as the fallback is present.
- The wallet’s tile download UI surfaces the same metadata so operators can
  pause or resume offline pack downloads while chaos exercises are running.

> ℹ️ Commit policy changes in Git _only_ when updating the fixture file for test
> scenarios. Production overrides should live in the database to avoid
> accidental reverts during deploys.
