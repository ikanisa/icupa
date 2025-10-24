# Inventory Connector

This connector translates ecoTrips search/quote/hold requests into Hotelbeds (HBX) API calls. In environments where outbound access is unavailable, fixtures located under `ops/fixtures/` are used instead.

## Modes

- `INVENTORY_OFFLINE=1`: Uses `inventory_search_kigali.json` and `inventory_quote.json` fixtures. Holds return mocked references (`mock-<uuid>`).
- `INVENTORY_OFFLINE=0`: Connector calls HBX endpoints using `HBX_BASE`, `HBX_API_KEY`, and `HBX_API_SECRET`. If `HBX_SIGNATURE_MOCK=1`, a placeholder signature is sent (useful for dry-runs).
- `INVENTORY_PROVIDER`: Currently defaults to `HBX` but is designed for future providers.

## Caching

Search and quote responses are written to `catalog.search_cache` with a TTL governed by `INVENTORY_CACHE_TTL_SECONDS` (search) and 120 seconds (quote). The cache stores the normalized JSON payload and serves responses while the circuit breaker cools down.

## Switching Providers

1. Set `INVENTORY_OFFLINE=0` and configure live HBX credentials via Supabase secrets.
2. (Optional) Adjust `INVENTORY_CACHE_TTL_SECONDS` for desired freshness.
3. Redeploy `inventory-search`, `inventory-quote`, and `inventory-hold` functions.

## Clearing Cache Entries

Use SQL (read-only example) to locate cache entries:

```sql
select cache_key, expires_at
  from catalog.search_cache
 where params_hash = '<hash>'
 order by created_at desc;
```

An admin endpoint for invalidation will be added later. For now, delete rows manually if necessary.

## Cache TTL Tuning

- `INVENTORY_CACHE_TTL_SECONDS` (search) defaults to 600 seconds. Increase to reduce supplier calls during spikes; decrease when fresher pricing is required.
- `INVENTORY_QUOTE_CACHE_TTL_SECONDS` (quotes) defaults to 120 seconds to bias towards fresh totals while still shielding HBX retries.
- Changes require updating Supabase secrets followed by redeploying the inventory edge functions so the new TTL values are picked up.

## Fixture Workflow When Offline

1. Confirm `INVENTORY_OFFLINE=1` is set via `supabase secrets list --project-ref woyknezboamabahknmjr`.
2. `inventory-search` reads `ops/fixtures/inventory_search_kigali.json`, filters by `city`, and caches the normalized payload exactly as live HBX responses would be stored.
3. `inventory-quote` hydrates the booking breakdown from `ops/fixtures/inventory_quote.json` and writes a short-lived cache record for repeat quotes.
4. `inventory-hold` returns a mock reference (`mock-<uuid>`) with a 15-minute expiry and records the idempotency key in-memory per function instance.
5. When ready to return to live mode, flip `INVENTORY_OFFLINE=0`, ensure HBX credentials are configured, redeploy the functions, and monitor the `AUDIT inventory.*` logs for `source="HBX"` lines.
