# Perf Runner Smoke Scenario

- **Command:** `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test deno run -A ops/perf/perf_runner.ts --scenario smoke`
- **Result:** Mock endpoints responded within budget (`p95=17.7ms`, `errors=0`).

```
Running perf scenario: smoke — Ping health endpoints and inventory search
  • inventory-search ✅ 17.7ms (status 200)
  • ops-bookings-health ✅ 2.7ms (status 200)
  • synthetics-probe ✅ 1.9ms (status 200)
Summary: p95=17.7ms, errors=0
```

> Executed against the local mock Supabase server to satisfy the smoke check without external credentials.
